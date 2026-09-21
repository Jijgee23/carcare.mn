import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import { ItemKind } from "@/app/generated/prisma/client";
import {
  cancelOrderItemCommand,
  ORDER_ITEM_PATCH_KEYS,
  parseOrderItemDecimal,
  patchOrderItemCommand,
  updateOrderItemCommand,
} from "@/lib/orders/order-item-commands";
import { OrderCommandError } from "@/lib/orders/order-commands";
import type { ServiceItemStatus } from "@/lib/orders";

function commandError(error: unknown): Response {
  if (error instanceof OrderCommandError) return jsonError(error.status, error.message, { code: error.code, fieldErrors: error.fieldErrors });
  console.error("[orders/items/item] command failed", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
  return jsonError(500, "Үйлдлийг гүйцэтгэх боломжгүй байна.");
}

async function authForItem(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return { auth, response: auth.response, scope: null } as const;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return { auth, response: locked, scope: null } as const;
  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return { auth, response: scopeResult.response, scope: null } as const;
  return { auth, response: null, scope: scopeResult.branchId } as const;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const { auth, response, scope } = await authForItem(req);
  if (response) return response;
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError(400, "JSON body шаардлагатай."); }
  if (body == null || typeof body !== "object" || Array.isArray(body)) return jsonError(400, "JSON object шаардлагатай.");
  const b = body as Record<string, unknown>;
  const keys = Object.keys(b);
  const unknownKeys = keys.filter((key) => !(ORDER_ITEM_PATCH_KEYS as readonly string[]).includes(key));
  if (keys.length === 0) return jsonError(400, "Мөрийн PATCH-д өөрчлөх талбар шаардлагатай.", { code: "ITEM_PATCH_EMPTY" });
  if (unknownKeys.length > 0) return jsonError(400, "Мөрийн PATCH-д дэмжигдээгүй талбар байна.", { code: "ITEM_PATCH_FIELDS_INVALID" });
  const { id, itemId } = await ctx.params;
  try {
    const hasStatus = b.status !== undefined;
    const hasPrice = b.unitPrice !== undefined;
    const hasEditableFields = ["kind", "description", "quantity"].some((key) => b[key] !== undefined);
    if (hasEditableFields) {
      const denied = requirePermission(auth.user, "orders.edit");
      if (denied && !auth.user.role?.permissions.includes("orders.editOwn")) return denied;
    }
    if (hasStatus) {
      const denied = requirePermission(auth.user, "orders.itemStatus");
      if (denied) return denied;
      if (typeof b.status !== "string" || !["PENDING", "IN_PROGRESS", "COMPLETED"].includes(b.status)) return jsonError(422, "Мөрийн явц буруу.");
    }
    let unitPrice: ReturnType<typeof parseOrderItemDecimal> = null;
    if (hasPrice) {
      const denied = requirePermission(auth.user, "orders.itemPrice");
      if (denied) return denied;
      unitPrice = parseOrderItemDecimal(b.unitPrice, 2);
      if (!unitPrice) return jsonError(422, "Хүсэлт буруу.", { fieldErrors: { unitPrice: "Үнэ буруу." } });
    }
    if (hasEditableFields || hasStatus || hasPrice) {
      const kind = b.kind === undefined ? undefined : typeof b.kind === "string" ? b.kind.trim() as ItemKind : "" as ItemKind;
      const description = b.description === undefined ? undefined : typeof b.description === "string" ? b.description.trim() : "";
      const quantity = b.quantity === undefined ? undefined : parseOrderItemDecimal(b.quantity, 3);
      if (b.quantity !== undefined && !quantity) return jsonError(422, "Хүсэлт буруу.", { fieldErrors: { quantity: "Тоо хэмжээ буруу." } });
      const nextStatus = hasStatus ? b.status as Exclude<ServiceItemStatus, "CANCELLED"> : undefined;
      const updatedItem = await patchOrderItemCommand({ actor: auth.user, orderId: id, itemId, kind, description, quantity: quantity ?? undefined, unitPrice: unitPrice ?? undefined, nextStatus, scope });
      return jsonOk({ item: updatedItem });
    }
    const updatedItem = await updateOrderItemCommand({ actor: auth.user, orderId: id, itemId, scope });
    return jsonOk({ item: updatedItem });
  } catch (error) {
    return commandError(error);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const { auth, response, scope } = await authForItem(req);
  if (response) return response;
  const denied = requirePermission(auth.user, "orders.edit");
  if (denied && !auth.user.role?.permissions.includes("orders.editOwn")) return denied;
  const { id, itemId } = await ctx.params;
  try {
    const result = await cancelOrderItemCommand({ actor: auth.user, orderId: id, itemId, scope });
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return commandError(error);
  }
}
