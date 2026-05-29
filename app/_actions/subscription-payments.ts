"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QPayService } from "@/lib/qpay";
import {
  BILLING_PERIOD_LABEL,
  PLAN_LABEL,
  periodEndDate,
} from "@/lib/subscription";

export type PaymentActionState = {
  ok: boolean;
  message?: string;
  paymentId?: string;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Тенант OWNER нь PlanPrice сонгоод төлбөр үүсгэнэ. SubscriptionPayment(PENDING)
 * + QPay invoice үүсгэнэ. QR + payment-н id-г буцаана. UI нь шалгуурын polling
 * хийж PAID болсон үед subscription идэвхжүүлнэ.
 */
export async function createSubscriptionPaymentAction(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const user = await requireUser();
  if (!user.isOwner) {
    return { ok: false, message: "Зөвхөн админ багц авна." };
  }

  const planPriceId = s(formData, "planPriceId");
  if (!planPriceId) return { ok: false, message: "Үнэ сонгоно уу." };

  const price = await prisma.planPrice.findFirst({
    where: { id: planPriceId, isActive: true },
  });
  if (!price) {
    return { ok: false, message: "Сонгосон үнэ олдсонгүй / идэвхгүй." };
  }

  // FREE plan-ыг худалдан авах боломжгүй — энэ нь зөвхөн signup үед 14 хоногийн
  // нэг удаагийн туршилт хэлбэрээр үүсдэг.
  if (price.plan === "FREE") {
    return {
      ok: false,
      message:
        "Энгийн (FREE) багц нь зөвхөн бүртгүүлэх үед нэг удаагийн туршилт. Худалдаж авах боломжгүй.",
    };
  }

  // Snapshot + payment үүсгэх
  const amountNumber = Number.parseFloat(price.amount.toString());
  const payment = await prisma.subscriptionPayment.create({
    data: {
      tenantId: user.tenantId,
      plan: price.plan,
      period: price.period,
      amount: price.amount,
      currency: price.currency,
      planPriceId: price.id,
      method: "QPAY",
      status: "PENDING",
    },
    select: { id: true },
  });

  // QPay invoice үүсгэх
  const inv = await QPayService.createInvoice({
    senderInvoiceNo: payment.id,
    invoiceReceiverCode: user.tenantId,
    invoiceDescription: `${PLAN_LABEL[price.plan]} · ${BILLING_PERIOD_LABEL[price.period]}`,
    amount: amountNumber,
  });
  if ("error" in inv) {
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    return { ok: false, message: inv.error };
  }

  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      qpayInvoiceId: inv.invoice_id,
      qrText: inv.qr_text,
      qrImage: inv.qr_image,
    },
  });

  revalidatePath("/dashboard/settings/subscription");
  return { ok: true, paymentId: payment.id };
}

/**
 * UI-аас тогтмол дуудна — QPay-аас тус payment-ийн төлөв шалгаж, PAID болсон
 * үед subscription үүсгэж payment-ийг шинэчилнэ. Дахин дуудсан ч idempotent.
 *
 * Form fields: paymentId
 */
export async function checkSubscriptionPaymentAction(
  formData: FormData,
): Promise<{ ok: boolean; paid: boolean; message?: string }> {
  const user = await requireUser();
  const paymentId = s(formData, "paymentId");
  if (!paymentId) return { ok: false, paid: false, message: "ID шаардлагатай." };

  const payment = await prisma.subscriptionPayment.findFirst({
    where: { id: paymentId, tenantId: user.tenantId },
  });
  if (!payment) return { ok: false, paid: false, message: "Төлбөр олдсонгүй." };

  if (payment.status === "PAID") {
    return { ok: true, paid: true };
  }
  if (!payment.qpayInvoiceId) {
    return { ok: false, paid: false, message: "QPay invoice байхгүй." };
  }

  const check = await QPayService.checkPayment(payment.qpayInvoiceId);
  if ("error" in check) {
    return { ok: false, paid: false, message: check.error };
  }
  if (!check.paid) {
    return { ok: true, paid: false };
  }

  // PAID — атомт: payment update + хуучин active sub-уудыг EXPIRED + шинэ ACTIVE
  // sub үүсгэх + tenant.plan sync.
  const start = check.paidAt ?? new Date();
  const end = periodEndDate(start, payment.period);

  try {
    await prisma.$transaction(async (tx) => {
      // Хэрэв өөр transaction-аар аль хэдийн PAID болсон бол үлдээнэ
      const fresh = await tx.subscriptionPayment.findUnique({
        where: { id: payment.id },
        select: { status: true, createdSubscriptionId: true },
      });
      if (fresh?.status === "PAID") return;

      await tx.subscription.updateMany({
        where: {
          tenantId: user.tenantId,
          status: { in: ["TRIAL", "ACTIVE"] },
        },
        data: { status: "EXPIRED" },
      });
      const created = await tx.subscription.create({
        data: {
          tenantId: user.tenantId,
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
        where: { id: user.tenantId },
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

/**
 * Хэрэглэгч QR-ыг хаах үед PENDING-ийг CANCELLED болгоно.
 */
export async function cancelSubscriptionPaymentAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const paymentId = s(formData, "paymentId");
  if (!paymentId) return;
  await prisma.subscriptionPayment.updateMany({
    where: {
      id: paymentId,
      tenantId: user.tenantId,
      status: "PENDING",
    },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/dashboard/settings/subscription");
}
