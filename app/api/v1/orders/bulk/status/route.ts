import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import {
  bulkChangeOrderStatusCommand,
  parseBulkStatusBody,
} from "@/lib/orders/order-bulk-commands";

export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const editDenied = requirePermission(auth.user, "orders.edit");
  if (editDenied && !auth.user.role?.permissions.includes("orders.editOwn")) return editDenied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.", { code: "INVALID_BULK_REQUEST" });
  }
  const parsed = parseBulkStatusBody(body);
  if (!parsed.ok) {
    return jsonError(400, parsed.error.message, {
      code: "INVALID_BULK_REQUEST",
      field: parsed.error.field,
    });
  }

  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;
  const result = await bulkChangeOrderStatusCommand({
    actor: auth.user,
    orderIds: parsed.orderIds,
    nextStatus: parsed.status,
    durationMinutes: parsed.durationMinutes,
    scope: scopeResult.branchId,
  });
  return jsonOk(result);
}
