import "server-only";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { QPayService } from "@/lib/qpay";
import { periodEndDate } from "@/lib/subscription";

export type ConfirmResult = { ok: boolean; paid: boolean; message?: string };

/**
 * QPay-аас тухайн SubscriptionPayment-ийн төлөвийг шалгаж, бүрэн төлөгдсөн бол
 * атомт байдлаар: хуучин TRIAL/ACTIVE sub-уудыг EXPIRED, шинэ ACTIVE sub үүсгэж,
 * tenant.plan-г sync, payment-ийг PAID болгоно. Дахин дуудсан ч idempotent —
 * web-ийн polling action болон QPay callback хоёулаа үүнийг дуудна.
 *
 * Тэмдэглэл: callback-аас ирсэн мэдээлэлд НАЙДАХГҮЙ — үргэлж QPay.checkPayment-ээр
 * бие даан баталгаажуулна. Тиймээс callback-ийг хэн ч дуудсан төлбөрийг хуурамчаар
 * баталгаажуулах боломжгүй.
 */
export async function confirmSubscriptionPayment(
  paymentId: string,
): Promise<ConfirmResult> {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) return { ok: false, paid: false, message: "Төлбөр олдсонгүй." };
  if (payment.status === "PAID") return { ok: true, paid: true };
  if (!payment.qpayInvoiceId) {
    return { ok: false, paid: false, message: "QPay invoice байхгүй." };
  }

  const check = await QPayService.checkPayment(payment.qpayInvoiceId);
  if ("error" in check) return { ok: false, paid: false, message: check.error };
  if (!check.paid) return { ok: true, paid: false };

  // Бодит төлсөн дүнг expected-тэй тулгана — хэсэгчилсэн төлбөрөөр багц
  // идэвхжихээс сэргийлнэ.
  if (new Prisma.Decimal(check.paidAmount).lt(payment.amount)) {
    return {
      ok: true,
      paid: false,
      message: "Төлбөр бүрэн төлөгдөөгүй байна. Дахин шалгана уу.",
    };
  }

  const start = check.paidAt ?? new Date();
  const end = periodEndDate(start, payment.period);

  try {
    await prisma.$transaction(async (tx) => {
      // Хэрэв өөр transaction-аар аль хэдийн PAID болсон бол давхар үүсгэхгүй.
      const fresh = await tx.subscriptionPayment.findUnique({
        where: { id: payment.id },
        select: { status: true },
      });
      if (fresh?.status === "PAID") return;

      await tx.subscription.updateMany({
        where: { tenantId: payment.tenantId, status: { in: ["TRIAL", "ACTIVE"] } },
        data: { status: "EXPIRED" },
      });
      const created = await tx.subscription.create({
        data: {
          tenantId: payment.tenantId,
          plan: payment.plan,
          status: "ACTIVE",
          startsAt: start,
          endsAt: end,
          amount: payment.amount,
          notes: `QPay төлбөр #${payment.id}`,
        },
        select: { id: true },
      });
      await tx.tenant.update({
        where: { id: payment.tenantId },
        data: { plan: payment.plan },
      });
      await tx.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          paidAt: start,
          qpayPaymentId: check.paymentId,
          createdSubscriptionId: created.id,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return { ok: false, paid: false, message: e.message };
    }
    return {
      ok: false,
      paid: false,
      message: e instanceof Error ? e.message : "Хадгалахад алдаа.",
    };
  }

  revalidatePath("/dashboard/settings/subscription");
  revalidatePath("/dashboard");
  return { ok: true, paid: true };
}
