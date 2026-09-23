// Contract — GET/POST /api/v1/roles (P6-B2)
//
// GET /api/v1/roles
//   Permission: read access is NOT owner-only. Measured against the web:
//   `app/dashboard/employees/new/page.tsx` (gated `canCreate(me,
//   "employees")`) and `app/dashboard/employees/[id]/page.tsx` (gated
//   `canEdit(me, "employees")`) both load the tenant's active role list to
//   populate the employee form's role picker, with NO owner check — only
//   `app/dashboard/employees/roles/page.tsx` (role *management*) is
//   `me.isOwner`-gated. So this route allows any of employees.view /
//   employees.create / employees.edit (the union the two loaders actually
//   require), not owner. Query: page?, pageSize?/limit? (standard
//   `parsePagination`, unknown params rejected).
//   200: { roles: RoleDto[], pagination: PaginationMeta }
//
// POST /api/v1/roles
//   Owner-only (`auth.user.isOwner`), matching `app/_actions/roles.ts`'s
//   `authorize()` — Role management is deliberately restricted to the
//   tenant admin regardless of any `employees.*`/other permission, because
//   a Role can grant permissions up to and including managing other Roles.
//   Body: { name, description?, permissions: string[], isActive?: boolean }
//   201: { role: RoleDto }
//   Errors: 400 (bad JSON), 401, 403 (not owner), 422 (VALIDATION /
//   DUPLICATE) — `{error, code, fieldErrors?}`.

import type { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonForbidden, jsonOk, requireApiUser } from "@/lib/api";
import { hasPermission } from "@/lib/auth/roles";
import { logAudit } from "@/lib/audit";
import { createRole } from "@/lib/roles/core";
import { toRoleDto, type FullRoleRow } from "@/lib/roles/dto";
import type { RoleActor } from "@/lib/roles/types";
import { parsePagination, rejectUnknownParams } from "@/lib/list-query-params";
import { buildMeta } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const ALLOWED_PARAMS = ["page", "pageSize", "limit"] as const;

const ROLE_SELECT = {
  id: true,
  name: true,
  description: true,
  permissions: true,
  isActive: true,
} satisfies Prisma.RoleSelect;

function canReadRoles(user: { isOwner: boolean; role?: { permissions: string[] } | null }): boolean {
  return (
    hasPermission(user, "employees.view") ||
    hasPermission(user, "employees.create") ||
    hasPermission(user, "employees.edit")
  );
}

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  if (!canReadRoles(auth.user)) return jsonForbidden();

  const url = new URL(req.url);
  const unknown = rejectUnknownParams(url.searchParams, ALLOWED_PARAMS);
  if (unknown) {
    return jsonError(422, unknown.message, {
      code: "VALIDATION",
      fieldErrors: { [unknown.field]: unknown.message },
    });
  }
  const paged = parsePagination(url.searchParams);
  if (!("page" in paged)) {
    return jsonError(422, paged.message, { code: "VALIDATION", fieldErrors: { [paged.field]: paged.message } });
  }
  const { page, pageSize, skip, take } = paged;

  const where: Prisma.RoleWhereInput = { tenantId: auth.user.tenantId };
  const [roles, total] = await Promise.all([
    prisma.role.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip,
      take,
      select: ROLE_SELECT,
    }),
    prisma.role.count({ where }),
  ]);

  return jsonOk({
    roles: roles.map((r) => toRoleDto(r as FullRoleRow)),
    pagination: buildMeta(total, page, pageSize),
  });
}

export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  if (!auth.user.isOwner) return jsonForbidden("Зөвхөн тенант админ үүргийг удирдана.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.", { code: "VALIDATION" });
  }
  if (!body || typeof body !== "object") {
    return jsonError(400, "Body буруу.", { code: "VALIDATION" });
  }
  const { name, description, permissions, isActive } = body as Record<string, unknown>;

  const fd = new FormData();
  fd.set("name", typeof name === "string" ? name : "");
  fd.set("description", typeof description === "string" ? description : "");
  if (Array.isArray(permissions)) {
    for (const p of permissions) {
      if (typeof p === "string") fd.append("permissions", p);
    }
  }
  fd.set("isActive", isActive === false ? "off" : "on");

  const actor: RoleActor = auth.user;
  const result = await createRole(prisma, actor, fd);
  if (!result.ok) {
    return jsonError(422, result.error, {
      code: result.code,
      ...("fieldErrors" in result ? { fieldErrors: result.fieldErrors } : {}),
    });
  }

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.id,
    entity: "Role",
    entityId: result.id,
    action: "CREATE",
    summary: result.summary,
    after: result.after as Prisma.InputJsonValue,
  });

  const created = await prisma.role.findFirst({
    where: { id: result.id, tenantId: actor.tenantId },
    select: ROLE_SELECT,
  });
  if (!created) return jsonError(404, "Үүрэг олдсонгүй.", { code: "NOT_FOUND" });

  return jsonOk({ role: toRoleDto(created as FullRoleRow) }, { status: 201 });
}
