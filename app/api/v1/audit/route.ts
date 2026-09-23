// Contract — GET /api/v1/audit (P7-B1)
//
// GET /api/v1/audit
//   Permission: audit.view
//   Query: q?, action?, entity?, userId?, from? (YYYY-MM-DD), to?
//     (YYYY-MM-DD), page? — page size fixed at 50 (`AUDIT_PAGE_SIZE`);
//     unknown params rejected with 422 `{error, code: "VALIDATION",
//     fieldErrors: {<param>: "..."}}`.
//   200: {
//     items: AuditLogDto[], // before/after redacted via redactAuditJson
//     pagination: PaginationMeta,
//     meta: {
//       actions: string[], // lib/audit.ts ACTION_TYPES — vocab for filter chips
//       entities: string[], // lib/audit.ts ENTITY_TYPES
//       users: { id: string; firstName: string; lastName: string }[], // tenant's users, for the actor filter
//     }
//   }
//   Errors: 400 (unused), 401, 403 (missing audit.view), 422 (VALIDATION).

import { ACTION_TYPES, ENTITY_TYPES } from "@/lib/audit";
import {
  auditPagination,
  buildAuditWhere,
  parseAuditPage,
  validateAuditRangeParams,
} from "@/lib/audit-query";
import { redactAuditJson } from "@/lib/audit-redact";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { optionalText, rejectUnknownParams } from "@/lib/list-query-params";
import { buildMeta } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const ALLOWED_PARAMS = ["q", "action", "entity", "userId", "from", "to", "page"] as const;

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "audit.view");
  if (denied) return denied;

  const { searchParams } = new URL(req.url);

  const unknown = rejectUnknownParams(searchParams, ALLOWED_PARAMS);
  if (unknown) {
    return jsonError(422, unknown.message, {
      code: "VALIDATION",
      fieldErrors: { [unknown.field]: unknown.message },
    });
  }

  const from = optionalText(searchParams, "from");
  const to = optionalText(searchParams, "to");
  const rangeErr = validateAuditRangeParams({ from, to });
  if (rangeErr) {
    return jsonError(422, rangeErr.message, {
      code: "VALIDATION",
      fieldErrors: { [rangeErr.field]: rangeErr.message },
    });
  }

  const q = optionalText(searchParams, "q");
  const action = optionalText(searchParams, "action");
  const entity = optionalText(searchParams, "entity");
  const userId = optionalText(searchParams, "userId");
  const page = parseAuditPage(searchParams.get("page") ?? undefined);

  const where = buildAuditWhere(auth.user.tenantId, { q, action, entity, userId, from, to });
  const { skip, take, pageSize } = auditPagination(page);

  const [logs, total, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({
      where: { tenantId: auth.user.tenantId },
      orderBy: [{ firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  return jsonOk({
    items: logs.map((l) => ({
      id: l.id,
      entity: l.entity,
      entityId: l.entityId,
      action: l.action,
      summary: l.summary,
      before: redactAuditJson(l.before),
      after: redactAuditJson(l.after),
      createdAt: l.createdAt.toISOString(),
      user: l.user
        ? { id: l.user.id, firstName: l.user.firstName, lastName: l.user.lastName, email: l.user.email }
        : null,
      branchId: l.branchId,
    })),
    pagination: buildMeta(total, page, pageSize),
    meta: {
      actions: ACTION_TYPES,
      entities: ENTITY_TYPES,
      users,
    },
  });
}
