import type { PermissionCode, ResourceKey } from "./permissions";

// User-ийн эрхийн шалгалтын minimal shape — Prisma user object эсвэл API
// session payload-аас аль алин нь нийцэх ёстой.
export type RoleCheckUser = {
  isOwner: boolean;
  role?: { permissions: string[]; name?: string } | null;
};

/**
 * Тухайн permission code-той эсэхийг шалгана. OWNER (тенант админ) үргэлж true.
 */
export function hasPermission(
  user: RoleCheckUser,
  code: PermissionCode,
): boolean {
  if (user.isOwner) return true;
  if (!user.role || !user.role.permissions) return false;
  return user.role.permissions.includes(code);
}

export function canView(user: RoleCheckUser, resource: ResourceKey): boolean {
  return hasPermission(user, `${resource}.view`);
}

export function canCreate(user: RoleCheckUser, resource: ResourceKey): boolean {
  return hasPermission(user, `${resource}.create`);
}

export function canEdit(user: RoleCheckUser, resource: ResourceKey): boolean {
  return hasPermission(user, `${resource}.edit`);
}

export function canDelete(user: RoleCheckUser, resource: ResourceKey): boolean {
  return hasPermission(user, `${resource}.delete`);
}

/**
 * Хэрэглэгч тухайн нөөц дээр ямар нэг бичих эрхтэй эсэх — list page дээр "Add" /
 * "Засах" товчуудыг харуулах эсэхээс бусад coarse-grained gate-д.
 */
export function canManage(
  user: RoleCheckUser,
  resource?: ResourceKey,
): boolean {
  if (user.isOwner) return true;
  const perms = user.role?.permissions ?? [];
  if (!resource) {
    return perms.some(
      (p) => p.endsWith(".create") || p.endsWith(".edit") || p.endsWith(".delete"),
    );
  }
  return (
    perms.includes(`${resource}.create`) ||
    perms.includes(`${resource}.edit`) ||
    perms.includes(`${resource}.delete`)
  );
}

/**
 * UI дээр хэрэглэгчийн badge/label-д харуулах нэр.
 */
export function userRoleLabel(user: {
  isOwner: boolean;
  role?: { name: string } | null;
}): string {
  if (user.isOwner) return "Админ";
  return user.role?.name ?? "—";
}

/**
 * Захиалгад хариуцагч болж болох хэрэглэгчдийн filter (Prisma where-д).
 * isOwner=true бүх админ + `orders.assignable` permission-той Role-той ажилтнууд.
 */
export const ORDER_ASSIGNABLE_WHERE = {
  OR: [
    { isOwner: true },
    { role: { permissions: { has: "orders.assignable" } } },
  ],
};
