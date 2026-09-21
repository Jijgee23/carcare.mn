import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { canEditOrder, canViewOrder, type OrderAccessUser } from "@/lib/auth/order-access";
import { isOrderBranchInScope, OrderCommandError, type OrderCommandScope } from "@/lib/orders/order-commands";
import {
  ORDER_PAYMENT_METHODS,
  ORDER_PAYMENT_METHOD_LABEL,
  formatTugrik,
  type OrderPaymentMethod,
} from "@/lib/orders";
import { withOrderTransaction } from "@/lib/order-time-booking";
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import { TenantQPayService } from "@/lib/qpay-tenant";
import { createNotification } from "@/lib/notifications";

export type OrderPaymentCommandActor = OrderAccessUser & {
  tenantId: string;
  branchId?: string | null;
  assignableBranchIds?: string[];
  workingBranchId?: string | null;
};

export type AnyOrderPaymentMethod = OrderPaymentMethod | "OTHER";

export class OrderPaymentCommandError extends OrderCommandError {
  constructor(message: string, status = 422, code = "ORDER_PAYMENT_REJECTED", fieldErrors?: Record<string, string>) {
    super(message, status, code, fieldErrors);
    this.name = "OrderPaymentCommandError";
  }
}

export const MAX_PAYMENT_AMOUNT = new Prisma.Decimal("9999999999.99");

/**
 * QPay's client currently accepts a number even though order amounts are
 * decimal values. Keep that lossy boundary in one place and reject values
 * that cannot round-trip through the provider's number API exactly.
 */
export function decimalToQPayAmount(value: Prisma.Decimal): number {
  if (!value.isFinite() || value.lte(0) || value.gt(MAX_PAYMENT_AMOUNT) || value.decimalPlaces() > 2) {
    throw new OrderPaymentCommandError("Дүнг зөв оруулна уу.", 422, "PAYMENT_AMOUNT_INVALID", { amount: "Дүнг зөв оруулна уу." });
  }
  const numeric = Number(value.toString());
  if (!Number.isFinite(numeric) || new Prisma.Decimal(numeric.toString()).comparedTo(value) !== 0) {
    throw new OrderPaymentCommandError("QPay дүнгийн формат дэмжигдэхгүй байна.", 422, "QPAY_AMOUNT_UNSUPPORTED");
  }
  return numeric;
}

