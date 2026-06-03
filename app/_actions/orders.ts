"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit } from "@/lib/auth/roles";
import {
  ITEM_KINDS,
  ORDER_STATUS_TRANSITIONS,
  PAYMENT_STATUSES,
  isOrderLocked,
  type ItemKind,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { enforceCountLimit } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";

export type OrderActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function parseDecimal(v: string): Prisma.Decimal | null {
  if (!v) return null;
  const cleaned = v.replace(/[,\s]/g, "");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return new Prisma.Decimal(cleaned);
}

async function authorize(action: "create" | "edit" | "delete") {
  const user = await requireUser();
  const ok =
    action === "create"
      ? canCreate(user, "orders")
      : action === "edit"
        ? canEdit(user, "orders")
        : canDelete(user, "orders");
  if (!ok) {
    throw new Error("Танд захиалгад энэ үйлдэл хийх эрх байхгүй.");
  }
  return user;
}

async function nextOrderNumber(tenantId: string): Promise<string> {
  const count = await prisma.serviceOrder.count({ where: { tenantId } });
  return String(count + 1).padStart(5, "0");
}

async function recomputeTotal(orderId: string): Promise<void> {
  const items = await prisma.serviceItem.findMany({
    where: { orderId },
    select: { total: true },
  });
  const total = items.reduce(
    (acc, it) => acc.plus(it.total),
    new Prisma.Decimal(0),
  );
  await prisma.serviceOrder.update({
    where: { id: orderId },
    data: { totalAmount: total },
  });
}

// --- CREATE ---------------------------------------------------------------

type OrderInput = {
  branchId: string;
  customerId: string;
  vehicleId: string;
  assignedToId: string | null;
  scheduledAt: Date | null;
  notes: string | null;
};

function parseOrderInput(fd: FormData): {
  data: OrderInput;
  errors: Record<string, string>;
} {
  const branchId = s(fd, "branchId");
  const customerId = s(fd, "customerId");
  const vehicleId = s(fd, "vehicleId");
  const assignedToId = s(fd, "assignedToId");
  const scheduledRaw = s(fd, "scheduledAt");
  const notes = s(fd, "notes");

  const errors: Record<string, string> = {};
  if (!branchId) errors.branchId = "Салбар сонгоно уу.";
  if (!customerId) errors.customerId = "Үйлчлүүлэгчээ сонгоно уу.";
  if (!vehicleId) errors.vehicleId = "Машинаа сонгоно уу.";

  let scheduledAt: Date | null = null;
  if (scheduledRaw) {
    const d = new Date(scheduledRaw);
    if (!Number.isFinite(d.getTime())) {
      errors.scheduledAt = "Огноо буруу.";
    } else {
      scheduledAt = d;
    }
  }

  return {
    data: {
      branchId,
      customerId,
      vehicleId,
      assignedToId: assignedToId || null,
      scheduledAt,
      notes: notes || null,
    },
    errors,
  };
}

async function validateRefs(tenantId: string, data: OrderInput) {
  const errors: Record<string, string> = {};
  const [branch, customer, vehicle, assignee] = await Promise.all([
    data.branchId
      ? prisma.branch.findFirst({
          where: { id: data.branchId, tenantId },
          select: { id: true },
        })
      : null,
    data.customerId
      ? prisma.customer.findFirst({
          where: { id: data.customerId, tenantId },
          select: { id: true },
        })
      : null,
    data.vehicleId
      ? prisma.vehicle.findFirst({
          where: { id: data.vehicleId, tenantId },
          select: { id: true, customerId: true },
        })
      : null,
    data.assignedToId
      ? prisma.user.findFirst({
          where: { id: data.assignedToId, tenantId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (data.branchId && !branch) errors.branchId = "Салбар олдсонгүй.";
  if (data.customerId && !customer) errors.customerId = "Үйлчлүүлэгч олдсонгүй.";
  if (data.vehicleId && !vehicle) errors.vehicleId = "Машин олдсонгүй.";
  if (data.assignedToId && !assignee) errors.assignedToId = "Ажилтан олдсонгүй.";

  if (vehicle && data.customerId && vehicle.customerId !== data.customerId) {
    errors.vehicleId = "Энэ машин сонгосон үйлчлүүлэгчийнх биш.";
  }

  return errors;
}

export async function createOrderAction(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  let user;
  try {
    user = await authorize("create");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = parseOrderInput(formData);
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  const refErrors = await validateRefs(user.tenantId, data);
  if (Object.keys(refErrors).length > 0) {
    return { ok: false, fieldErrors: refErrors };
  }

  // Багцын хязгаар: daily_orders + max_active_orders
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dailyLimit = await enforceCountLimit(
    user.tenantId,
    PLAN_LIMIT_CODES.DAILY_ORDERS,
    () =>
      prisma.serviceOrder.count({
        where: { tenantId: user.tenantId, createdAt: { gte: todayStart } },
      }),
  );
  if (!dailyLimit.allowed) {
    return { ok: false, message: dailyLimit.message };
  }
  const activeLimit = await enforceCountLimit(
    user.tenantId,
    PLAN_LIMIT_CODES.MAX_ACTIVE_ORDERS,
    () =>
      prisma.serviceOrder.count({
        where: {
          tenantId: user.tenantId,
          status: { in: ["SCHEDULED", "IN_PROGRESS", "WAITING_PARTS"] },
        },
      }),
  );
  if (!activeLimit.allowed) {
    return { ok: false, message: activeLimit.message };
  }

  // Дугаар үүсгэх — давхардвал 3 удаа дахин оролдоно
  let createdId: string | null = null;
  for (let i = 0; i < 3 && !createdId; i++) {
    const number = await nextOrderNumber(user.tenantId);
    try {
      const created = await prisma.serviceOrder.create({
        data: {
          number,
          status: "SCHEDULED",
          tenantId: user.tenantId,
          branchId: data.branchId,
          customerId: data.customerId,
          vehicleId: data.vehicleId,
          assignedToId: data.assignedToId,
          scheduledAt: data.scheduledAt,
          notes: data.notes,
        },
        select: { id: true },
      });
      createdId = created.id;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        // дугаар давхардсан тул дахин оролдоно
        continue;
      }
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Үүсгэх явцад алдаа гарлаа.",
      };
    }
  }

  if (!createdId) {
    return { ok: false, message: "Захиалгын дугаар үүсгэж чадсангүй. Дахин оролдоно уу." };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "ServiceOrder",
    entityId: createdId,
    action: "CREATE",
    summary: "Захиалга үүсгэсэн",
    after: {
      branchId: data.branchId,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      assignedToId: data.assignedToId,
      scheduledAt: data.scheduledAt?.toISOString() ?? null,
    },
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  redirect(`/dashboard/orders/${createdId}`);
}

// --- UPDATE (info only — status өөр action-аар солино) -------------------

export async function updateOrderAction(
  id: string,
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = parseOrderInput(formData);
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  const refErrors = await validateRefs(user.tenantId, data);
  if (Object.keys(refErrors).length > 0) {
    return { ok: false, fieldErrors: refErrors };
  }

  const existing = await prisma.serviceOrder.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { status: true },
  });
  if (!existing) {
    return { ok: false, message: "Захиалга олдсонгүй." };
  }
  if (isOrderLocked(existing.status as OrderStatus)) {
    return {
      ok: false,
      message: "Дууссан / цуцлагдсан захиалгын мэдээллийг засаж болохгүй.",
    };
  }

  try {
    const updated = await prisma.serviceOrder.updateMany({
      where: { id, tenantId: user.tenantId },
      data,
    });
    if (updated.count === 0) {
      return { ok: false, message: "Захиалга олдсонгүй." };
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Шинэчлэх явцад алдаа гарлаа.",
    };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "ServiceOrder",
    entityId: id,
    action: "UPDATE",
    summary: "Захиалгын мэдээлэл шинэчлэв",
    after: {
      branchId: data.branchId,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      assignedToId: data.assignedToId,
      scheduledAt: data.scheduledAt?.toISOString() ?? null,
    },
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  return { ok: true, message: "Захиалга шинэчлэгдлээ." };
}

// --- STATUS CHANGE --------------------------------------------------------

export async function changeOrderStatusAction(formData: FormData): Promise<void> {
  const user = await authorize("edit");
  const id = s(formData, "id");
  const next = s(formData, "status") as OrderStatus;
  if (!id || !next) return;

  const order = await prisma.serviceOrder.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { id: true, status: true },
  });
  if (!order) return;

  const allowed = ORDER_STATUS_TRANSITIONS[order.status as OrderStatus];
  if (!allowed?.includes(next)) {
    throw new Error("Энэ статус руу шилжих боломжгүй.");
  }

  const updates: Prisma.ServiceOrderUpdateInput = { status: next };
  if (next === "IN_PROGRESS" && order.status === "SCHEDULED") {
    updates.startedAt = new Date();
  }
  if (next === "COMPLETED") {
    updates.completedAt = new Date();
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: updates,
    });
    await logAudit(
      {
        tenantId: user.tenantId,
        userId: user.id,
        entity: "ServiceOrder",
        entityId: order.id,
        action: "STATUS_CHANGE",
        summary: `${order.status} → ${next}`,
        before: { status: order.status },
        after: { status: next },
      },
      tx,
    );
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard");
}

// --- PAYMENT STATUS -------------------------------------------------------

export async function changeOrderPaymentStatusAction(
  formData: FormData,
): Promise<void> {
  const user = await authorize("edit");
  const id = s(formData, "id");
  const next = s(formData, "paymentStatus") as PaymentStatus;
  const paidAmountRaw = s(formData, "paidAmount");

  if (!id) return;
  if (!(PAYMENT_STATUSES as readonly string[]).includes(next)) {
    throw new Error("Төлбөрийн төлөв буруу.");
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { id: true, totalAmount: true, paymentStatus: true },
  });
  if (!order) return;

  const updates: Prisma.ServiceOrderUpdateInput = { paymentStatus: next };

  if (next === "PAID") {
    updates.paidAt = new Date();
    updates.paidAmount = order.totalAmount ?? new Prisma.Decimal(0);
  } else if (next === "UNPAID") {
    updates.paidAt = null;
    updates.paidAmount = null;
  } else if (next === "PARTIAL") {
    const amt = parseDecimal(paidAmountRaw);
    if (!amt) {
      throw new Error("Хагас төлбөрийн дүнг зөв оруулна уу.");
    }
    if (order.totalAmount && amt.gt(order.totalAmount)) {
      throw new Error("Төлсөн дүн нийт дүнгээс их байж болохгүй.");
    }
    updates.paidAmount = amt;
    updates.paidAt = null;
  }

  const paidAmountStr =
    updates.paidAmount instanceof Prisma.Decimal
      ? updates.paidAmount.toString()
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: updates,
    });
    await logAudit(
      {
        tenantId: user.tenantId,
        userId: user.id,
        entity: "ServiceOrder",
        entityId: order.id,
        action: "PAYMENT_CHANGE",
        summary: `${order.paymentStatus} → ${next}${paidAmountStr ? ` (${paidAmountStr})` : ""}`,
        before: { paymentStatus: order.paymentStatus },
        after: { paymentStatus: next, paidAmount: paidAmountStr },
      },
      tx,
    );
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard");
}

