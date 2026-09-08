import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { branchScopeId } from "@/lib/auth/roles";
import { logAudit } from "@/lib/audit";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import { prisma } from "@/lib/prisma";
import {
  ORDER_STATUS_TRANSITIONS,
  isOrderLocked,
  type OrderStatus,
} from "@/lib/orders";

const ORDER_DETAIL_SELECT = {
  id: true,
  number: true,
  status: true,
  paymentStatus: true,
  scheduledAt: true,
  startedAt: true,
  completedAt: true,
  paidAt: true,
  totalAmount: true,
  paidAmount: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, fullName: true, phone: true, email: true } },
  vehicle: {
    select: {
      id: true,
      plate: true,
      make: true,
      model: true,
      year: true,
      vin: true,
      mileage: true,
    },
  },
  branch: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  items: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      kind: true,
      description: true,
      quantity: true,
      unitPrice: true,
      total: true,
      serviceId: true,
      status: true,
      cancelledAt: true,
      cancelledById: true,
    },
  },
  reports: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      createdAt: true,
      template: { select: { id: true, name: true, type: true } },
    },
  },
} satisfies Prisma.ServiceOrderSelect;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const scope = branchScopeId(auth.user);

  const order = await prisma.serviceOrder.findFirst({
    where: {
      id,
      tenantId: auth.user.tenantId,
      ...(scope ? { branchId: scope } : {}),
    },
    select: ORDER_DETAIL_SELECT,
  });

  if (!order) return jsonError(404, "Засварын хуудас олдсонгүй.");
  return jsonOk({ order });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.edit");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;
  const { id } = await ctx.params;
  const scope = branchScopeId(auth.user);

  const order = await prisma.serviceOrder.findFirst({
    where: {
      id,
      tenantId: auth.user.tenantId,
      ...(scope ? { branchId: scope } : {}),
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      estimatedDurationMinutes: true,
    },
  });
  if (!order) return jsonError(404, "Засварын хуудас олдсонгүй.");
  if (isOrderLocked(order.status as OrderStatus)) {
    return jsonError(
      422,
      "Дууссан / цуцлагдсан засварын хуудасны мэдээллийг засах боломжгүй.",
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }

  const b = body as Record<string, unknown>;
  const updates: Prisma.ServiceOrderUpdateInput = {};
  let statusChangedTo: OrderStatus | null = null;

  if (typeof b.status === "string") {
    const newStatus = b.status as OrderStatus;
    const allowed = ORDER_STATUS_TRANSITIONS[order.status as OrderStatus];
    if (!allowed.includes(newStatus)) {
      return jsonError(
        422,
        `"${order.status}" статусаас "${newStatus}" руу шилжих боломжгүй.`,
      );
    }
    updates.status = newStatus;
    statusChangedTo = newStatus;
    const startedAt =
      newStatus === "IN_PROGRESS" && !order.startedAt
        ? new Date()
        : order.startedAt;
    if (newStatus === "IN_PROGRESS" && !order.startedAt) {
      updates.startedAt = startedAt;
    }
    if (newStatus === "COMPLETED") {
      updates.completedAt = new Date();
    }
    // Хүчин чадлын эзэмшил — app/_actions/orders.ts-ийн
    // changeOrderStatusAction-той ижил зарчим: идэвхтэй ажил хүчин чадал
    // эзэлнэ, дууссан/цуцлагдсан бол шууд суллана. WAITING_PARTS рүү шилжихэд
    // дуудагч `occupiesCapacity: boolean`-г JSON body-д тодорхой дамжуулж
    // болно (ирээгүй бол консерватив анхны утга true).
    if (newStatus === "COMPLETED" || newStatus === "CANCELLED") {
      updates.occupiesCapacity = false;
    } else if (newStatus === "WAITING_PARTS" && typeof b.occupiesCapacity === "boolean") {
      updates.occupiesCapacity = b.occupiesCapacity;
    } else {
      updates.occupiesCapacity = true;
    }
    if (
      newStatus === "IN_PROGRESS" &&
      startedAt &&
      order.estimatedDurationMinutes
    ) {
      updates.expectedFinishAt = new Date(
        startedAt.getTime() + order.estimatedDurationMinutes * 60000,
      );
    }
  }

  if (typeof b.notes === "string") {
    updates.notes = b.notes.trim() || null;
  }

  if (typeof b.assignedToId === "string") {
    updates.assignedTo = b.assignedToId.trim()
      ? { connect: { id: b.assignedToId.trim() } }
      : { disconnect: true };
  }

  const updated = await prisma.serviceOrder.update({
    where: { id },
    data: updates,
    select: ORDER_DETAIL_SELECT,
  });

  if (statusChangedTo) {
    await logAudit({
      tenantId: auth.user.tenantId,
      userId: auth.user.id,
      entity: "ServiceOrder",
      entityId: id,
      action: "STATUS_CHANGE",
      summary: `${order.status} → ${statusChangedTo}`,
      before: { status: order.status },
      after: { status: statusChangedTo },
    });
  } else {
    await logAudit({
      tenantId: auth.user.tenantId,
      userId: auth.user.id,
      entity: "ServiceOrder",
      entityId: id,
      action: "UPDATE",
      summary: "Засварын хуудасны мэдээлэл шинэчлэв",
    });
  }

  return jsonOk({ order: updated });
}
