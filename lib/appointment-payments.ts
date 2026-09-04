import "server-only";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { formatWhen } from "@/lib/appointments";
import { notifyStaff } from "@/lib/notifications";
import { getPlatformSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { QPayService, type QPayBankUrl } from "@/lib/qpay";
import { getAppBaseUrl } from "@/lib/subscription-server";

/**
 * Цаг захиалгын хураамж — эцсийн хэрэглэгч (Account) захиалахдаа QPay-ээр
 * төлдөг, платформын (SuperAdmin) орлого. Дүн/идэвхтэй эсэхийг super admin
 * `/system/settings`-ээс тохируулна (PlatformSetting.appointmentFee*).
 *
 * Архитектур: явцад буй (төлөгдөөгүй) QPay checkout-ийг `Appointment.fee*`
 * талбарууд дээр хөтөлнө (`ensureAppointmentFeeCheckout`/
 * `retryAppointmentFeeCheckout`) — DB-д "Invoice" гэж тооцогдохгүй.
 * `AppointmentPayment` мөр (жинхэнэ Invoice) ЗӨВХӨН QPay-аас "PAID" гэж
 * баталгаажсаны дараа (`confirmAppointmentPayment`) л үүсч, тэр даруй тенант
 * рүү мэдэгдэл очно.
 */
export const BOOKING_FEE_CURRENCY = "MNT";

type CheckoutResult =
  | { ok: true; required: false } // хураамж идэвхгүй — үнэгүй, checkout хэрэггүй
  | { ok: true; required: true } // QPay invoice амжилттай татагдсан (эсвэл өмнө нь бэлэн/төлөгдсөн)
  | { ok: false; required: true; error: string }; // invoice татахад алдаа гарсан

export type AppointmentFeeStatus = "PENDING" | "PAID" | "UNDERPAID" | "FAILED";

export type AppointmentFeeInfo = {
  status: AppointmentFeeStatus;
  amount: number;
  currency: string;
  qrImage: string | null;
  qrText: string | null;
  urls: QPayBankUrl[];
  underpaidAmount: number | null;
} | null;

/**
 * Appointment.fee* (явцад буй checkout) + payment (эцсийн Invoice)-ийг нэг
 * API-д ойлгомжтой хэлбэрт (`AppointmentFeeInfo`) хувиргана. Web (pay page,
 * account list) болон mobile API (/api/v1/app/appointments*) хоёулаа
 * ашиглана — хураамжийн UI логикийг нэг цэгт төвлөрүүлнэ.
 */
export function serializeAppointmentFee(appt: {
  feeAmount: Prisma.Decimal | null;
  feeCurrency: string | null;
  feeQpayInvoiceId: string | null;
  feeQrImage: string | null;
  feeQrText: string | null;
  feeQpayUrls: Prisma.JsonValue | null;
  feeUnderpaidAmount: Prisma.Decimal | null;
  payment: { amount: Prisma.Decimal; currency: string } | null;
}): AppointmentFeeInfo {
  if (appt.payment) {
    return {
      status: "PAID",
      amount: Number.parseFloat(appt.payment.amount.toString()),
      currency: appt.payment.currency,
      qrImage: null,
      qrText: null,
      urls: [],
      underpaidAmount: null,
    };
  }
  if (!appt.feeAmount) return null; // хураамж шаардлагагүй (үнэгүй/идэвхгүй үед захиалсан)

  const amount = Number.parseFloat(appt.feeAmount.toString());
  const currency = appt.feeCurrency ?? BOOKING_FEE_CURRENCY;
  const urls = Array.isArray(appt.feeQpayUrls)
    ? (appt.feeQpayUrls as unknown as QPayBankUrl[])
    : [];

  if (appt.feeUnderpaidAmount != null) {
    return {
      status: "UNDERPAID",
      amount,
      currency,
      qrImage: appt.feeQrImage,
      qrText: appt.feeQrText,
      urls,
      underpaidAmount: Number.parseFloat(appt.feeUnderpaidAmount.toString()),
    };
  }
  if (appt.feeQpayInvoiceId) {
    return {
      status: "PENDING",
      amount,
      currency,
      qrImage: appt.feeQrImage,
      qrText: appt.feeQrText,
      urls,
      underpaidAmount: null,
    };
  }
  // feeAmount тавигдсан ч invoice татагдаагүй (эсвэл алдаа өгсөн) — дахин оролдоно.
  return {
    status: "FAILED",
    amount,
    currency,
    qrImage: null,
    qrText: null,
    urls: [],
    underpaidAmount: null,
  };
}

/** QPay-аас invoice татаж Appointment.fee* талбарт хадгална (checkout — Invoice биш). */
async function requestFeeCheckout(
  appointmentId: string,
  accountId: string,
  amount: number,
  tenantName: string,
): Promise<CheckoutResult> {
  const inv = await QPayService.createInvoice({
    senderInvoiceNo: appointmentId,
    invoiceReceiverCode: accountId,
    invoiceDescription: `Цаг захиалгын хураамж · ${tenantName}`,
    amount,
    callbackUrl: `${getAppBaseUrl()}/api/v1/appointments/qpay/callback?appointment_id=${appointmentId}`,
  });

  if ("error" in inv) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        feeAmount: amount,
        feeCurrency: BOOKING_FEE_CURRENCY,
        feeQpayInvoiceId: null,
        feeQrImage: null,
        feeQrText: null,
        feeQpayUrls: Prisma.JsonNull,
      },
    });
    return { ok: false, required: true, error: inv.error };
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      feeAmount: amount,
      feeCurrency: BOOKING_FEE_CURRENCY,
      feeQpayInvoiceId: inv.invoice_id,
      feeQrText: inv.qr_text,
      feeQrImage: inv.qr_image,
      feeQpayUrls: inv.urls ?? Prisma.JsonNull,
    },
  });
  return { ok: true, required: true };
}

