import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { branchScopeId } from "@/lib/auth/roles";
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

  if (!order) return jsonError(404, "Захиалга олдсонгүй.");
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
  const { id } = await ctx.params;
  const scope = branchScopeId(auth.user);

  const order = await prisma.serviceOrder.findFirst({
    where: {
      id,
      tenantId: auth.user.tenantId,
      ...(scope ? { branchId: scope } : {}),
    },
    select: { id: true, status: true, startedAt: true },
  });
  if (!order) return jsonError(404, "Захиалга олдсонгүй.");
  if (isOrderLocked(order.status as OrderStatus)) {
    return jsonError(
      422,
      "Дууссан / цуцлагдсан захиалгын мэдээллийг засах боломжгүй.",
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
    if (newStatus === "IN_PROGRESS" && !order.startedAt) {
      updates.startedAt = new Date();
    }
    if (newStatus === "COMPLETED") {
      updates.completedAt = new Date();
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

  return jsonOk({ order: updated });
}
