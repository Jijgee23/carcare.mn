import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import {
  bulkAssignOrderCommand,
  parseBulkAssignmentBody,
} from "@/lib/orders/order-bulk-commands";

export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.assign");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.", { code: "INVALID_BULK_REQUEST" });
  }
  const parsed = parseBulkAssignmentBody(body);
  if (!parsed.ok) {
    return jsonError(400, parsed.error.message, {
      code: "INVALID_BULK_REQUEST",
      field: parsed.error.field,
    });
  }

  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;
  const result = await bulkAssignOrderCommand({
    actor: auth.user,
    orderIds: parsed.orderIds,
    assignedToId: parsed.assignedToId,
    scope: scopeResult.branchId,
  });
  return jsonOk(result);
}
