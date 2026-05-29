/**
 * QPay merchant integration. Платформ-level singleton credentials
 * (`QPaySettings` row id=1) ашиглана. Super admin тохиргоог удирдана.
 *
 *   - getAccessToken(): merchant token-ыг кэш + refresh-той хослуулан
 *   - createInvoice(): payment-н үнийн дүн, дугаараар QR + invoice id буцаана
 *   - checkPayment(invoice_id): тухайн invoice PAID болсон эсэх + payment_id
 */

import { prisma } from "@/lib/prisma";

const QPAY_URL =
  process.env.QPAY_MERCHANT_URL ?? "https://merchant.qpay.mn/v2/";
const TOKEN_EXPIRY_BUFFER_MS = 30_000;

type TokenResult = { accessToken: string; expiresAt: Date } | { error: string };

async function saveTokens(body: {
  access_token: string;
  refresh_token: string;
  expires_in: number; // QPay-ийн `expires_in` — Unix секунд
  refresh_expires_in: number;
}): Promise<{ accessToken: string; expiresAt: Date }> {
  const expiresAt = new Date(body.expires_in * 1000);
  await prisma.qPaySettings.update({
    where: { id: 1 },
    data: {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      tokenExpiresAt: expiresAt,
      refreshTokenExpiresAt: new Date(body.refresh_expires_in * 1000),
    },
  });
  return { accessToken: body.access_token, expiresAt };
}

async function fetchNewToken(
  username: string,
  password: string,
): Promise<TokenResult> {
  const basic = Buffer.from(`${username}:${password}`).toString("base64");
  const res = await fetch(`${QPAY_URL}auth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    return {
      error:
        "QPay токен авах явцад алдаа гарлаа. Тохиргоо болон холболтоо шалгана уу.",
    };
  }
  return saveTokens(await res.json());
}

async function refreshAccessToken(refreshTkn: string): Promise<TokenResult> {
  const res = await fetch(`${QPAY_URL}auth/refresh`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${refreshTkn}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    return { error: "QPay токен шинэчлэх явцад алдаа гарлаа." };
  }
  return saveTokens(await res.json());
}

export type QPayInvoiceCreated = {
  invoice_id: string;
  qr_text: string;
  qr_image: string; // base64 (without data: prefix)
};

export type QPayCheckResponse = {
  count: number;
  paid_amount: number;
  rows: {
    payment_id: string;
    payment_status: "PAID" | "PENDING" | "FAILED";
    paid_at: string;
  }[];
};

export const QPayService = {
  async getAccessToken(): Promise<TokenResult> {
    const settings = await prisma.qPaySettings.findUnique({ where: { id: 1 } });
    if (!settings) {
      return {
        error:
          "QPay тохиргоо олдсонгүй. Super admin талд QPay-ийн мэдээлэл оруулна уу.",
      };
    }
    if (!settings.username || !settings.password || !settings.invoiceCode) {
      return {
        error:
          "QPay тохиргоо бүрэн биш. Username, Password болон Invoice Code хэрэгтэй.",
      };
    }

    const now = Date.now();
    const accessValid =
      settings.accessToken &&
      settings.tokenExpiresAt &&
      settings.tokenExpiresAt.getTime() - now > TOKEN_EXPIRY_BUFFER_MS;
    if (accessValid) {
      return {
        accessToken: settings.accessToken!,
        expiresAt: settings.tokenExpiresAt!,
      };
    }

    const refreshValid =
      settings.refreshToken &&
      settings.refreshTokenExpiresAt &&
      settings.refreshTokenExpiresAt.getTime() - now > TOKEN_EXPIRY_BUFFER_MS;
    if (refreshValid) {
      return refreshAccessToken(settings.refreshToken!);
    }
    return fetchNewToken(settings.username, settings.password);
  },

  /**
   * Шинэ invoice үүсгэнэ. `senderInvoiceNo` нь өөрийн SubscriptionPayment.id-г
   * QPay-руу дамжуулдаг түлхүүр. Хариунд QR image (base64) + invoice_id ирнэ.
   */
  async createInvoice(args: {
    senderInvoiceNo: string;
    invoiceReceiverCode: string; // тенант ID / нэр
    invoiceDescription: string;
    amount: number;
    callbackUrl?: string;
  }): Promise<QPayInvoiceCreated | { error: string }> {
    const tokenResult = await this.getAccessToken();
    if ("error" in tokenResult) return { error: tokenResult.error };
    const settings = await prisma.qPaySettings.findUnique({ where: { id: 1 } });
    if (!settings) return { error: "QPay тохиргоо олдсонгүй." };

    const res = await fetch(`${QPAY_URL}invoice`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invoice_code: settings.invoiceCode,
        sender_invoice_no: args.senderInvoiceNo,
        invoice_receiver_code: args.invoiceReceiverCode,
        invoice_description: args.invoiceDescription,
        amount: args.amount,
        callback_url: args.callbackUrl ?? settings.callbackUrl ?? undefined,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        error: `QPay invoice үүсгэхэд алдаа: ${res.status} ${text}`,
      };
    }
    const data = (await res.json()) as QPayInvoiceCreated;
    return data;
  },

  async checkPayment(
    invoiceId: string,
  ): Promise<
    | { paid: boolean; paymentId: string | null; paidAt: Date | null }
    | { error: string }
  > {
    if (!invoiceId) return { error: "invoice_id шаардлагатай." };
    const tokenResult = await this.getAccessToken();
    if ("error" in tokenResult) return { error: tokenResult.error };

    const res = await fetch(`${QPAY_URL}payment/check`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        object_type: "INVOICE",
        object_id: invoiceId,
        offset: { page_number: 1, page_limit: 1 },
      }),
    });
    if (!res.ok) {
      return { error: `QPay шалгалт алдаа: ${res.status}` };
    }
    const data = (await res.json()) as QPayCheckResponse;
    const paidRow = data.rows?.find((r) => r.payment_status === "PAID") ?? null;
    return {
      paid: Boolean(paidRow),
      paymentId: paidRow?.payment_id ?? null,
      paidAt: paidRow?.paid_at ? new Date(paidRow.paid_at) : null,
    };
  },
};
