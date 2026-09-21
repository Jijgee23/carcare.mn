import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import { cancelOrderItemCommand } from "@/lib/orders/order-item-commands";
import { OrderCommandError } from "@/lib/orders/order-commands";

export async function POST(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.edit");
  if (denied && !auth.user.role?.permissions.includes("orders.editOwn")) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;
  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;
  const { id, itemId } = await ctx.params;
  try {
    const result = await cancelOrderItemCommand({ actor: auth.user, orderId: id, itemId, scope: scopeResult.branchId });
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    if (error instanceof OrderCommandError) return jsonError(error.status, error.message, { code: error.code, fieldErrors: error.fieldErrors });
    console.error("[orders/items/cancel] command failed", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
    return jsonError(500, "Үйлдлийг гүйцэтгэх боломжгүй байна.");
  }
}
