"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { TenantQPayService } from "@/lib/qpay-tenant";

export type OrderPaymentActionState = {
  ok: boolean;
  message?: string;
  paymentId?: string;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Захиалгад QPay QR үүсгэнэ. Захиалгын дутуу үлдэгдэл (totalAmount - paidAmount)
 * хэмжээгээр invoice үүснэ.
 */
export async function createOrderQPayInvoiceAction(
  _prev: OrderPaymentActionState,
  formData: FormData,
): Promise<OrderPaymentActionState> {
  let user;
  try {
    user = await requireUser();
    if (!canCreate(user, "payments")) {
      return { ok: false, message: "Танд төлбөр үүсгэх эрх байхгүй." };
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const orderId = s(formData, "orderId");
  if (!orderId) return { ok: false, message: "Захиалга шаардлагатай." };

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, tenantId: user.tenantId },
    include: { customer: { select: { fullName: true } } },
  });
  if (!order) return { ok: false, message: "Захиалга олдсонгүй." };
  if (order.paymentStatus === "PAID") {
    return { ok: false, message: "Захиалга бүрэн төлөгдсөн." };
  }

  const total = order.totalAmount ?? new Prisma.Decimal(0);
  const paid = order.paidAmount ?? new Prisma.Decimal(0);
  const remaining = total.minus(paid);
  if (remaining.lte(0)) {
    return { ok: false, message: "Үлдэгдэл байхгүй." };
  }

  // Pending QR байвал дахин ашиглана
  const pending = await prisma.orderPayment.findFirst({
    where: { orderId, status: "PENDING", method: "QPAY" },
    orderBy: { createdAt: "desc" },
  });
  if (pending) {
    return { ok: true, paymentId: pending.id };
  }

  // SubscriptionPayment-тэй ижил pattern
  const payment = await prisma.orderPayment.create({
    data: {
      tenantId: user.tenantId,
      orderId,
      amount: remaining,
      method: "QPAY",
      status: "PENDING",
    },
    select: { id: true },
  });

  const inv = await TenantQPayService.createInvoice({
    tenantId: user.tenantId,
    senderInvoiceNo: payment.id,
    invoiceReceiverCode: order.customer.fullName,
    invoiceDescription: `Захиалга #${order.number}`,
    amount: Number.parseFloat(remaining.toString()),
  });
  if ("error" in inv) {
    await prisma.orderPayment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    return { ok: false, message: inv.error };
  }

  await prisma.orderPayment.update({
    where: { id: payment.id },
    data: {
      qpayInvoiceId: inv.invoice_id,
      qrText: inv.qr_text,
      qrImage: inv.qr_image,
    },
  });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "ServiceOrder",
    entityId: orderId,
    action: "PAYMENT_CHANGE",
    summary: `QPay QR үүсгэв · ${remaining.toString()}₮`,
    after: { paymentId: payment.id, amount: remaining.toString() },
  });

  revalidatePath(`/dashboard/orders/${orderId}`);
  return { ok: true, paymentId: payment.id };
}

/**
 * QPay-аас төлбөрийн төлөвийг шалгах. PAID болсон үед захиалгын
 * paymentStatus + paidAmount-ийг автоматаар шинэчилнэ.
 */
export async function checkOrderQPayPaymentAction(
  formData: FormData,
): Promise<{ ok: boolean; paid: boolean; message?: string }> {
  const user = await requireUser();
  if (!canEdit(user, "payments")) {
    return { ok: false, paid: false, message: "Эрх байхгүй." };
  }
  const paymentId = s(formData, "paymentId");
  if (!paymentId) return { ok: false, paid: false, message: "ID шаардлагатай." };

  const payment = await prisma.orderPayment.findFirst({
    where: { id: paymentId, tenantId: user.tenantId },
    include: { order: true },
  });
  if (!payment) return { ok: false, paid: false, message: "Төлбөр олдсонгүй." };
  if (payment.status === "PAID") {
    return { ok: true, paid: true };
  }
  if (!payment.qpayInvoiceId) {
    return { ok: false, paid: false, message: "QPay invoice байхгүй." };
  }

  const check = await TenantQPayService.checkPayment(
    user.tenantId,
    payment.qpayInvoiceId,
  );
  if ("error" in check) {
    return { ok: false, paid: false, message: check.error };
  }
  if (!check.paid) {
    return { ok: true, paid: false };
  }

  // PAID — захиалгын төлбөрийн төлөвийг шинэчлэх
  const paidAt = check.paidAt ?? new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.orderPayment.findUnique({
        where: { id: payment.id },
        select: { status: true },
      });
      if (fresh?.status === "PAID") return;

      await tx.orderPayment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          paidAt,
          qpayPaymentId: check.paymentId,
        },
      });

      // Захиалгын paidAmount/paymentStatus-ийг шинэчлэх
      const total = payment.order.totalAmount ?? new Prisma.Decimal(0);
      const prevPaid = payment.order.paidAmount ?? new Prisma.Decimal(0);
      const newPaid = prevPaid.plus(payment.amount);
      const nextStatus = newPaid.gte(total) ? "PAID" : "PARTIAL";

      await tx.serviceOrder.update({
        where: { id: payment.orderId },
        data: {
          paidAmount: newPaid,
          paymentStatus: nextStatus,
          paidAt: nextStatus === "PAID" ? paidAt : null,
        },
      });

      await logAudit(
        {
          tenantId: user.tenantId,
          userId: user.id,
          entity: "ServiceOrder",
          entityId: payment.orderId,
          action: "PAYMENT_CHANGE",
          summary: `QPay PAID · ${payment.amount.toString()}₮ → ${nextStatus}`,
          after: {
            paymentId: payment.id,
            qpayPaymentId: check.paymentId,
            newPaidAmount: newPaid.toString(),
            paymentStatus: nextStatus,
          },
        },
        tx,
      );
    });
  } catch (e) {
    return {
      ok: false,
      paid: false,
      message: e instanceof Error ? e.message : "Хадгалахад алдаа.",
    };
  }

  revalidatePath(`/dashboard/orders/${payment.orderId}`);
  return { ok: true, paid: true };
}

export async function cancelOrderQPayPaymentAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  if (!canDelete(user, "payments")) return;
  const paymentId = s(formData, "paymentId");
  if (!paymentId) return;
  await prisma.orderPayment.updateMany({
    where: {
      id: paymentId,
      tenantId: user.tenantId,
      status: "PENDING",
    },
    data: { status: "CANCELLED" },
  });
  const p = await prisma.orderPayment.findFirst({
    where: { id: paymentId },
    select: { orderId: true },
  });
  if (p) revalidatePath(`/dashboard/orders/${p.orderId}`);
}
