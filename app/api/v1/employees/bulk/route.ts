// Contract — POST /api/v1/employees/bulk (P6-B2)
//
// Bulk role/branch reassignment, matching the web's
// `bulkUpdateEmployeeRoleBranchAction` exactly (same core:
// `lib/employees/core.ts`'s `bulkUpdateEmployeeRoleBranch` — per-row,
// not all-or-nothing).
// Permission: employees.edit. Requires an active subscription.
// Body: { employeeIds: string[], roleId?: string, branchId?: string }
//   (at least one of roleId/branchId; at least one employeeId).
// 200: { succeeded: number, failed: number, errors: string[] }
//   (200 even when some/all rows failed — each row's own error is in
//   `errors`, matching the web's partial-success shape; only a
//   before-the-loop validation failure, e.g. no ids or role/branch not
//   found, returns a 4xx below).
// Errors: 400 (bad JSON), 401, 403 (permission / SUBSCRIPTION_EXPIRED),
// 422 (VALIDATION — no ids selected, or role/branch not found; message
// text carries the specific reason, `code: "VALIDATION"`).

import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { bulkUpdateEmployeeRoleBranch } from "@/lib/employees/core";
import type { EmployeeActor } from "@/lib/employees/types";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import { prisma } from "@/lib/prisma";

type BulkBody = {
  employeeIds?: unknown;
  roleId?: unknown;
  branchId?: unknown;
};

export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "employees.edit");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;

  let body: BulkBody;
  try {
    body = (await req.json()) as BulkBody;
  } catch {
    return jsonError(400, "JSON body шаардлагатай.", { code: "VALIDATION" });
  }
  if (!body || typeof body !== "object") {
    return jsonError(400, "Body буруу.", { code: "VALIDATION" });
  }

  const actor: EmployeeActor = auth.user;
  const ids = Array.isArray(body.employeeIds)
    ? body.employeeIds.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];

  const fd = new FormData();
  fd.set("employeeIdsJson", JSON.stringify(ids));
  if (typeof body.roleId === "string" && body.roleId) fd.set("roleId", body.roleId);
  if (typeof body.branchId === "string" && body.branchId) fd.set("branchId", body.branchId);

  const result = await bulkUpdateEmployeeRoleBranch(prisma, actor, fd);
  if (!("succeeded" in result)) {
    return jsonError(422, result.message, { code: "VALIDATION" });
  }

  return jsonOk({ succeeded: result.succeeded, failed: result.failed, errors: result.errors });
}