// --- DELETE ---------------------------------------------------------------

export async function deleteOrderAction(formData: FormData): Promise<void> {
  const user = await authorize("delete");
  const id = s(formData, "id");
  if (!id) return;

  const target = await prisma.serviceOrder.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { number: true },
  });

  await prisma.serviceOrder.delete({
    where: { id, tenantId: user.tenantId },
  });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "ServiceOrder",
    entityId: id,
    action: "DELETE",
    summary: target ? `#${target.number}` : null,
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  redirect("/dashboard/orders");
}

// --- ITEMS ----------------------------------------------------------------

// Service.type → ServiceItem.kind тааруулга (DIAGNOSTIC хэрэглэгдэхгүй)
const SERVICE_KIND_TO_ITEM_KIND: Record<string, ItemKind> = {
  LABOR: "LABOR",
  GOODS: "PART",
};

export async function addOrderItemAction(
  orderId: string,
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const serviceIdRaw = s(formData, "serviceId");
  const diagnosticTemplateIdRaw = s(formData, "diagnosticTemplateId");
  let kind = s(formData, "kind") as ItemKind;
  let description = s(formData, "description");
  const quantity = parseDecimal(s(formData, "quantity") || "1");
  let unitPrice = parseDecimal(s(formData, "unitPrice"));

  let serviceId: string | null = null;
  let isGoods = false;

  // Оношилгооны загвар сонгосон — DIAGNOSTIC kind line item болно
  if (diagnosticTemplateIdRaw) {
    const tpl = await prisma.diagnosticTemplate.findFirst({
      where: {
        id: diagnosticTemplateIdRaw,
        tenantId: user.tenantId,
        isActive: true,
      },
      select: { id: true, name: true, price: true },
    });
    if (!tpl) {
      return {
        ok: false,
        fieldErrors: { diagnosticTemplateId: "Оношилгоо олдсонгүй." },
      };
    }
    kind = "DIAGNOSTIC";
    if (!description) description = tpl.name;
    if (!unitPrice) unitPrice = tpl.price ?? new Prisma.Decimal(0);
  } else if (serviceIdRaw) {
    // Үйлчилгээний каталогоос сонгосон
    const svc = await prisma.service.findFirst({
      where: { id: serviceIdRaw, tenantId: user.tenantId, isActive: true },
      select: {
        id: true,
        type: true,
        name: true,
        code: true,
        price: true,
        stock: true,
        unit: { select: { name: true } },
      },
    });
    if (!svc) {
      return { ok: false, fieldErrors: { serviceId: "Үйлчилгээ олдсонгүй." } };
    }
    serviceId = svc.id;
    const mappedKind = SERVICE_KIND_TO_ITEM_KIND[svc.type];
    if (!mappedKind) {
      return { ok: false, fieldErrors: { serviceId: "Үйлчилгээний төрөл буруу." } };
    }
    kind = mappedKind;
    isGoods = svc.type === "GOODS";
    if (!description) {
      description = svc.code ? `${svc.name} (${svc.code})` : svc.name;
    }
    if (!unitPrice) unitPrice = svc.price;

    if (isGoods && quantity && svc.stock && svc.stock.lt(quantity)) {
      return {
        ok: false,
        fieldErrors: {
          quantity: `Үлдэгдэл хүрэхгүй (одоо: ${svc.stock.toString()}${svc.unit?.name ? ` ${svc.unit.name}` : ""}).`,
        },
      };
    }
  }

  const errors: Record<string, string> = {};
  if (!(ITEM_KINDS as readonly string[]).includes(kind))
    errors.kind = "Төрлийг сонгоно уу.";
  if (!description) errors.description = "Нэр оруулна уу.";
  if (!quantity) errors.quantity = "Тоо ширхэг буруу.";
  if (!unitPrice) errors.unitPrice = "Үнэ буруу.";

  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, tenantId: user.tenantId },
    select: { id: true, status: true },
  });
  if (!order) return { ok: false, message: "Захиалга олдсонгүй." };
  if (isOrderLocked(order.status as OrderStatus)) {
    return {
      ok: false,
      message: "Дууссан / цуцлагдсан захиалгад мөр нэмж болохгүй.",
    };
  }

  const total = quantity!.times(unitPrice!);

  await prisma.$transaction(async (tx) => {
    const created = await tx.serviceItem.create({
      data: {
        orderId,
        kind,
        description,
        quantity: quantity!,
        unitPrice: unitPrice!,
        total,
        serviceId,
      },
      select: { id: true },
    });

    await logAudit(
      {
        tenantId: user.tenantId,
        userId: user.id,
        entity: "ServiceOrder",
        entityId: orderId,
        action: "ITEM_ADDED",
        summary: `${kind} · ${description} × ${quantity!.toString()} @ ${unitPrice!.toString()}`,
        after: {
          itemId: created.id,
          kind,
          description,
          quantity: quantity!.toString(),
          unitPrice: unitPrice!.toString(),
          total: total.toString(),
          serviceId,
        },
      },
      tx,
    );

    if (serviceId && isGoods) {
      await tx.service.update({
        where: { id: serviceId },
        data: { stock: { decrement: quantity! } },
      });
      await logAudit(
        {
          tenantId: user.tenantId,
          userId: user.id,
          entity: "Service",
          entityId: serviceId,
          action: "STOCK_CHANGE",
          summary: `-${quantity!.toString()} (захиалга #${orderId})`,
          after: { delta: `-${quantity!.toString()}`, reason: "ORDER_ITEM_ADD" },
        },
        tx,
      );
    }
  });

  await recomputeTotal(orderId);
  revalidatePath(`/dashboard/orders/${orderId}`);
  if (serviceId) {
    revalidatePath("/dashboard/services", "layout");
    revalidatePath(`/dashboard/services/${serviceId}`);
  }
  return { ok: true };
}

