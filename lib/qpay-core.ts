/**
 * QPay merchant HTTP клиентийн нийтлэг цөм — OAuth token амьдралын мөчлөг
 * (авах/сэргээх/кэш), invoice үүсгэх, төлбөр шалгах/цуцлах/буцаах.
 *
 * Платформ-level (`lib/qpay.ts`, `QPaySettings` singleton) болон tenant-level
 * (`lib/qpay-tenant.ts`, `TenantQPaySettings`) хоёулаа энэ нэг HTTP/token
 * логикийг ашигладаг тул `createQPayClient`-аар нэгтгэсэн — эх сурвалж нь
 * (`store`) л ялгаатай. `Id` нь тохиргоог таних түлхүүр: платформд `void`,
 * tenant-д `string` (tenantId).
 */

import { decryptSecret, encryptSecret } from "@/lib/crypto";

const QPAY_URL =
  process.env.QPAY_MERCHANT_URL ?? "https://merchant.qpay.mn/v2/";
const TOKEN_EXPIRY_BUFFER_MS = 30_000;

export type QPayBankUrl = {
  name: string;
  name_mn: string;
  logo: string;
  description: string;
  link: string;
};

export type QPayInvoiceCreated = {
  invoice_id: string;
  qr_text: string;
  qr_image: string; // base64 (without data: prefix)
  urls?: QPayBankUrl[]; // банкны апп руу шилжих deep link-үүд
};

// QPay-ийн бодит enum: NEW (эхлэн, төлөгдөөгүй), PAID, FAILED, REFUNDED.
// "PENDING" гэж ЭРГЭЖ ИРДЭГГҮЙ — хуучин код үүнийг андуурч бичсэн байсан
// (2026-09-02 засав, developer.qpay.mn v2.0.0 баримт бичгийг судалж
// баталгаажуулсан).
export type QPayPaymentStatus = "NEW" | "PAID" | "FAILED" | "REFUNDED";

