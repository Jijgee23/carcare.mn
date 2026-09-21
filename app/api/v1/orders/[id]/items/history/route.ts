import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import {
  listCancelledOrderItems,
  MAX_ITEM_HISTORY_PAGE,
  MAX_ITEM_HISTORY_PAGE_SIZE,
  parseItemHistoryInteger,
} from "@/lib/orders/order-item-commands";
import { OrderCommandError } from "@/lib/orders/order-commands";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.itemHistory");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;
  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;
  const url = new URL(req.url);
  const page = parseItemHistoryInteger(url.searchParams.get("page"), 1, MAX_ITEM_HISTORY_PAGE);
  let pageSize = parseItemHistoryInteger(url.searchParams.get("pageSize"), 20, MAX_ITEM_HISTORY_PAGE_SIZE);
  if (url.searchParams.has("limit")) {
    const legacyLimit = parseItemHistoryInteger(url.searchParams.get("limit"), 20, MAX_ITEM_HISTORY_PAGE_SIZE);
    if (legacyLimit == null) return jsonError(400, "Хуудасны параметр буруу.");
    if (!url.searchParams.has("pageSize")) pageSize = legacyLimit;
  }
  if (page == null || pageSize == null) return jsonError(400, "Хуудасны параметр буруу.");
  const skip = (page - 1) * pageSize;
  if (!Number.isSafeInteger(skip)) return jsonError(400, "Хуудасны параметр буруу.");
  const { id } = await ctx.params;
  try {
    const result = await listCancelledOrderItems({ actor: auth.user, orderId: id, page, pageSize, scope: scopeResult.branchId });
    return jsonOk(result);
  } catch (error) {
    if (error instanceof OrderCommandError) return jsonError(error.status, error.message, { code: error.code, fieldErrors: error.fieldErrors });
    console.error("[orders/items/history] query failed", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
    return jsonError(500, "Түүхийг ачааллах боломжгүй байна.");
  }
}