export function parseOrderPaymentAmount(value: unknown): Prisma.Decimal | null {
  if (value instanceof Prisma.Decimal) return value.isFinite() && value.gt(0) && value.lte(MAX_PAYMENT_AMOUNT) && value.decimalPlaces() <= 2 ? value : null;
  if (typeof value !== "string") return null;
  const raw = value.trim().replace(/[\s,]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  try {
    const amount = new Prisma.Decimal(raw);
    return amount.isFinite() && amount.gt(0) && amount.lte(MAX_PAYMENT_AMOUNT) ? amount : null;
  } catch {
    return null;
  }
}

export function isOrderPaymentMethod(value: unknown): value is AnyOrderPaymentMethod {
  return value === "OTHER" || (typeof value === "string" && (ORDER_PAYMENT_METHODS as readonly string[]).includes(value));
}

type LockedPaymentOrder = {
  id: string;
  number: string;
  branchId: string;
  assignedToId: string | null;
  totalAmount: Prisma.Decimal | null;
  appointment: { id: string; accountId: string | null; status: string } | null;
  customer: { fullName: string; phone: string };
};

const PAYMENT_ORDER_SELECT = {
  id: true,
  number: true,
  branchId: true,
  assignedToId: true,
  totalAmount: true,
  appointment: { select: { id: true, accountId: true, status: true } },
  customer: { select: { fullName: true, phone: true } },
} satisfies Prisma.ServiceOrderSelect;

function assertPaymentAccess(
  actor: OrderPaymentCommandActor,
  order: Pick<LockedPaymentOrder, "branchId" | "assignedToId">,
  scope: OrderCommandScope,
) {
  if (!isOrderBranchInScope(actor, order.branchId, scope)) {
    throw new OrderPaymentCommandError("Зөвхөн өөрийн салбарын засварын хуудсыг удирдана.", 404, "ORDER_OUT_OF_SCOPE");
  }
  if (!canEditOrder(actor, order)) {
    throw new OrderPaymentCommandError("Танд энэ төлбөрийг засах эрх байхгүй.", 403, "ORDER_EDIT_FORBIDDEN");
  }
}

async function paidLedger(tx: PrismaTransactionClient, tenantId: string, orderId: string) {
  const rows = await tx.orderPayment.findMany({
    where: { tenantId, orderId, status: "PAID" },
    select: { amount: true, paidAt: true },
  });
  const paid = rows.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
  const paidAt = rows.reduce<Date | null>((latest, row) => {
    if (!row.paidAt) return latest;
    return !latest || row.paidAt > latest ? row.paidAt : latest;
  }, null);
  return { paid, paidAt };
}

export async function recomputeOrderPaymentTotals(
  tx: PrismaTransactionClient,
  tenantId: string,
  order: Pick<LockedPaymentOrder, "id" | "totalAmount">,
) {
  const { paid, paidAt } = await paidLedger(tx, tenantId, order.id);
  const total = order.totalAmount ?? new Prisma.Decimal(0);
  const status = paid.lte(0) ? "UNPAID" : paid.gte(total) ? "PAID" : "PARTIAL";
  await tx.serviceOrder.update({
    where: { id: order.id },
    data: {
      paidAmount: paid.lte(0) ? null : paid,
      paymentStatus: status,
      paidAt: status === "PAID" ? paidAt ?? new Date() : null,
    },
  });
  return { paid, status, paidAt, total, remaining: total.minus(paid) };
}

async function cancelPendingQPay(tx: PrismaTransactionClient, tenantId: string, orderId: string) {
  await tx.orderPayment.updateMany({
    where: { tenantId, orderId, method: "QPAY", status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}

export type RecordedOrderPayment = {
  id: string;
  amount: string;
  method: string;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
};

export async function createOrderPaymentCommand(input: {
  actor: OrderPaymentCommandActor;
  orderId: string;
  method: AnyOrderPaymentMethod;
  amount: Prisma.Decimal | null;
  scope?: OrderCommandScope;
}) {
  if (input.amount && (!input.amount.isFinite() || input.amount.lte(0) || input.amount.gt(MAX_PAYMENT_AMOUNT) || input.amount.decimalPlaces() > 2)) {
    throw new OrderPaymentCommandError("Дүнг зөв оруулна уу.", 422, "PAYMENT_AMOUNT_INVALID", { amount: "Дүнг зөв оруулна уу." });
  }
  const result = await withOrderTransaction(input.actor.tenantId, input.orderId, PAYMENT_ORDER_SELECT, async (tx, raw) => {
    const order = raw as LockedPaymentOrder | null;
    if (!order) throw new OrderPaymentCommandError("Засварын хуудас олдсонгүй.", 404, "ORDER_NOT_FOUND");
    assertPaymentAccess(input.actor, order, input.scope);
    const ledger = await paidLedger(tx, input.actor.tenantId, order.id);
    const total = order.totalAmount ?? new Prisma.Decimal(0);
    const remaining = total.minus(ledger.paid);
    if (remaining.lte(0)) throw new OrderPaymentCommandError("Энэ захиалга бүрэн төлөгдсөн байна.", 422, "PAYMENT_ALREADY_PAID");
    const amount = input.amount ?? remaining;
    if (amount.gt(remaining)) {
      throw new OrderPaymentCommandError(`Дүн үлдэгдэл (${formatTugrik(remaining.toString())})-ээс их байж болохгүй.`, 422, "PAYMENT_OVERPAYMENT", { amount: "Үлдэгдлээс их байна." });
    }
    const paidAt = new Date();
    const payment = await tx.orderPayment.create({
      data: { tenantId: input.actor.tenantId, orderId: order.id, amount, method: input.method, status: "PAID", paidAt },
      select: { id: true, amount: true, method: true, status: true, paidAt: true, createdAt: true },
    });
    await cancelPendingQPay(tx, input.actor.tenantId, order.id);
    const totals = await recomputeOrderPaymentTotals(tx, input.actor.tenantId, order);
    await logAudit({
      tenantId: input.actor.tenantId,
      userId: input.actor.id,
      branchId: order.branchId,
      entity: "ServiceOrder",
      entityId: order.id,
      action: "PAYMENT_CHANGE",
      summary: `${ORDER_PAYMENT_METHOD_LABEL[input.method]} · ${formatTugrik(amount.toString())} бүртгэв`,
      after: { paymentId: payment.id, method: input.method, amount: amount.toString(), paidAmount: totals.paid.toString(), paymentStatus: totals.status },
    }, tx);
    return { payment, orderId: order.id, accountId: order.appointment?.accountId ?? null, appointmentId: order.appointment?.id ?? null, totals };
  });
  return result;
}

export async function reverseOrderPaymentCommand(input: {
  actor: OrderPaymentCommandActor;
  orderId?: string;
  paymentId: string;
  scope?: OrderCommandScope;
}) {
  const resolvedOrderId = input.orderId ?? (await prisma.orderPayment.findFirst({
    where: { id: input.paymentId, tenantId: input.actor.tenantId },
    select: { orderId: true },
  }))?.orderId;
  if (!resolvedOrderId) throw new OrderPaymentCommandError("Төлбөр олдсонгүй.", 404, "PAYMENT_NOT_FOUND");
  return withOrderTransaction(input.actor.tenantId, resolvedOrderId, {
    ...PAYMENT_ORDER_SELECT,
  }, async (tx, raw) => {
    const order = raw as LockedPaymentOrder | null;
    if (!order) throw new OrderPaymentCommandError("Засварын хуудас олдсонгүй.", 404, "ORDER_NOT_FOUND");
    assertPaymentAccess(input.actor, order, input.scope);
    const payment = await tx.orderPayment.findFirst({
      where: { id: input.paymentId, tenantId: input.actor.tenantId, orderId: resolvedOrderId, status: "PAID" },
      select: { id: true, amount: true, method: true },
    });
    if (!payment) throw new OrderPaymentCommandError("Төлбөр олдсонгүй эсвэл аль хэдийн цуцлагдсан байна.", 404, "PAYMENT_NOT_FOUND");
    await tx.orderPayment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } });
    await cancelPendingQPay(tx, input.actor.tenantId, order.id);
    const totals = await recomputeOrderPaymentTotals(tx, input.actor.tenantId, order);
    await logAudit({
      tenantId: input.actor.tenantId,
      userId: input.actor.id,
      branchId: order.branchId,
      entity: "ServiceOrder",
      entityId: order.id,
      action: "PAYMENT_CHANGE",
      summary: `${ORDER_PAYMENT_METHOD_LABEL[payment.method] ?? payment.method} · ${formatTugrik(payment.amount.toString())} бүртгэлийг цуцлав`,
      after: { paymentId: payment.id, status: "CANCELLED", paidAmount: totals.paid.toString(), paymentStatus: totals.status },
    }, tx);
    return { paymentId: payment.id, orderId: order.id, totals };
  });
}

/** Legacy adapter support: clear the aggregate by reversing every paid ledger
 * row in one locked transaction. The mobile row-level endpoint intentionally
 * remains stricter and reverses exactly one payment. */
export async function reverseAllOrderPaymentsCommand(input: {
  actor: OrderPaymentCommandActor;
  orderId: string;
  scope?: OrderCommandScope;
}) {
  return withOrderTransaction(input.actor.tenantId, input.orderId, PAYMENT_ORDER_SELECT, async (tx, raw) => {
    const order = raw as LockedPaymentOrder | null;
    if (!order) throw new OrderPaymentCommandError("Засварын хуудас олдсонгүй.", 404, "ORDER_NOT_FOUND");
    assertPaymentAccess(input.actor, order, input.scope);
    const paid = await tx.orderPayment.findMany({ where: { tenantId: input.actor.tenantId, orderId: order.id, status: "PAID" }, select: { id: true, amount: true } });
    if (paid.length > 0) await tx.orderPayment.updateMany({ where: { tenantId: input.actor.tenantId, orderId: order.id, status: "PAID" }, data: { status: "CANCELLED" } });
    await cancelPendingQPay(tx, input.actor.tenantId, order.id);
    const totals = await recomputeOrderPaymentTotals(tx, input.actor.tenantId, order);
    await logAudit({ tenantId: input.actor.tenantId, userId: input.actor.id, branchId: order.branchId, entity: "ServiceOrder", entityId: order.id, action: "PAYMENT_CHANGE", summary: "Бүх төлбөрийн бүртгэлийг цуцлав", after: { paymentIds: paid.map((payment) => payment.id), paidAmount: totals.paid.toString(), paymentStatus: totals.status } }, tx);
    return { orderId: order.id, totals };
  });
}

export async function listOrderPaymentsCommand(input: { actor: OrderPaymentCommandActor; orderId: string; scope?: OrderCommandScope }) {
  const order = await prisma.serviceOrder.findFirst({
    where: { id: input.orderId, tenantId: input.actor.tenantId },
    select: { id: true, branchId: true, assignedToId: true },
  });
  if (!order) throw new OrderPaymentCommandError("Засварын хуудас олдсонгүй.", 404, "ORDER_NOT_FOUND");
  if (!isOrderBranchInScope(input.actor, order.branchId, input.scope) || !canViewOrder(input.actor, order)) {
    throw new OrderPaymentCommandError("Танд энэ төлбөрийг харах эрх байхгүй.", 403, "ORDER_VIEW_FORBIDDEN");
  }
  return prisma.orderPayment.findMany({ where: { tenantId: input.actor.tenantId, orderId: order.id }, orderBy: { createdAt: "desc" }, select: { id: true, amount: true, method: true, status: true, paidAt: true, createdAt: true, qpayInvoiceId: true, qrImage: true, qrText: true, qpayUrls: true } });
}

export async function createOrderQPayInvoiceCommand(input: { actor: OrderPaymentCommandActor; orderId: string; scope?: OrderCommandScope }) {
  return withOrderTransaction(input.actor.tenantId, input.orderId, PAYMENT_ORDER_SELECT, async (tx, raw) => {
    const order = raw as LockedPaymentOrder | null;
    if (!order) throw new OrderPaymentCommandError("Засварын хуудас олдсонгүй.", 404, "ORDER_NOT_FOUND");
    assertPaymentAccess(input.actor, order, input.scope);
    const ledger = await paidLedger(tx, input.actor.tenantId, order.id);
    const total = order.totalAmount ?? new Prisma.Decimal(0);
    const remaining = total.minus(ledger.paid);
    if (remaining.lte(0)) throw new OrderPaymentCommandError("Үлдэгдэл байхгүй.", 422, "PAYMENT_ALREADY_PAID");
    const pending = await tx.orderPayment.findFirst({ where: { tenantId: input.actor.tenantId, orderId: order.id, method: "QPAY", status: "PENDING" }, orderBy: { createdAt: "desc" }, select: { id: true, amount: true, qpayInvoiceId: true, qrImage: true, qrText: true, qpayUrls: true } });
    if (pending && pending.amount.equals(remaining) && pending.qpayInvoiceId) {
      let urls = Array.isArray(pending.qpayUrls) ? pending.qpayUrls : [];
      if (urls.length === 0) {
        urls = (await TenantQPayService.getInvoiceUrls(input.actor.tenantId, pending.qpayInvoiceId)) ?? [];
        if (urls.length > 0) await tx.orderPayment.update({ where: { id: pending.id }, data: { qpayUrls: urls } });
      }
      return { id: pending.id, amount: pending.amount.toString(), qrImage: pending.qrImage ?? null, qrText: pending.qrText ?? null, urls };
    }
    if (pending) await tx.orderPayment.updateMany({ where: { id: pending.id, tenantId: input.actor.tenantId, status: "PENDING" }, data: { status: "CANCELLED" } });
    const payment = await tx.orderPayment.create({ data: { tenantId: input.actor.tenantId, orderId: order.id, amount: remaining, method: "QPAY", status: "PENDING" }, select: { id: true, amount: true, qpayInvoiceId: true, qrImage: true, qrText: true, qpayUrls: true } });
    // Keep the provider side effect under the same order-row lock as the
    // local pending row. This prevents a concurrent manual payment or cancel
    // from making the provider invoice unattachable before this transaction
    // commits. The provider call is bounded by the transaction timeout.
    const invoice = await TenantQPayService.createInvoice({ tenantId: input.actor.tenantId, senderInvoiceNo: payment.id, invoiceReceiverCode: order.customer.fullName || order.customer.phone, invoiceDescription: `Засварын хуудас #${order.number}`, amount: decimalToQPayAmount(remaining) });
    if ("error" in invoice) {
      console.warn("[orders/qpay] invoice creation failed");
      throw new OrderPaymentCommandError("QPay үйлчилгээ түр ажиллахгүй байна. Дахин оролдоно уу.", 502, "QPAY_ERROR");
    }
    let urls = Array.isArray(invoice.urls) ? invoice.urls : [];
    if (urls.length === 0) urls = (await TenantQPayService.getInvoiceUrls(input.actor.tenantId, invoice.invoice_id)) ?? [];
    const updated = await tx.orderPayment.update({ where: { id: payment.id }, data: { qpayInvoiceId: invoice.invoice_id, qrText: invoice.qr_text, qrImage: invoice.qr_image, qpayUrls: urls.length > 0 ? urls : Prisma.JsonNull }, select: { id: true, amount: true, qrImage: true, qrText: true } });
    await logAudit({ tenantId: input.actor.tenantId, userId: input.actor.id, branchId: order.branchId, entity: "ServiceOrder", entityId: order.id, action: "PAYMENT_CHANGE", summary: `QPay QR үүсгэв · ${formatTugrik(remaining.toString())}`, after: { paymentId: payment.id, amount: remaining.toString() } }, tx);
    return { id: updated.id, amount: updated.amount.toString(), qrImage: updated.qrImage ?? null, qrText: updated.qrText ?? null, urls };
  });
}

export type OrderQPayConfirmResult =
  | { paid: true; newlyPaid: boolean; orderId: string; paymentId: string; amount: string; accountId: string | null; appointmentId: string | null }
  | { paid: false; message?: string };

export async function confirmOrderQPayPaymentCommand(input: { actor: OrderPaymentCommandActor; orderId?: string; paymentId: string; scope?: OrderCommandScope }): Promise<OrderQPayConfirmResult> {
  const resolvedOrderId = input.orderId ?? (await prisma.orderPayment.findFirst({ where: { id: input.paymentId, tenantId: input.actor.tenantId }, select: { orderId: true } }))?.orderId;
  if (!resolvedOrderId) throw new OrderPaymentCommandError("Төлбөр олдсонгүй.", 404, "PAYMENT_NOT_FOUND");
  const preflight = await withOrderTransaction(input.actor.tenantId, resolvedOrderId, PAYMENT_ORDER_SELECT, async (tx, raw) => {
    const order = raw as LockedPaymentOrder | null;
    if (!order) throw new OrderPaymentCommandError("Засварын хуудас олдсонгүй.", 404, "ORDER_NOT_FOUND");
    assertPaymentAccess(input.actor, order, input.scope);
    const payment = await tx.orderPayment.findFirst({ where: { id: input.paymentId, tenantId: input.actor.tenantId, orderId: order.id }, select: { id: true, amount: true, method: true, status: true, qpayInvoiceId: true } });
    if (!payment) throw new OrderPaymentCommandError("Төлбөр олдсонгүй.", 404, "PAYMENT_NOT_FOUND");
    if (payment.method !== "QPAY") throw new OrderPaymentCommandError("Энэ нь QPay төлбөр биш байна.", 422, "QPAY_PAYMENT_REQUIRED");
    return { order, payment };
  });
  if (preflight.payment.status === "PAID") {
    const reconciled = await withOrderTransaction(input.actor.tenantId, resolvedOrderId, PAYMENT_ORDER_SELECT, async (tx, raw) => {
      const order = raw as LockedPaymentOrder | null;
      if (!order) throw new OrderPaymentCommandError("Засварын хуудас олдсонгүй.", 404, "ORDER_NOT_FOUND");
      assertPaymentAccess(input.actor, order, input.scope);
      const fresh = await tx.orderPayment.findFirst({ where: { id: input.paymentId, tenantId: input.actor.tenantId, orderId: order.id }, select: { id: true, amount: true, method: true, status: true } });
      if (!fresh) throw new OrderPaymentCommandError("Төлбөр олдсонгүй.", 404, "PAYMENT_NOT_FOUND");
      if (fresh.method !== "QPAY") throw new OrderPaymentCommandError("Энэ нь QPay төлбөр биш байна.", 422, "QPAY_PAYMENT_REQUIRED");
      if (fresh.status !== "PAID") throw new OrderPaymentCommandError("QPay төлбөрийн төлөв зэрэгцээ өөрчлөгдлөө.", 409, "QPAY_PAYMENT_RACE");
      await cancelPendingQPay(tx, input.actor.tenantId, order.id);
      return { amount: fresh.amount };
    });
    return { paid: true, newlyPaid: false, orderId: resolvedOrderId, paymentId: input.paymentId, amount: reconciled.amount.toString(), accountId: preflight.order.appointment?.accountId ?? null, appointmentId: preflight.order.appointment?.id ?? null };
  }
  if (preflight.payment.status !== "PENDING") throw new OrderPaymentCommandError("Энэ QPay төлбөр хүлээгдэж буй төлөвт биш байна.", 422, "QPAY_PAYMENT_NOT_PENDING");
  if (!preflight.payment.qpayInvoiceId) throw new OrderPaymentCommandError("QPay invoice байхгүй.", 422, "QPAY_INVOICE_MISSING");
  const check = await TenantQPayService.checkPaymentExact(input.actor.tenantId, preflight.payment.qpayInvoiceId, preflight.payment.amount.toString());
  if ("error" in check) {
    console.warn("[orders/qpay] payment check failed");
    throw new OrderPaymentCommandError("QPay төлбөр шалгахад алдаа гарлаа. Дахин оролдоно уу.", 502, "QPAY_ERROR");
  }
  const paidAmount = new Prisma.Decimal(check.paidAmount);
  if (!check.paid) return { paid: false, message: paidAmount.gt(0) ? "Төлбөр бүрэн төлөгдөөгүй байна. Дахин шалгана уу." : "Төлбөр төлөгдөөгүй байна." };
  if (paidAmount.lt(preflight.payment.amount)) return { paid: false, message: "Төлбөр бүрэн төлөгдөөгүй байна. Дахин шалгана уу." };
  const result = await withOrderTransaction(input.actor.tenantId, resolvedOrderId, PAYMENT_ORDER_SELECT, async (tx, raw) => {
    const order = raw as LockedPaymentOrder | null;
    if (!order) throw new OrderPaymentCommandError("Засварын хуудас олдсонгүй.", 404, "ORDER_NOT_FOUND");
    assertPaymentAccess(input.actor, order, input.scope);
    const fresh = await tx.orderPayment.findFirst({ where: { id: input.paymentId, tenantId: input.actor.tenantId, orderId: order.id }, select: { id: true, amount: true, method: true, status: true } });
    if (!fresh) throw new OrderPaymentCommandError("Төлбөр олдсонгүй.", 404, "PAYMENT_NOT_FOUND");
    if (fresh.method !== "QPAY") throw new OrderPaymentCommandError("Энэ нь QPay төлбөр биш байна.", 422, "QPAY_PAYMENT_REQUIRED");
    if (fresh.status === "PAID") {
      await cancelPendingQPay(tx, input.actor.tenantId, order.id);
      return { already: true, amount: fresh.amount };
    }
    if (fresh.status !== "PENDING") throw new OrderPaymentCommandError("Энэ QPay төлбөр хүлээгдэж буй төлөвт биш байна.", 409, "QPAY_PAYMENT_RACE");
    await tx.orderPayment.update({ where: { id: fresh.id }, data: { status: "PAID", paidAt: check.paidAt ?? new Date(), qpayPaymentId: check.paymentId } });
    await cancelPendingQPay(tx, input.actor.tenantId, order.id);
    const totals = await recomputeOrderPaymentTotals(tx, input.actor.tenantId, order);
    await logAudit({ tenantId: input.actor.tenantId, userId: input.actor.id, branchId: order.branchId, entity: "ServiceOrder", entityId: order.id, action: "PAYMENT_CHANGE", summary: `QPay PAID · ${formatTugrik(fresh.amount.toString())} → ${totals.status}`, after: { paymentId: fresh.id, qpayPaymentId: check.paymentId, paidAmount: totals.paid.toString(), paymentStatus: totals.status } }, tx);
    return { already: false, amount: fresh.amount };
  });
  return { paid: true, newlyPaid: !result.already, orderId: resolvedOrderId, paymentId: input.paymentId, amount: result.amount.toString(), accountId: preflight.order.appointment?.accountId ?? null, appointmentId: preflight.order.appointment?.id ?? null };
}

export async function cancelOrderQPayPaymentCommand(input: { actor: OrderPaymentCommandActor; orderId?: string; paymentId: string; scope?: OrderCommandScope }) {
  const resolvedOrderId = input.orderId ?? (await prisma.orderPayment.findFirst({ where: { id: input.paymentId, tenantId: input.actor.tenantId }, select: { orderId: true } }))?.orderId;
  if (!resolvedOrderId) throw new OrderPaymentCommandError("Төлбөр олдсонгүй.", 404, "PAYMENT_NOT_FOUND");
  return withOrderTransaction(input.actor.tenantId, resolvedOrderId, PAYMENT_ORDER_SELECT, async (tx, raw) => {
    const order = raw as LockedPaymentOrder | null;
    if (!order) throw new OrderPaymentCommandError("Засварын хуудас олдсонгүй.", 404, "ORDER_NOT_FOUND");
    assertPaymentAccess(input.actor, order, input.scope);
    const payment = await tx.orderPayment.findFirst({ where: { id: input.paymentId, tenantId: input.actor.tenantId, orderId: order.id, status: "PENDING", method: "QPAY" }, select: { id: true, amount: true } });
    if (!payment) throw new OrderPaymentCommandError("Хүлээгдэж буй QPay төлбөр олдсонгүй.", 404, "PAYMENT_NOT_FOUND");
    await tx.orderPayment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } });
    await logAudit({ tenantId: input.actor.tenantId, userId: input.actor.id, branchId: order.branchId, entity: "ServiceOrder", entityId: order.id, action: "PAYMENT_CHANGE", summary: `QPay QR цуцлав · ${formatTugrik(payment.amount.toString())}`, after: { paymentId: payment.id, amount: payment.amount.toString(), status: "CANCELLED" } }, tx);
    return { orderId: order.id, paymentId: payment.id };
  });
}

export async function notifyOrderPaymentReceived(input: { tenantId: string; orderId: string; amount: string; accountId?: string | null; appointmentId?: string | null }) {
  if (!input.accountId || !input.appointmentId) return;
  try {
    await createNotification({ type: "order_payment_received", tenantId: input.tenantId, recipient: { accountId: input.accountId }, input: { orderId: input.orderId, appointmentId: input.appointmentId, amount: input.amount } });
  } catch (error) {
    console.warn("[notify] order_payment_received:", error instanceof Error ? error.name : "UnknownError");
  }
}
