/**
 * QPay merchant integration. Платформ-level singleton credentials
 * (`QPaySettings` row id=1) ашиглана. Super admin тохиргоог удирдана.
 *
 *   - getAccessToken(): merchant token-ыг кэш + refresh-той хослуулан
 *   - createInvoice(): payment-н үнийн дүн, дугаараар QR + invoice id буцаана
 *   - checkPayment(invoice_id): тухайн invoice PAID болсон эсэх + payment_id
 */

import { decryptSecret, encryptSecret } from "@/lib/crypto";
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
      accessToken: encryptSecret(body.access_token),
      refreshToken: encryptSecret(body.refresh_token),
      tokenExpiresAt: expiresAt,
      refreshTokenExpiresAt: new Date(body.refresh_expires_in * 1000),
    },
  });
  // Шууд хэрэглэхэд plaintext-ийг буцаана (DB-д шифрлэгдсэн).
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

// QPay-ийн бодит enum: NEW (эхлэн, төлөгдөөгүй), PAID, FAILED, REFUNDED.
// "PENDING" гэж ЭРГЭЖ ИРДЭГГҮЙ — хуучин код үүнийг андуурч бичсэн байсан
// (2026-09-02 засав, developer.qpay.mn v2.0.0 баримт бичгийг судалж
// баталгаажуулсан).
export type QPayPaymentStatus = "NEW" | "PAID" | "FAILED" | "REFUNDED";

