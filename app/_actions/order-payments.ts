"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit } from "@/lib/auth/roles";
import { canEditOrder } from "@/lib/auth/order-access";
import { workingBranchScopeId } from "@/lib/auth/roles";
import {
  ORDER_PAYMENT_METHODS,
  ORDER_PAYMENT_METHOD_LABEL,
  type OrderPaymentMethod,
} from "@/lib/orders";
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
  if (order.paymentStatus === "PAID") {
    return { ok: false, message: "Засварын хуудас бүрэн төлөгдсөн." };
  }

  const total = order.totalAmount ?? new Prisma.Decimal(0);
  const paid = order.paidAmount ?? new Prisma.Decimal(0);
  const remaining = total.minus(paid);
  if (remaining.lte(0)) {
    return { ok: false, message: "Үлдэгдэл байхгүй." };
  }

  // Pending QR байвал — үлдэгдэл өөрчлөгдөөгүй л бол дахин ашиглана. Энэ
  // хооронд өөр төлбөр бүртгэгдсэн/цуцлагдсан бол үлдэгдэл өөрчлөгдсөн байх
  // тул хуучин (буруу дүнтэй) QR-ийг цуцалж доор шинээр үүсгэнэ.
  const pending = await prisma.orderPayment.findFirst({
    where: { orderId, status: "PENDING", method: "QPAY" },
    orderBy: { createdAt: "desc" },
  });
  if (pending) {
    if (pending.amount.equals(remaining)) {
      return { ok: true, paymentId: pending.id };
    }
    await prisma.orderPayment.update({
      where: { id: pending.id },
      data: { status: "CANCELLED" },
    });
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
    invoiceReceiverCode: order.customer.fullName || order.customer.phone,
    invoiceDescription: `Засварын хуудас #${order.number}`,
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
      qpayUrls: inv.urls ?? Prisma.JsonNull,
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
  });
  if (!payment) return { ok: false, paid: false, message: "Төлбөр олдсонгүй." };
  if (!(await canEditOrderForUser(user, payment.orderId))) return { ok: false, paid: false, message: "Танд энэ төлбөрийг засах эрх байхгүй." };
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

  // Бодит төлсөн дүнг expected-тэй тулгана — хэсэгчилсэн төлбөрийг бүтэн гэж
  // тооцож захиалгыг PAID болгохоос сэргийлнэ.
  if (new Prisma.Decimal(check.paidAmount).lt(payment.amount)) {
    return {
      ok: true,
      paid: false,
      message: "Төлбөр бүрэн төлөгдөөгүй байна. Дахин шалгана уу.",
    };
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

      // Захиалгын paidAmount/paymentStatus-ийг шинэчлэх — гаднаас уншсан
      // (HTTP round-trip-ийн өмнөх) хуучин утга биш, транзакц дотор дахин
      // уншсан шинэ утгаас тооцно (зэрэгцээ бэлнээр төлсөн зэрэг өөрчлөлт
      // алдагдахаас сэргийлнэ).
      const freshOrder = await tx.serviceOrder.findUniqueOrThrow({
        where: { id: payment.orderId },
        select: { totalAmount: true, paidAmount: true },
      });
      const total = freshOrder.totalAmount ?? new Prisma.Decimal(0);
      const prevPaid = freshOrder.paidAmount ?? new Prisma.Decimal(0);
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

  const payment = await prisma.orderPayment.findFirst({
    where: { id: paymentId, tenantId: user.tenantId, status: "PENDING" },
    select: { orderId: true, amount: true },
  });
  if (!payment) return;
  if (!(await canEditOrderForUser(user, payment.orderId))) return;

  await prisma.orderPayment.updateMany({
    where: { id: paymentId, tenantId: user.tenantId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "ServiceOrder",
    entityId: payment.orderId,
    action: "PAYMENT_CHANGE",
    summary: `QPay QR цуцлав · ${payment.amount.toString()}₮`,
    after: { paymentId, amount: payment.amount.toString(), status: "CANCELLED" },
  });

  revalidatePath(`/dashboard/orders/${payment.orderId}`);
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
      message: `Дүн үлдэгдэл (${remaining.toString()}₮)-ээс их байж болохгүй.`,
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
          summary: `${ORDER_PAYMENT_METHOD_LABEL[method]} · ${amount.toString()}₮ бүртгэв`,
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
        summary: `${ORDER_PAYMENT_METHOD_LABEL[payment.method] ?? payment.method} · ${payment.amount.toString()}₮ бүртгэлийг цуцлав`,
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
