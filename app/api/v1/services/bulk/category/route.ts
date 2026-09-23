// P4-B1 — Bulk service category re-assignment. Thin adapter over
// `bulkChangeServiceCategoryCommand` (`lib/services/service-commands.ts`).
// Per-item, NOT all-or-nothing — see that module's doc comment: a missing
// service id is a per-item failure, while a missing/empty `categoryId` for
// the whole request is a single 400, not a partial success (categories are
// mandatory on every Service).

import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import {
  ServiceCommandError,
  bulkChangeServiceCategoryCommand,
} from "@/lib/services/service-commands";

// POST /api/v1/services/bulk/category — permission: services.edit
// Body: `{ serviceIds: string[], categoryId: string }`.
// Response: `{ succeeded, failed, errors: string[] }` — every requested id is
// accounted for in `succeeded` (including a no-op when it already has the
// target category) or in `errors`; scope is never widened to rescue a batch.
export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "services.edit");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  if (!body || typeof body !== "object") return jsonError(400, "Body буруу.");

  const { serviceIds, categoryId } = body as Record<string, unknown>;

  if (!Array.isArray(serviceIds)) {
    return jsonError(400, "serviceIds массив байх ёстой.");
  }

  let result;
  try {
    result = await bulkChangeServiceCategoryCommand({
      actor: auth.user,
      categoryId: typeof categoryId === "string" ? categoryId : "",
      serviceIds: serviceIds.filter((x): x is string => typeof x === "string"),
    });
  } catch (e) {
    if (e instanceof ServiceCommandError) {
      return jsonError(e.status, e.message, { code: e.code });
    }
    throw e;
  }

  return jsonOk(result);
}
