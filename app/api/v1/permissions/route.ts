// Contract — GET /api/v1/permissions (P6-B2)
//
// Serves the tenant-independent permission catalogue (`PERMISSIONS` in
// `lib/auth/permissions.ts`) for building a role's permission picker —
// same read gate as `GET /api/v1/roles` (see that route's doc comment):
// any of employees.view / employees.create / employees.edit, not
// owner-only, since the employee create/edit forms' role picker needs the
// label list too, not just role management.
//
// 200: {
//   groups: { group: string; items: { code, label, description }[] }[],
//   standalone: { code, label, description, group }[],
// }
// No query params, no body. Errors: 401, 403.

import { jsonForbidden, jsonOk, requireApiUser } from "@/lib/api";
import { hasPermission } from "@/lib/auth/roles";
import { STANDALONE_PERMISSIONS, permissionsByGroup } from "@/lib/auth/permissions";

function canReadPermissions(user: { isOwner: boolean; role?: { permissions: string[] } | null }): boolean {
  return (
    hasPermission(user, "employees.view") ||
    hasPermission(user, "employees.create") ||
    hasPermission(user, "employees.edit")
  );
}

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  if (!canReadPermissions(auth.user)) return jsonForbidden();

  const groups = permissionsByGroup().map(({ group, items }) => ({
    group,
    items: items.map((p) => ({ code: p.code, label: p.label, description: p.description })),
  }));
  const standalone = STANDALONE_PERMISSIONS.map((p) => ({
    code: p.code,
    label: p.label,
    description: p.description,
    group: p.group,
  }));

  return jsonOk({ groups, standalone });
}
