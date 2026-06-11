import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { branchScopeId } from "@/lib/auth/roles";
import {
  PAYMENT_STATUSES,
  type PaymentStatus,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";

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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "payments.edit");
  if (denied) return denied;

  const { id } = await ctx.params;
  const scope = branchScopeId(auth.user);

  const order = await prisma.serviceOrder.findFirst({
    where: {
      id,
      tenantId: auth.user.tenantId,
      ...(scope ? { branchId: scope } : {}),
    },
    select: { id: true, totalAmount: true, paymentStatus: true },
  });
  if (!order) return jsonError(404, "Захиалга олдсонгүй.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }

  const b = body as Record<string, unknown>;
  const next = b.paymentStatus as string;
  if (!(PAYMENT_STATUSES as readonly string[]).includes(next)) {
    return jsonError(422, "Төлбөрийн төлөв буруу.");
  }

  const updates: Prisma.ServiceOrderUpdateInput = {
    paymentStatus: next as PaymentStatus,
  };

  if (next === "PAID") {
    updates.paidAt = new Date();
    updates.paidAmount = order.totalAmount ?? new Prisma.Decimal(0);
  } else if (next === "UNPAID") {
    updates.paidAt = null;
    updates.paidAmount = null;
  } else if (next === "PARTIAL") {
    const rawAmt =
      typeof b.paidAmount === "number"
        ? b.paidAmount
        : Number.parseFloat(String(b.paidAmount ?? ""));
    if (!rawAmt || Number.isNaN(rawAmt) || rawAmt <= 0) {
      return jsonError(422, "Хагас төлбөрийн дүнг зөв оруулна уу.");
    }
    const amt = new Prisma.Decimal(rawAmt);
    if (order.totalAmount && amt.gt(order.totalAmount)) {
      return jsonError(422, "Төлсөн дүн нийт дүнгээс их байж болохгүй.");
    }
    updates.paidAmount = amt;
    updates.paidAt = null;
  }

  const paidAmountStr =
    updates.paidAmount instanceof Prisma.Decimal
      ? updates.paidAmount.toString()
      : null;

  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.serviceOrder.update({
      where: { id },
      data: updates,
      select: ORDER_DETAIL_SELECT,
    });
    await logAudit(
      {
        tenantId: auth.user.tenantId,
        userId: auth.user.id,
        entity: "ServiceOrder",
        entityId: id,
        action: "PAYMENT_CHANGE",
        summary: `${order.paymentStatus} → ${next}${paidAmountStr ? ` (${paidAmountStr})` : ""}`,
        before: { paymentStatus: order.paymentStatus },
        after: { paymentStatus: next, paidAmount: paidAmountStr },
      },
      tx,
    );
    return o;
  });

  return jsonOk({ order: updated });
}
