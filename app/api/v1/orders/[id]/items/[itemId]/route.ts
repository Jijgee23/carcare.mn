import { Prisma } from "@/app/generated/prisma/client";
import {
  jsonError,
  jsonOk,
  requireApiUser,
  requirePermission,
} from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { branchScopeId } from "@/lib/auth/roles";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import {
  ITEM_KINDS,
  isOrderLocked,
  isServiceItemCancellable,
  type ItemKind,
  type OrderStatus,
  type ServiceItemStatus,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { canEditOrder, canChangeOrderItemStatus } from "@/lib/auth/order-access";

const MAX_QUANTITY = new Prisma.Decimal(1_000_000);
const MAX_UNIT_PRICE = new Prisma.Decimal(1_000_000_000);
const MAX_TOTAL = new Prisma.Decimal("9999999999.99");
class StockError extends Error {}

function parseDecimal(v: unknown): Prisma.Decimal | null {
  const str =
    typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  if (!str) return null;
  let d: Prisma.Decimal;
  try {
    d = new Prisma.Decimal(str);
  } catch {
    return null;
  }
  if (!d.isFinite() || d.lt(0)) return null;
  return d;
}

// ─── PATCH — мөр засах ────────────────────────────────────────────────────────

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.edit");
  if (denied && !auth.user.role?.permissions.includes("orders.editOwn")) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;

  const tenantId = auth.user.tenantId;
  const { id, itemId } = await ctx.params;
  const scope = branchScopeId(auth.user);

  const order = await prisma.serviceOrder.findFirst({
    where: { id, tenantId, ...(scope ? { branchId: scope } : {}) },
    select: { id: true, status: true, assignedToId: true },
  });
  if (!order) return jsonError(404, "Засварын хуудас олдсонгүй.");
  if (!canEditOrder(auth.user, order)) return jsonError(403, "Танд энэ засварын хуудсыг засах эрх байхгүй.");
  if (isOrderLocked(order.status as OrderStatus)) {
    return jsonError(422, "Дууссан эсвэл цуцлагдсан засварын хуудасны мөрийг засах боломжгүй.");
  }

  const item = await prisma.serviceItem.findFirst({
    where: { id: itemId, orderId: order.id },
    select: {
      id: true,
      kind: true,
      description: true,
      quantity: true,
      unitPrice: true,
      serviceId: true,
      status: true,
      service: { select: { type: true, stock: true } },
    },
  });
  if (!item) return jsonError(404, "Мөр олдсонгүй.");
  if (item.status === "CANCELLED") {
    return jsonError(422, "Цуцлагдсан мөрийг засах боломжгүй.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.status !== undefined && !canChangeOrderItemStatus(auth.user, order)) {
    return jsonError(403, "Танд үйлчилгээний мөрийн явц өөрчлөх эрх байхгүй.");
  }

  const kind =
    typeof b.kind === "string" && b.kind.trim()
      ? (b.kind.trim() as ItemKind)
      : item.kind;
  const description =
    typeof b.description === "string" && b.description.trim()
      ? b.description.trim()
      : item.description;
  const newQuantity =
    b.quantity !== undefined ? parseDecimal(b.quantity) : item.quantity;
  const newUnitPrice =
    b.unitPrice !== undefined ? parseDecimal(b.unitPrice) : item.unitPrice;

  const fieldErrors: Record<string, string> = {};
  if (!(ITEM_KINDS as readonly string[]).includes(kind))
    fieldErrors.kind = "Мөрийн төрөл буруу.";
  if (!description) fieldErrors.description = "Тайлбар оруулна уу.";
  if (!newQuantity || newQuantity.lte(0)) fieldErrors.quantity = "Тоо хэмжээ буруу.";
  else if (newQuantity.gt(MAX_QUANTITY)) fieldErrors.quantity = "Тоо хэмжээ хэт их.";
  if (!newUnitPrice) fieldErrors.unitPrice = "Үнэ буруу.";
  else if (newUnitPrice.gt(MAX_UNIT_PRICE)) fieldErrors.unitPrice = "Үнэ хэт их.";
  if (Object.keys(fieldErrors).length)
    return jsonError(422, "Хүсэлт буруу.", { fieldErrors });

  const newTotal = newQuantity!.times(newUnitPrice!);
  if (newTotal.gt(MAX_TOTAL))
    return jsonError(422, "Хүсэлт буруу.", { fieldErrors: { unitPrice: "Нийт дүн хэт их." } });

  const isGoods = Boolean(item.serviceId && item.service?.type === "GOODS");
  const qtyDelta = isGoods ? newQuantity!.minus(item.quantity) : null;

  let updatedItem;
  try {
    updatedItem = await prisma.$transaction(async (tx) => {
      const updated = await tx.serviceItem.update({
        where: { id: item.id },
        data: {
          kind,
          description,
          quantity: newQuantity!,
          unitPrice: newUnitPrice!,
          total: newTotal,
        },
        select: {
          id: true,
          kind: true,
          description: true,
          quantity: true,
          unitPrice: true,
          total: true,
          serviceId: true,
          status: true,
        },
      });

      await logAudit(
        {
          tenantId,
          userId: auth.user.id,
          entity: "ServiceOrder",
          entityId: order.id,
          action: "ITEM_UPDATED",
          summary: `${kind} · ${description} × ${newQuantity!.toString()} @ ${newUnitPrice!.toString()}`,
          before: {
            kind: item.kind,
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
          },
          after: {
            kind,
            description,
            quantity: newQuantity!.toString(),
            unitPrice: newUnitPrice!.toString(),
            total: newTotal.toString(),
          },
        },
        tx,
      );

      if (isGoods && item.serviceId && qtyDelta && !qtyDelta.isZero()) {
        const svcAfter = await tx.service.update({
          where: { id: item.serviceId },
          data: { stock: { decrement: qtyDelta } },
          select: { stock: true },
        });
        if (svcAfter.stock != null && svcAfter.stock.lt(0)) throw new StockError();
        await logAudit(
          {
            tenantId,
            userId: auth.user.id,
            entity: "Service",
            entityId: item.serviceId,
            action: "STOCK_CHANGE",
            summary: `${qtyDelta.gt(0) ? "-" : "+"}${qtyDelta.abs().toString()} (засварын хуудас засварласан)`,
            after: { delta: qtyDelta.toString(), reason: "ORDER_ITEM_UPDATE" },
          },
          tx,
        );
      }

      const items = await tx.serviceItem.findMany({
        where: { orderId: order.id, status: { not: "CANCELLED" } },
        select: { total: true },
      });
      const orderTotal = items.reduce(
        (acc, it) => acc.plus(it.total),
        new Prisma.Decimal(0),
      );
      await tx.serviceOrder.update({
        where: { id: order.id },
        data: { totalAmount: orderTotal },
      });

      return updated;
    });
  } catch (e) {
    if (e instanceof StockError) {
      return jsonError(422, "Хүсэлт буруу.", {
        fieldErrors: { quantity: "Үлдэгдэл хүрэхгүй байна." },
      });
    }
    throw e;
  }

  return jsonOk({ item: updatedItem });
}

// ─── DELETE — мөр цуцлах (УСТГАХГҮЙ, түүхийг хадгална) ────────────────────────

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.edit");
  if (denied && !auth.user.role?.permissions.includes("orders.editOwn")) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;

  const tenantId = auth.user.tenantId;
  const { id, itemId } = await ctx.params;
  const scope = branchScopeId(auth.user);

  const order = await prisma.serviceOrder.findFirst({
    where: { id, tenantId, ...(scope ? { branchId: scope } : {}) },
    select: { id: true, status: true, assignedToId: true },
  });
  if (!order) return jsonError(404, "Засварын хуудас олдсонгүй.");
  if (!canEditOrder(auth.user, order)) return jsonError(403, "Танд энэ засварын хуудсыг засах эрх байхгүй.");
  if (isOrderLocked(order.status as OrderStatus)) {
    return jsonError(422, "Дууссан эсвэл цуцлагдсан засварын хуудасны мөрийг цуцлах боломжгүй.");
  }

  const item = await prisma.serviceItem.findFirst({
    where: { id: itemId, orderId: order.id },
    select: {
      id: true,
      serviceId: true,
      quantity: true,
      status: true,
      service: { select: { type: true } },
    },
  });
  if (!item) return jsonError(404, "Мөр олдсонгүй.");
  if (!isServiceItemCancellable(item.status as ServiceItemStatus)) {
    return jsonError(422, "Энэ мөрийг цуцлах боломжгүй.");
  }

  const restoreStock = Boolean(item.serviceId && item.service?.type === "GOODS");

  await prisma.$transaction(async (tx) => {
    await tx.serviceItem.update({
      where: { id: item.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: auth.user.id,
      },
    });

    await logAudit(
      {
        tenantId,
        userId: auth.user.id,
        entity: "ServiceOrder",
        entityId: order.id,
        action: "ITEM_CANCELLED",
        summary: `cancelled item ${item.id}`,
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
          summary: `+${item.quantity.toString()} (мөр цуцалсан)`,
          after: { delta: `+${item.quantity.toString()}`, reason: "ORDER_ITEM_CANCEL" },
        },
        tx,
      );
    }

    const items = await tx.serviceItem.findMany({
      where: { orderId: order.id, status: { not: "CANCELLED" } },
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
