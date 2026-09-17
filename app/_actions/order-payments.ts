"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit } from "@/lib/auth/roles";
import { canEditOrder } from "@/lib/auth/order-access";
import { workingBranchScopeId } from "@/lib/auth/roles";
import { createNotification } from "@/lib/notifications";
import {
  ORDER_PAYMENT_METHODS,
  ORDER_PAYMENT_METHOD_LABEL,
  formatTugrik,
  type OrderPaymentMethod,
} from "@/lib/orders";
import {
  cancelOrderQPayInvoice,
  confirmOrderQPayPayment,
  createOrReuseOrderQPayInvoice,
} from "@/lib/order-payments";
import { prisma } from "@/lib/prisma";

// Төлбөр (бүтэн эсвэл хэсэгчилсэн) амжилттай бүртгэгдэхэд холбогдох цаг
// захиалгын account-д мэдэгдэнэ — `orders.ts`-ийн notifyOrderStatusChange-тэй
// адил зарчим (гуравдагч, appointment холбоогүй захиалганд алгасна).
async function notifyOrderPaymentReceived(
  orderId: string,
  amount: string,
): Promise<void> {
  try {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: { appointment: { select: { id: true, accountId: true } } },
    });
    if (!order?.appointment?.accountId) return;
    await createNotification({
      type: "order_payment_received",
      recipient: { accountId: order.appointment.accountId },
      input: { orderId, appointmentId: order.appointment.id, amount },
    });
  } catch (e) {
    console.warn("[notify] order_payment_received:", e);
  }
}

export type OrderPaymentActionState = {
  ok: boolean;
  message?: string;
  paymentId?: string;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function parseAmount(v: string): Prisma.Decimal | null {
  if (!v) return null;
  const cleaned = v.replace(/[,\s]/g, "");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Prisma.Decimal(cleaned);
}

async function canEditOrderForUser(user: Awaited<ReturnType<typeof requireUser>>, orderId: string) {
  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, tenantId: user.tenantId },
    select: { assignedToId: true, branchId: true },
  });
  if (!order) return false;
  const branch = workingBranchScopeId(user);
  return (!branch || branch === order.branchId) && canEditOrder(user, order);
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
  if (!orderId) return { ok: false, message: "Засварын хуудас шаардлагатай." };

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, tenantId: user.tenantId },
    include: { customer: { select: { fullName: true, phone: true } } },
  });
  if (!order) return { ok: false, message: "Засварын хуудас олдсонгүй." };
  if (!(await canEditOrderForUser(user, orderId))) return { ok: false, message: "Танд энэ төлбөрийг засах эрх байхгүй." };

  // Invoice үүсгэх/дахин ашиглах логик хуваалцсан цөмд шилжсэн — мөн
  // app/api/v1/orders/[id]/qpay/route.ts-ийн POST (мобайл клиент) дуудна
  // (харах: lib/order-payments.ts-ийн comment).
  const result = await createOrReuseOrderQPayInvoice(user.tenantId, user.id, order);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath(`/dashboard/orders/${orderId}`);
  return { ok: true, paymentId: result.payment.id };
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

  const paymentRow = await prisma.orderPayment.findFirst({
    where: { id: paymentId, tenantId: user.tenantId },
    select: { orderId: true },
  });
  if (!paymentRow) return { ok: false, paid: false, message: "Төлбөр олдсонгүй." };
  if (!(await canEditOrderForUser(user, paymentRow.orderId))) {
    return { ok: false, paid: false, message: "Танд энэ төлбөрийг засах эрх байхгүй." };
  }

  // Жинхэнэ QPay шалгалт + PAID болгох логик хуваалцсан цөмд шилжсэн — мөн энэ
  // action-ийн dashboard-ийн хажуугаар app/api/v1/orders/[id]/qpay/check/route.ts
  // (мобайл клиент) дуудна (харах: lib/order-payments.ts-ийн comment).
  const result = await confirmOrderQPayPayment(user.tenantId, user.id, paymentId);
  if (!result.ok) return { ok: false, paid: false, message: result.message };
  if (!result.paid) return { ok: true, paid: false, message: result.message };

  await notifyOrderPaymentReceived(result.orderId, result.amount);

  revalidatePath(`/dashboard/orders/${result.orderId}`);
  return { ok: true, paid: true };
}

export async function cancelOrderQPayPaymentAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  if (!canDelete(user, "payments")) return;
  const paymentId = s(formData, "paymentId");
  if (!paymentId) return;

  const paymentRow = await prisma.orderPayment.findFirst({
    where: { id: paymentId, tenantId: user.tenantId, status: "PENDING" },
    select: { orderId: true },
  });
  if (!paymentRow) return;
  if (!(await canEditOrderForUser(user, paymentRow.orderId))) return;

  const result = await cancelOrderQPayInvoice(user.tenantId, user.id, paymentId);
  if (!result.ok) return;

  revalidatePath(`/dashboard/orders/${result.orderId}`);
}

/**
 * Аль хэдийн хүлээн авсан төлбөрийг гараар бүртгэнэ (Бэлэн/Дансаар/Карт,
 * шаардлагатай бол QPay-г ч мөн — жишээ нь өөр сувгаар баталгаажсан бол).
 * QPay-ийн шууд QR урсгалаас ялгаатай нь: даруй "Төлөгдсөн" төлөвөөр
 * бүртгэгдэнэ (invoice/webhook хүлээхгүй). Захиалгын paidAmount-д НЭМЖ
 * (шинэ absolute утга биш), олон аргаар хуваасан төлбөрийг зөв нэгтгэнэ.
 */
export async function recordOrderPaymentAction(
  _prev: OrderPaymentActionState,
  formData: FormData,
): Promise<OrderPaymentActionState> {
  let user;
  try {
    user = await requireUser();
    if (!canCreate(user, "payments")) {
      return { ok: false, message: "Танд төлбөр бүртгэх эрх байхгүй." };
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const orderId = s(formData, "orderId");
  if (!orderId) return { ok: false, message: "Засварын хуудас шаардлагатай." };

  const methodRaw = s(formData, "method");
  if (!(ORDER_PAYMENT_METHODS as readonly string[]).includes(methodRaw)) {
    return { ok: false, message: "Төлбөрийн арга буруу." };
  }
  const method = methodRaw as OrderPaymentMethod;

  const amount = parseAmount(s(formData, "amount"));
  if (!amount) return { ok: false, message: "Дүнг зөв оруулна уу." };

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, tenantId: user.tenantId },
    select: { totalAmount: true, paidAmount: true },
  });
  if (!order) return { ok: false, message: "Засварын хуудас олдсонгүй." };
  if (!(await canEditOrderForUser(user, orderId))) return { ok: false, message: "Танд энэ төлбөрийг засах эрх байхгүй." };

  const total = order.totalAmount ?? new Prisma.Decimal(0);
  const prevPaid = order.paidAmount ?? new Prisma.Decimal(0);
  const remaining = total.minus(prevPaid);
  if (remaining.lte(0)) {
    return { ok: false, message: "Энэ захиалга бүрэн төлөгдсөн байна." };
  }
  if (amount.gt(remaining)) {
    return {
      ok: false,
      message: `Дүн үлдэгдэл (${formatTugrik(remaining.toString())})-ээс их байж болохгүй.`,
    };
  }

  const paidAt = new Date();
  const newPaid = prevPaid.plus(amount);
  const nextStatus = newPaid.gte(total) ? "PAID" : "PARTIAL";

  let paymentId: string;
  try {
    paymentId = await prisma.$transaction(async (tx) => {
      const payment = await tx.orderPayment.create({
        data: {
          tenantId: user.tenantId,
          orderId,
          amount,
          method,
          status: "PAID",
          paidAt,
        },
        select: { id: true },
      });

      await tx.serviceOrder.update({
        where: { id: orderId },
        data: {
          paidAmount: newPaid,
          paymentStatus: nextStatus,
          paidAt: nextStatus === "PAID" ? paidAt : null,
        },
      });

      // Үлдэгдэл өөрчлөгдсөн тул хуучин (буруу дүнтэй) хүлээгдэж буй QPay
      // QR-ийг хүчингүй болгоно — дараа нь шинэ үлдэгдлээр дахин үүсгэнэ.
      await tx.orderPayment.updateMany({
        where: { orderId, status: "PENDING", method: "QPAY" },
        data: { status: "CANCELLED" },
      });

      await logAudit(
        {
          tenantId: user.tenantId,
          userId: user.id,
          entity: "ServiceOrder",
          entityId: orderId,
          action: "PAYMENT_CHANGE",
          summary: `${ORDER_PAYMENT_METHOD_LABEL[method]} · ${formatTugrik(amount.toString())} бүртгэв`,
          after: {
            paymentId: payment.id,
            method,
            amount: amount.toString(),
            newPaidAmount: newPaid.toString(),
            paymentStatus: nextStatus,
          },
        },
        tx,
      );

      return payment.id;
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Хадгалахад алдаа.",
    };
  }

  await notifyOrderPaymentReceived(orderId, amount.toString());

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/orders");
  return { ok: true, paymentId };
}

