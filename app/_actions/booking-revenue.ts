"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/system";
import { prisma } from "@/lib/prisma";
import { QPayService } from "@/lib/qpay";

export type RefundActionState = {
  ok: boolean;
  message?: string;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * SuperAdmin цаг захиалгын хураамжийг буцаана. QPay-ийн refund/cancel API нь
 * ЗӨВХӨН картын гүйлгээнд ажилладаг тул `paymentType === "CARD"` бол QPay-аар
 * бодитоор буцаана; бусад тохиолдолд (P2P — банкны шилжүүлэг/QR, өнөөдрийн
 * платформ дээрх гол хэлбэр) API дуудахгүй — гараар (банкны шилжүүлгээр)
 * буцаасныг л DB-д тэмдэглэнэ.
 */
export async function refundAppointmentPaymentAction(
  _prev: RefundActionState,
  formData: FormData,
): Promise<RefundActionState> {
  const admin = await requireSuperAdmin();

  const paymentId = s(formData, "paymentId");
  const note = s(formData, "note");
  if (!paymentId) return { ok: false, message: "ID шаардлагатай." };
  if (!note) {
    return { ok: false, message: "Буцаах шалтгаан/тэмдэглэл заавал бөглөнө." };
  }

  const payment = await prisma.appointmentPayment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) return { ok: false, message: "Төлбөр олдсонгүй." };
  if (payment.status === "REFUNDED") {
    return { ok: false, message: "Энэ төлбөр аль хэдийн буцаагдсан." };
  }

  if (payment.paymentType === "CARD" && payment.qpayPaymentId) {
    const result = await QPayService.refundPayment(payment.qpayPaymentId, note);
    if ("error" in result) {
      return {
        ok: false,
        message: `QPay-аар буцаах амжилтгүй: ${result.error}`,
      };
    }
  }

  await prisma.appointmentPayment.update({
    where: { id: payment.id },
    data: {
      status: "REFUNDED",
      refundedAt: new Date(),
      refundNote: note,
      refundedById: admin.id,
    },
  });

  revalidatePath("/system/booking-revenue");
  return {
    ok: true,
    message:
      payment.paymentType === "CARD"
        ? "QPay-аар амжилттай буцаагдлаа."
        : "Гараар буцаасан гэж тэмдэглэгдлээ.",
  };
}