/**
 * Хэрэглэгч (Account) онлайн цаг захиалахад дуудагдана (`createAppointment`).
 * Super admin хураамжийг идэвхгүй болгосон бол (`appointmentFeeEnabled=false`)
 * үнэгүй — checkout эхлүүлэхгүй. Идэвхтэй бол одоогийн тохируулсан дүнгээр
 * QPay invoice татаж Appointment.fee*-д хадгална. QPay доголдвол ч энэ функц
 * алдаа шидэхгүй — дуудагч тал try/catch-аар аль хэдийн хамгаалсан (захиалга
 * үүсэхийг тасалдуулахгүйн тулд); fee талбарууд invoice-гүйгээр үлдэж дараа
 * дахин оролдох боломжтой.
 */
export async function ensureAppointmentFeeCheckout(
  appointmentId: string,
): Promise<CheckoutResult> {
  const settings = await getPlatformSettings();
  if (!settings.appointmentFeeEnabled || settings.appointmentFeeAmount <= 0) {
    return { ok: true, required: false };
  }

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      accountId: true,
      tenant: { select: { name: true } },
      feeQpayInvoiceId: true,
      payment: { select: { id: true } },
    },
  });
  if (!appt || !appt.accountId) {
    return { ok: false, required: true, error: "Онлайн цаг захиалга олдсонгүй." };
  }
  if (appt.payment || appt.feeQpayInvoiceId) {
    return { ok: true, required: true }; // idempotent — аль хэдийн төлөгдсөн/QR бэлэн
  }

  return requestFeeCheckout(
    appt.id,
    appt.accountId,
    settings.appointmentFeeAmount,
    appt.tenant.name,
  );
}

/**
 * Account-аас дахин оролдох (invoice татах үед доголдсон тохиолдолд). Одоо
 * тохируулсан дүнгээр (тохиргоо солигдсон байж болзошгүй тул анхныхаар биш)
 * дахин QPay invoice татна.
 */
export async function retryAppointmentFeeCheckout(
  appointmentId: string,
): Promise<CheckoutResult> {
  const settings = await getPlatformSettings();
  if (!settings.appointmentFeeEnabled || settings.appointmentFeeAmount <= 0) {
    return { ok: true, required: false };
  }

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      accountId: true,
      tenant: { select: { name: true } },
      payment: { select: { id: true } },
    },
  });
  if (!appt || !appt.accountId) {
    return { ok: false, required: true, error: "Онлайн цаг захиалга олдсонгүй." };
  }
  if (appt.payment) return { ok: true, required: true }; // аль хэдийн төлөгдсөн

  return requestFeeCheckout(
    appt.id,
    appt.accountId,
    settings.appointmentFeeAmount,
    appt.tenant.name,
  );
}

/**
 * QPay-аас тухайн appointment-ийн checkout (Appointment.feeQpayInvoiceId)
 * төлөгдсөн эсэхийг шалгана. Бүрэн төлөгдсөн бол ЗӨВХӨН ЭНД —
 * `AppointmentPayment` (Invoice) мөр анх удаа үүсч, тенант рүү мэдэгдэл
 * очно. Callback-ийн агуулгад найдахгүй — үргэлж QPay.checkPayment-ээр бие
 * даан баталгаажуулна (subscription-payments-тэй адил зарчим). Дахин
 * дуудсан ч idempotent (unique appointmentId constraint дээр тулгуурлана —
 * webhook + polling зэрэг ирсэн ч давхар Invoice/мэдэгдэл үүсэхгүй).
 */