/**
 * Гараар (эсвэл QPay) бүртгэсэн "Төлөгдсөн" төлбөрийн мөрийг цуцлана (буруу
 * бүртгэсэн үед засах зориулалттай) — мөрийг УСТГАХГҮЙ (санхүүгийн түүх),
 * зөвхөн CANCELLED болгож захиалгын paidAmount-аас хасна.
 */
export async function reverseOrderPaymentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!canDelete(user, "payments")) return;
  const paymentId = s(formData, "paymentId");
  if (!paymentId) return;

  const payment = await prisma.orderPayment.findFirst({
    where: { id: paymentId, tenantId: user.tenantId, status: "PAID" },
    select: { id: true, orderId: true, amount: true, method: true },
  });
  if (!payment) return;
  if (!(await canEditOrderForUser(user, payment.orderId))) return;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.orderPayment.updateMany({
      where: { id: payment.id, status: "PAID" },
      data: { status: "CANCELLED" },
    });
    if (updated.count === 0) return;

    const order = await tx.serviceOrder.findUniqueOrThrow({
      where: { id: payment.orderId },
      select: { totalAmount: true, paidAmount: true },
    });
    const total = order.totalAmount ?? new Prisma.Decimal(0);
    const prevPaid = order.paidAmount ?? new Prisma.Decimal(0);
    const rawNewPaid = prevPaid.minus(payment.amount);
    const newPaid = rawNewPaid.lt(0) ? new Prisma.Decimal(0) : rawNewPaid;
    const nextStatus = newPaid.lte(0) ? "UNPAID" : newPaid.gte(total) ? "PAID" : "PARTIAL";

    await tx.serviceOrder.update({
      where: { id: payment.orderId },
      data: {
        paidAmount: nextStatus === "UNPAID" ? null : newPaid,
        paymentStatus: nextStatus,
        paidAt: nextStatus === "PAID" ? new Date() : null,
      },
    });

    // Үлдэгдэл өөрчлөгдсөн (нэмэгдсэн) тул хуучин (буруу дүнтэй) хүлээгдэж
    // буй QPay QR-ийг хүчингүй болгоно — дараа нь шинэ үлдэгдлээр дахин
    // үүсгэнэ.
    await tx.orderPayment.updateMany({
      where: { orderId: payment.orderId, status: "PENDING", method: "QPAY" },
      data: { status: "CANCELLED" },
    });

    await logAudit(
      {
        tenantId: user.tenantId,
        userId: user.id,
        entity: "ServiceOrder",
        entityId: payment.orderId,
        action: "PAYMENT_CHANGE",
        summary: `${ORDER_PAYMENT_METHOD_LABEL[payment.method] ?? payment.method} · ${formatTugrik(payment.amount.toString())} бүртгэлийг цуцлав`,
        after: {
          paymentId: payment.id,
          status: "CANCELLED",
          newPaidAmount: newPaid.toString(),
          paymentStatus: nextStatus,
        },
      },
      tx,
    );
  });

  revalidatePath(`/dashboard/orders/${payment.orderId}`);
  revalidatePath("/dashboard/orders");
}
