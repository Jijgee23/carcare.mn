import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { branchScopeId } from "@/lib/auth/roles";
import { logAudit } from "@/lib/audit";
import { isOrderLocked, type OrderStatus } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.edit");
  if (denied) return denied;

  const tenantId = auth.user.tenantId;
  const { id, itemId } = await ctx.params;
  const scope = branchScopeId(auth.user);

  const order = await prisma.serviceOrder.findFirst({
    where: { id, tenantId, ...(scope ? { branchId: scope } : {}) },
    select: { id: true, status: true },
  });
  if (!order) return jsonError(404, "Захиалга олдсонгүй.");
  if (isOrderLocked(order.status as OrderStatus)) {
    return jsonError(
      422,
      "Дууссан эсвэл цуцлагдсан захиалганаас мөр устгах боломжгүй.",
    );
  }

  const item = await prisma.serviceItem.findFirst({
    where: { id: itemId, orderId: order.id },
    select: {
      id: true,
      serviceId: true,
      quantity: true,
      service: { select: { type: true } },
    },
  });
  if (!item) return jsonError(404, "Мөр олдсонгүй.");

  const restoreStock = Boolean(item.serviceId && item.service?.type === "GOODS");

  // Атомик: мөр устгах + (GOODS бол) нөөц буцаах + нийт дүн дахин тооцох + audit
  await prisma.$transaction(async (tx) => {
    await tx.serviceItem.delete({ where: { id: item.id } });

    await logAudit(
      {
        tenantId,
        userId: auth.user.id,
        entity: "ServiceOrder",
        entityId: order.id,
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
          tenantId,
          userId: auth.user.id,
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

    const items = await tx.serviceItem.findMany({
      where: { orderId: order.id },
      select: { total: true },
    });
    const newTotal = items.reduce(
      (acc, it) => acc.plus(it.total),
      new Prisma.Decimal(0),
    );
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: { totalAmount: newTotal },
    });
  });

  return jsonOk({ ok: true });
}