export async function confirmAppointmentPayment(
  appointmentId: string,
): Promise<{
  ok: boolean;
  paid: boolean;
  message?: string;
  underpaidAmount?: number;
}> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      tenantId: true,
      branchId: true,
      accountId: true,
      feeAmount: true,
      feeCurrency: true,
      feeQpayInvoiceId: true,
      requestedAt: true,
      payment: { select: { id: true } },
      account: { select: { name: true, phone: true } },
    },
  });
  if (!appt) return { ok: false, paid: false, message: "Цаг захиалга олдсонгүй." };
  if (appt.payment) return { ok: true, paid: true }; // idempotent — аль хэдийн Invoice үүссэн
  if (!appt.feeQpayInvoiceId || !appt.accountId || !appt.feeAmount) {
    return { ok: false, paid: false, message: "QPay invoice байхгүй." };
  }

  const expectedAmount = Number.parseFloat(appt.feeAmount.toString());
  const check = await QPayService.checkPayment(
    appt.feeQpayInvoiceId,
    expectedAmount,
  );
  if ("error" in check) return { ok: false, paid: false, message: check.error };

  if (!check.paid) {
    if (check.underpaidAmount != null) {
      // Дутуу төлбөр — Invoice ҮҮСГЭХГҮЙ, зөвхөн Appointment дээр тэмдэглэж
      // account/ажилтанд харагдуулна (pay хуудас "Дутуу төлсөн: X/Y₮" гэж
      // харуулна). Дараа нь дутууг нөхөж бүрэн төлвөл цэвэрлэгдэнэ.
      await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          feeUnderpaidAmount: check.underpaidAmount,
          feeUnderpaidAt: new Date(),
        },
      });
      return {
        ok: true,
        paid: false,
        underpaidAmount: check.underpaidAmount,
        message: `Дутуу төлбөр: ${check.underpaidAmount.toLocaleString("mn-MN")}₮ / ${expectedAmount.toLocaleString("mn-MN")}₮ ирсэн. Үлдэгдлийг нөхөж төлнө үү.`,
      };
    }
    return { ok: true, paid: false };
  }

  try {
    await prisma.appointmentPayment.create({
      data: {
        appointmentId: appt.id,
        tenantId: appt.tenantId,
        accountId: appt.accountId,
        amount: appt.feeAmount,
        currency: appt.feeCurrency ?? BOOKING_FEE_CURRENCY,
        status: "PAID",
        qpayInvoiceId: appt.feeQpayInvoiceId,
        qpayPaymentId: check.paymentId,
        paymentType: check.paymentType,
        paidAt: check.paidAt ?? new Date(),
      },
    });
    // Өмнө нь "дутуу" тэмдэглэгдсэн байсан бол цэвэрлэнэ (одоо бүрэн төлөгдсөн).
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { feeUnderpaidAmount: null, feeUnderpaidAt: null },
    });
  } catch (e) {
    // Unique(appointmentId) зөрчил — webhook + polling зэрэг ирж өөр
    // transaction нь аль хэдийн үүсгэсэн. Idempotent-ээр амжилттай гэж үзнэ.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      revalidatePath("/account");
      return { ok: true, paid: true };
    }
    throw e;
  }

  // Тенант рүү шинэ цаг захиалгын мэдэгдэл — хураамж шаардлагатай захиалгад
  // үүсгэх үед биш, яг ЭНД (төлбөр баталгаажсаны дараа) л явна (харах:
  // createAppointment). Зөвхөн Invoice-ийг ЭНД шинээр үүсгэсэн дуудалт дээр
  // л илгээнэ (давхар мэдэгдэхгүй, дээрх P2002 замд орохгүй).
  try {
    const who = appt.account?.name?.trim() || appt.account?.phone || "Хэрэглэгч";
    await notifyStaff({
      type: "appointment_created",
      tenantId: appt.tenantId,
      branchId: appt.branchId,
      input: {
        appointmentId: appt.id,
        body: `${who} — ${formatWhen(appt.requestedAt)} цагт цаг захиаллаа.`,
      },
    });
  } catch (e) {
    console.warn("[notify] confirmAppointmentPayment:", e);
  }

  revalidatePath("/account");
  revalidatePath("/dashboard/appointments");
  return { ok: true, paid: true };
}
