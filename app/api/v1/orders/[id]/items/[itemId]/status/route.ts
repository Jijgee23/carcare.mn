import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import { changeOrderItemStatusCommand } from "@/lib/orders/order-item-commands";
import { OrderCommandError } from "@/lib/orders/order-commands";
import type { ServiceItemStatus } from "@/lib/orders";

export async function POST(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.itemStatus");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;
  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError(400, "JSON body шаардлагатай."); }
  if (body == null || typeof body !== "object" || Array.isArray(body)) return jsonError(400, "JSON object шаардлагатай.");
  const status = (body as Record<string, unknown>).status;
  if (typeof status !== "string" || !["PENDING", "IN_PROGRESS", "COMPLETED"].includes(status)) return jsonError(422, "Мөрийн явц буруу.");
  const { id, itemId } = await ctx.params;
  try {
    const item = await changeOrderItemStatusCommand({ actor: auth.user, orderId: id, itemId, nextStatus: status as Exclude<ServiceItemStatus, "CANCELLED">, scope: scopeResult.branchId });
    return jsonOk({ item });
  } catch (error) {
    if (error instanceof OrderCommandError) return jsonError(error.status, error.message, { code: error.code, fieldErrors: error.fieldErrors });
    console.error("[orders/items/status] command failed", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
    return jsonError(500, "Үйлдлийг гүйцэтгэх боломжгүй байна.");
  }
}