export async function removeOrderItemAction(formData: FormData): Promise<void> {
  const user = await authorize("edit");
  const itemId = s(formData, "itemId");
  if (!itemId) return;

  const item = await prisma.serviceItem.findFirst({
    where: { id: itemId, order: { tenantId: user.tenantId } },
    select: {
      id: true,
      orderId: true,
      serviceId: true,
      quantity: true,
      service: { select: { type: true } },
      order: { select: { status: true } },
    },
  });
  if (!item) return;
  if (isOrderLocked(item.order.status as OrderStatus)) {
    throw new Error("Дууссан захиалгын мөрийг устгаж болохгүй.");
  }

  const restoreStock = item.serviceId && item.service?.type === "GOODS";

  await prisma.$transaction(async (tx) => {
    await tx.serviceItem.delete({ where: { id: item.id } });
    await logAudit(
      {
        tenantId: user.tenantId,
        userId: user.id,
        entity: "ServiceOrder",
        entityId: item.orderId,
        action: "ITEM_REMOVED",
        summary: `removed item ${item.id}`,
        before: {
          itemId: item.id,
          serviceId: item.serviceId,
          quantity: item.quantity.toString(),
        },
      },
      tx,
    );
    if (restoreStock && item.serviceId) {
      await tx.service.update({
        where: { id: item.serviceId },
        data: { stock: { increment: item.quantity } },
      });
      await logAudit(
        {
          tenantId: user.tenantId,
          userId: user.id,
          entity: "Service",
          entityId: item.serviceId,
          action: "STOCK_CHANGE",
          summary: `+${item.quantity.toString()} (мөр устгасан)`,
          after: {
            delta: `+${item.quantity.toString()}`,
            reason: "ORDER_ITEM_REMOVE",
          },
        },
        tx,
      );
    }
  });

  await recomputeTotal(item.orderId);
  revalidatePath(`/dashboard/orders/${item.orderId}`);
  if (item.serviceId) {
    revalidatePath("/dashboard/services", "layout");
    revalidatePath(`/dashboard/services/${item.serviceId}`);
  }
}
