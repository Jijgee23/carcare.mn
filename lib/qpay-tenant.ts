/**
 * Tenant-level QPay merchant integration.
 *
 * Платформын QPay (`lib/qpay.ts`) нь subscription төлбөрт. Энэ нь захиалгын
 * төлбөрт — байгууллага бүр өөрийн merchant credentials-ээ ашиглана.
 */

import { prisma } from "@/lib/prisma";

const QPAY_URL =
  process.env.QPAY_MERCHANT_URL ?? "https://merchant.qpay.mn/v2/";
const TOKEN_EXPIRY_BUFFER_MS = 30_000;

type TokenResult = { accessToken: string; expiresAt: Date } | { error: string };

async function saveTokens(
  tenantId: string,
  body: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_expires_in: number;
  },
): Promise<{ accessToken: string; expiresAt: Date }> {
  const expiresAt = new Date(body.expires_in * 1000);
  await prisma.tenantQPaySettings.update({
    where: { tenantId },
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
  tenantId: string,
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
        "QPay токен авах явцад алдаа гарлаа. Tenant-ийн credentials шалгана уу.",
    };
  }
  return saveTokens(tenantId, await res.json());
}

async function refreshAccessToken(
  tenantId: string,
  refreshTkn: string,
): Promise<TokenResult> {
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
  return saveTokens(tenantId, await res.json());
}

export type QPayInvoiceCreated = {
  invoice_id: string;
  qr_text: string;
  qr_image: string;
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

export const TenantQPayService = {
  async getAccessToken(tenantId: string): Promise<TokenResult> {
    const settings = await prisma.tenantQPaySettings.findUnique({
      where: { tenantId },
    });
    if (!settings) {
      return {
        error: "QPay тохиргоо хийгдээгүй байна. Тохиргооноос оруулна уу.",
      };
    }
    if (!settings.enabled) {
      return { error: "QPay тохиргоо идэвхгүй байна." };
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
      return refreshAccessToken(tenantId, settings.refreshToken!);
    }
    return fetchNewToken(tenantId, settings.username, settings.password);
  },

  async createInvoice(args: {
    tenantId: string;
    senderInvoiceNo: string;
    invoiceReceiverCode: string;
    invoiceDescription: string;
    amount: number;
    callbackUrl?: string;
  }): Promise<QPayInvoiceCreated | { error: string }> {
    const tokenResult = await this.getAccessToken(args.tenantId);
    if ("error" in tokenResult) return { error: tokenResult.error };
    const settings = await prisma.tenantQPaySettings.findUnique({
      where: { tenantId: args.tenantId },
    });
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
    return (await res.json()) as QPayInvoiceCreated;
  },

  async checkPayment(
    tenantId: string,
    invoiceId: string,
  ): Promise<
    | { paid: boolean; paymentId: string | null; paidAt: Date | null }
    | { error: string }
  > {
    if (!invoiceId) return { error: "invoice_id шаардлагатай." };
    const tokenResult = await this.getAccessToken(tenantId);
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