export type QPayCheckResponse = {
  count: number;
  paid_amount: number | string;
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

export type QPayCheckResult =
  | {
      paid: boolean;
      paymentId: string | null;
      paidAt: Date | null;
      paidAmount: number;
      underpaidAmount: number | null;
      paymentType: string | null;
    }
  | { error: string };

/** Тохиргооны эх сурвалжид байх ёстой QPay-ийн нийтлэг талбарууд. */
export type QPayTokenFields = {
  username: string | null;
  password: string | null; // encrypted (эсвэл хуучин plaintext)
  invoiceCode: string | null;
  callbackUrl: string | null;
  accessToken: string | null; // encrypted
  refreshToken: string | null; // encrypted
  tokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
};

type TokenResult = { accessToken: string; expiresAt: Date } | { error: string };

/** `Id`-аар тохиргоо унших/хадгалах эх сурвалж (платформ singleton эсвэл tenant). */
export type QPayStore<Id, Settings extends QPayTokenFields = QPayTokenFields> = {
  getSettings(id: Id): Promise<Settings | null>;
  saveTokens(
    id: Id,
    tokens: {
      accessToken: string;
      refreshToken: string;
      tokenExpiresAt: Date;
      refreshTokenExpiresAt: Date;
    },
  ): Promise<void>;
  /** Тохиргоо олдсон ч ашиглах боломжгүй бол (жиш нь идэвхгүй) алдааны мессеж. */
  checkAvailable?(settings: Settings): string | null;
  messages: {
    notConfigured: string;
    incomplete: string;
  };
};

export function createQPayClient<Id, Settings extends QPayTokenFields = QPayTokenFields>(
  store: QPayStore<Id, Settings>,
) {
  async function saveTokens(
    id: Id,
    body: {
      access_token: string;
      refresh_token: string;
      expires_in: number; // QPay-ийн `expires_in` — Unix секунд
      refresh_expires_in: number;
    },
  ): Promise<{ accessToken: string; expiresAt: Date }> {
    const expiresAt = new Date(body.expires_in * 1000);
    await store.saveTokens(id, {
      accessToken: encryptSecret(body.access_token),
      refreshToken: encryptSecret(body.refresh_token),
      tokenExpiresAt: expiresAt,
      refreshTokenExpiresAt: new Date(body.refresh_expires_in * 1000),
    });
    // Шууд хэрэглэхэд plaintext-ийг буцаана (DB-д шифрлэгдсэн).
    return { accessToken: body.access_token, expiresAt };
  }

  async function fetchNewToken(
    id: Id,
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
    return saveTokens(id, await res.json());
  }

  async function refreshAccessToken(id: Id, refreshTkn: string): Promise<TokenResult> {
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
    return saveTokens(id, await res.json());
  }

  async function getAccessToken(id: Id): Promise<TokenResult> {
    const settings = await store.getSettings(id);
    if (!settings) return { error: store.messages.notConfigured };

    const unavailable = store.checkAvailable?.(settings);
    if (unavailable) return { error: unavailable };

    if (!settings.username || !settings.password || !settings.invoiceCode) {
      return { error: store.messages.incomplete };
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
      return { accessToken: accessToken!, expiresAt: settings.tokenExpiresAt! };
    }

    const refreshValid =
      refreshToken &&
      settings.refreshTokenExpiresAt &&
      settings.refreshTokenExpiresAt.getTime() - now > TOKEN_EXPIRY_BUFFER_MS;
    if (refreshValid) return refreshAccessToken(id, refreshToken!);

    return fetchNewToken(id, settings.username, password ?? "");
  }

  /**
   * Шинэ invoice үүсгэнэ. `senderInvoiceNo` нь дуудагч талын өөрийн
   * SubscriptionPayment/OrderPayment.id-г QPay-руу дамжуулдаг түлхүүр.
   * Хариунд QR image (base64) + invoice_id ирнэ.
   *
   * `allow_partial`/`allow_exceed`-ийг ЭНД тогтмол false тавьсан — доод тал нь
   * QPay-ийн invoice түвшинд дутуу/илүү дүнгээр "төлөгдсөн" гэж бүртгэгдэхээс
   * сэргийлнэ (дуудагч тал `checkPayment`-ийн `paidAmount`-ыг заавал expected-тэй
   * дахин тулгах ёстой хэвээр — QPay-ийн P2P (банкны шилжүүлэг) гүйлгээнд энэ
   * хязгаарлалт баталгаат биш байж болзошгүй тул).
   */
  async function createInvoice(args: {
    id: Id;
    senderInvoiceNo: string;
    invoiceReceiverCode: string;
    invoiceDescription: string;
    amount: number;
    callbackUrl?: string;
  }): Promise<QPayInvoiceCreated | { error: string }> {
    const tokenResult = await getAccessToken(args.id);
    if ("error" in tokenResult) return { error: tokenResult.error };
    const settings = await store.getSettings(args.id);
    if (!settings) return { error: store.messages.notConfigured };

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
      return { error: `QPay invoice үүсгэхэд алдаа: ${res.status} ${text}` };
    }
    return (await res.json()) as QPayInvoiceCreated;
  }

  /**
   * Үүсгэсэн invoice-ийн дэлгэрэнгүйг (банкны deeplink `urls` зэрэг) QPay-аас
   * дахин татна. invoice create-ийн хариунд urls ирээгүй, эсвэл хуучин код
   * хадгалаагүй pending төлбөрийн urls-ийг нөхөхөд хэрэглэнэ.
   */
  async function getInvoiceUrls(id: Id, invoiceId: string): Promise<QPayBankUrl[] | null> {
    if (!invoiceId) return null;
    const tokenResult = await getAccessToken(id);
    if ("error" in tokenResult) return null;

    const res = await fetch(`${QPAY_URL}invoice/${invoiceId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { urls?: QPayBankUrl[] };
    return Array.isArray(data.urls) ? data.urls : null;
  }

  /**
   * Invoice-ийн бүх гүйлгээг татаж, `expectedAmount`-той тулгана.
   *   - `paid`: PAID мөр байгаа БА (expectedAmount өгөгдөөгүй, эсвэл) нийт
   *     төлсөн дүн (`paidAmount`) >= expected.
   *   - `underpaidAmount`: 0 < paidAmount < expected үед л утгатай (дутуу
   *     төлбөр — дуудагч тал "дутуу" гэж тэмдэглэнэ).
   *   - `paymentType`: PAID мөрийн P2P/CARD төрөл — буцаалт (refund) зөвхөн
   *     CARD-д л QPay API-аар боломжтой тул дуудагч тал үүгээр шийднэ.
   */
  async function checkPayment(
    id: Id,
    invoiceId: string,
    expectedAmount?: number,
  ): Promise<QPayCheckResult> {
    if (!invoiceId) return { error: "invoice_id шаардлагатай." };
    const tokenResult = await getAccessToken(id);
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
    if (!res.ok) return { error: `QPay шалгалт алдаа: ${res.status}` };

    const data = (await res.json()) as QPayCheckResponse;
    const paidRow = data.rows?.find((r) => r.payment_status === "PAID") ?? null;
    const paidAmount = parseFloat(String(data.paid_amount ?? 0)) || 0;

    // Бүтэн эсэхийг ЭНД (core түвшинд) дуудагч талд БҮГД өөрсдөө давхар
    // шалгах шаардлагагүй болгож нэгтгэсэн — expectedAmount өгөгдсөн бол
    // ашиглана.
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
      paidAmount,
      underpaidAmount,
      paymentType: paidRow?.payment_type ?? paidRow?.transaction_type ?? null,
    };
  }

  /**
   * `cancel`/`refund` хоёул ижил хэлбэртэй: `DELETE /v2/payment/{action}/{id}`,
   * body `{ callback_url, note }`. QPay-ийн нийтэд нээлттэй баримт бичигт
   * зөвхөн cancel-ийн жишээ URL/body баталгаажсан (2026-09-02 судалгаагаар) —
   * refund ижил хэлбэртэй гэж таамаглаж хэрэгжүүлсэн тул PROD дээр эхлээд
   * sandbox-д туршиж баталгаажуулах шаардлагатай.
   *
   * ⚠️ QPay-ийн баримт бичигт зөвхөн КАРТЫН гүйлгээнд ажилладаг гэж
   * тодорхойлогдсон (P2P/банкны шилжүүлгээр төлсөн invoice-д ажиллахгүй
   * байж болзошгүй) — дуудахаасаа өмнө `checkPayment`-ийн
   * `paymentType === "CARD"` эсэхийг шалгасан байх ёстой.
   */
  async function deletePayment(
    id: Id,
    action: "cancel" | "refund",
    paymentId: string,
    note?: string,
  ): Promise<{ ok: true } | { error: string }> {
    if (!paymentId) return { error: "payment_id шаардлагатай." };
    const tokenResult = await getAccessToken(id);
    if ("error" in tokenResult) return { error: tokenResult.error };
    const settings = await store.getSettings(id);

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

  return {
    getAccessToken,
    createInvoice,
    getInvoiceUrls,
    checkPayment,
    cancelPayment: (id: Id, paymentId: string, note?: string) =>
      deletePayment(id, "cancel", paymentId, note),
    refundPayment: (id: Id, paymentId: string, note?: string) =>
      deletePayment(id, "refund", paymentId, note),
  };
}
