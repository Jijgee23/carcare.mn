import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import { changeOrderItemPriceCommand, parseOrderItemDecimal } from "@/lib/orders/order-item-commands";
import { OrderCommandError } from "@/lib/orders/order-commands";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.itemPrice");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;
  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError(400, "JSON body шаардлагатай."); }
  if (body == null || typeof body !== "object" || Array.isArray(body)) return jsonError(400, "JSON object шаардлагатай.");
  const unitPrice = parseOrderItemDecimal((body as Record<string, unknown>).unitPrice, 2);
  if (!unitPrice) return jsonError(422, "Хүсэлт буруу.", { fieldErrors: { unitPrice: "Үнэ буруу." } });
  const { id, itemId } = await ctx.params;
  try {
    const item = await changeOrderItemPriceCommand({ actor: auth.user, orderId: id, itemId, unitPrice, scope: scopeResult.branchId });
    return jsonOk({ item });
  } catch (error) {
    if (error instanceof OrderCommandError) return jsonError(error.status, error.message, { code: error.code, fieldErrors: error.fieldErrors });
    console.error("[orders/items/price] command failed", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
    return jsonError(500, "Үйлдлийг гүйцэтгэх боломжгүй байна.");
  }
}