export type QPayCheckResponse = {
  count: number;
  paid_amount: number;
  rows: {
    payment_id: string;
    payment_status: QPayPaymentStatus;
    // Бодит талбарын нэр `payment_date` (өмнө нь буруу `paid_at` гэж
    // уншдаг байсан тул огноо үргэлж null ирж, `?? new Date()` fallback-аар
    // "одоо" цагаар орлуулагддаг байсан — 2026-09-02 засав).
    payment_date: string;
    payment_amount?: string;
    // "P2P" (банкны шилжүүлэг/QR) эсвэл "CARD" — баримт бичигт талбарын нэр
    // тодорхойгүй тул хоёр боломжит хувилбарыг аль алиныг нь уншина.
    payment_type?: string;
    transaction_type?: string;
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

    // Эмзэг утгуудыг тайлна (хуучин plaintext мөрийг ч дэмжинэ).
    const password = decryptSecret(settings.password);
    const accessToken = decryptSecret(settings.accessToken);
    const refreshToken = decryptSecret(settings.refreshToken);

    const now = Date.now();
    const accessValid =
      accessToken &&
      settings.tokenExpiresAt &&
      settings.tokenExpiresAt.getTime() - now > TOKEN_EXPIRY_BUFFER_MS;
    if (accessValid) {
      return {
        accessToken: accessToken!,
        expiresAt: settings.tokenExpiresAt!,
      };
    }

    const refreshValid =
      refreshToken &&
      settings.refreshTokenExpiresAt &&
      settings.refreshTokenExpiresAt.getTime() - now > TOKEN_EXPIRY_BUFFER_MS;
    if (refreshValid) {
      return refreshAccessToken(refreshToken!);
    }
    return fetchNewToken(settings.username, password ?? "");
  },

  /**
   * Шинэ invoice үүсгэнэ. `senderInvoiceNo` нь өөрийн SubscriptionPayment.id-г
   * QPay-руу дамжуулдаг түлхүүр. Хариунд QR image (base64) + invoice_id ирнэ.
   *
   * `allow_partial`/`allow_exceed`-ийг ЭНД тогтмол false тавьсан — доод тал нь
   * QPay-ийн invoice түвшинд дутуу/илүү дүнгээр "төлөгдсөн" гэж бүртгэгдэхээс
   * сэргийлнэ (дуудагч тал `checkPayment`-ийн `paidAmount`-ыг заавал expected-тэй
   * дахин тулгах ёстой хэвээр — QPay-ийн P2P (банкны шилжүүлэг) гүйлгээнд энэ
   * хязгаарлалт баталгаат биш байж болзошгүй тул).
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
        allow_partial: false,
        allow_exceed: false,
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

  /**
   * Invoice-ийн бүх гүйлгээг татаж, `expectedAmount`-той тулгана.
   *   - `paid`: PAID мөр байгаа БА нийт төлсөн дүн (`paidAmount`) >= expected.
   *   - `underpaidAmount`: 0 < paidAmount < expected үед л утгатай (дутуу
   *     төлбөр — Invoice ҮҮСГЭХГҮЙ, гагцхүү дуудагч тал "дутуу" гэж тэмдэглэнэ).
   *   - `paymentType`: PAID мөрийн P2P/CARD төрөл — буцаалт (refund) зөвхөн
   *     CARD-д л QPay API-аар боломжтой тул дуудагч тал үүгээр шийднэ.
   */
  async checkPayment(
    invoiceId: string,
    expectedAmount?: number,
  ): Promise<
    | {
        paid: boolean;
        paymentId: string | null;
        paidAt: Date | null;
        paidAmount: number;
        underpaidAmount: number | null;
        paymentType: string | null;
      }
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
        offset: { page_number: 1, page_limit: 100 },
      }),
    });
    if (!res.ok) {
      return { error: `QPay шалгалт алдаа: ${res.status}` };
    }
    const data = (await res.json()) as QPayCheckResponse;
    const paidRow = data.rows?.find((r) => r.payment_status === "PAID") ?? null;
    const paidAmount =
      typeof data.paid_amount === "number" ? data.paid_amount : 0;

    // Бүтэн эсэхийг ЭНД (lib түвшинд) дуудагч талд БҮГД өөрсдөө давхар шалгах
    // шаардлагагүй болгож нэгтгэсэн — expectedAmount өгөгдсөн бол ашиглана.
    const fullyPaid =
      Boolean(paidRow) &&
      (expectedAmount === undefined || paidAmount >= expectedAmount);
    const underpaidAmount =
      !fullyPaid && expectedAmount !== undefined && paidAmount > 0
        ? paidAmount
        : null;

    return {
      paid: fullyPaid,
      paymentId: paidRow?.payment_id ?? null,
      paidAt: paidRow?.payment_date ? new Date(paidRow.payment_date) : null,
      // QPay-аас бодитоор төлөгдсөн нийт дүн — дуудагч талд expected-тэй
      // тулгаж шалгана (хэсэгчилсэн төлбөрийг бүтэн гэж тооцохгүй).
      paidAmount,
      underpaidAmount,
      paymentType: paidRow?.payment_type ?? paidRow?.transaction_type ?? null,
    };
  },

  /**
   * Гүйлгээ цуцлах ("card reversal" — ихэвчлэн тухайн өдөрт нь, capture-аас
   * өмнө). ⚠️ QPay-ийн баримт бичигт зөвхөн КАРТЫН гүйлгээнд ажилладаг гэж
   * тодорхойлогдсон (P2P/банкны шилжүүлгээр төлсөн invoice-д ажиллахгүй байж
   * болзошгүй) — дуудахаасаа өмнө `checkPayment`-ийн `paymentType === "CARD"`
   * эсэхийг шалгасан байх ёстой.
   */
  async cancelPayment(
    paymentId: string,
    note?: string,
  ): Promise<{ ok: true } | { error: string }> {
    return deletePayment("cancel", paymentId, note);
  },

  /**
   * Төлбөр буцаах. ⚠️ QPay-ийн баримт бичигт зөвхөн КАРТЫН гүйлгээнд
   * ажилладаг гэж тодорхойлогдсон — P2P (банкны шилжүүлэг/QR)-ээр төлсөн
   * гүйлгээг ЭНЭ API-аар буцаах боломжгүй; тэдгээрийг гараар (банкны
   * шилжүүлгээр) буцааж, зөвхөн DB-д тэмдэглэнэ
   * (app/_actions/booking-revenue.ts-ийн refundAppointmentPaymentAction).
   */
  async refundPayment(
    paymentId: string,
    note?: string,
  ): Promise<{ ok: true } | { error: string }> {
    return deletePayment("refund", paymentId, note);
  },
};

/**
 * `cancel`/`refund` хоёул ижил хэлбэртэй: `DELETE /v2/payment/{action}/{id}`,
 * body `{ callback_url, note }`. QPay-ийн нийтэд нээлттэй баримт бичигт зөвхөн
 * cancel-ийн жишээ URL/body баталгаажсан (2026-09-02 судалгаагаар) — refund
 * ижил хэлбэртэй гэж таамаглаж хэрэгжүүлсэн тул PROD дээр эхлээд sandbox-д
 * туршиж баталгаажуулах шаардлагатай.
 */
async function deletePayment(
  action: "cancel" | "refund",
  paymentId: string,
  note?: string,
): Promise<{ ok: true } | { error: string }> {
  if (!paymentId) return { error: "payment_id шаардлагатай." };
  const tokenResult = await QPayService.getAccessToken();
  if ("error" in tokenResult) return { error: tokenResult.error };
  const settings = await prisma.qPaySettings.findUnique({ where: { id: 1 } });

  const res = await fetch(`${QPAY_URL}payment/${action}/${paymentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${tokenResult.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      callback_url: settings?.callbackUrl ?? undefined,
      note: note ?? undefined,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      error: `QPay ${action === "cancel" ? "цуцлахад" : "буцаахад"} алдаа: ${res.status} ${text}`,
    };
  }
  return { ok: true };
}
