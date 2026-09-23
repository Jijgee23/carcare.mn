// Contract — GET/PATCH/DELETE /api/v1/roles/[id] (P6-B2)
//
// GET    Read access matches `GET /api/v1/roles` — any of employees.view /
//        employees.create / employees.edit (see that route's doc comment
//        for why this is not owner-only). 200: { role: RoleDto }. 404
//        { error, code: "NOT_FOUND" } if missing/cross-tenant.
// PATCH  Owner-only, matching `app/_actions/roles.ts`. Whole-record
//        replace (name, description, permissions, isActive).
//        200: { role: RoleDto }.
// DELETE Owner-only. Blocked (409 ROLE_IN_USE) while any employee still
//        has the role — matches `deleteRole` in `lib/roles/core.ts`.
//        200: { role: { id: string } }.
//
// Errors (every branch): 401, 403 (not owner, for PATCH/DELETE), 404
// (NOT_FOUND), 409 (ROLE_IN_USE), 422 (VALIDATION / DUPLICATE) — always
// `{error, code, fieldErrors?}`.

import type { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonForbidden, jsonOk, requireApiUser } from "@/lib/api";
import { hasPermission } from "@/lib/auth/roles";
import { logAudit } from "@/lib/audit";
import { deleteRole, updateRole } from "@/lib/roles/core";
import { toRoleDto, type FullRoleRow } from "@/lib/roles/dto";
import type { RoleActor } from "@/lib/roles/types";
import { prisma } from "@/lib/prisma";

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

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  if (!canReadRoles(auth.user)) return jsonForbidden();
  const { id } = await ctx.params;

  const role = await prisma.role.findFirst({
    where: { id, tenantId: auth.user.tenantId },
    select: ROLE_SELECT,
  });
  if (!role) return jsonError(404, "Үүрэг олдсонгүй.", { code: "NOT_FOUND" });

  return jsonOk({ role: toRoleDto(role as FullRoleRow) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  if (!auth.user.isOwner) return jsonForbidden("Зөвхөн тенант админ үүргийг удирдана.");

  const { id } = await ctx.params;

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
  const result = await updateRole(prisma, actor, id, fd);
  if (!result.ok) {
    return jsonError(result.code === "NOT_FOUND" ? 404 : 422, result.error, {
      code: result.code,
      ...("fieldErrors" in result ? { fieldErrors: result.fieldErrors } : {}),
    });
  }

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.id,
    entity: "Role",
    entityId: id,
    action: "UPDATE",
    summary: result.summary,
    before: result.before as Prisma.InputJsonValue,
    after: result.after as Prisma.InputJsonValue,
  });

  const updated = await prisma.role.findFirst({
    where: { id, tenantId: actor.tenantId },
    select: ROLE_SELECT,
  });
  if (!updated) return jsonError(404, "Үүрэг олдсонгүй.", { code: "NOT_FOUND" });

  return jsonOk({ role: toRoleDto(updated as FullRoleRow) });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  if (!auth.user.isOwner) return jsonForbidden("Зөвхөн тенант админ үүргийг удирдана.");

  const { id } = await ctx.params;
  const actor: RoleActor = auth.user;

  const fd = new FormData();
  fd.set("id", id);

  const result = await deleteRole(prisma, actor, fd);
  if ("noop" in result) return jsonError(404, "Үүрэг олдсонгүй.", { code: "NOT_FOUND" });
  if (!result.ok) {
    return jsonError(409, result.error, { code: result.code });
  }

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.id,
    entity: "Role",
    entityId: result.id,
    action: "DELETE",
    summary: result.summary,
  });

  return jsonOk({ role: { id: result.id } });
}
