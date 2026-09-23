// Explicit-whitelist DTO builder for Role rows. Roles carry no secret
// fields today, but the whitelist keeps the same shape as
// `lib/employees/dto.ts` and protects against a future column (e.g. an
// internal note) leaking by default.

import type { RoleRow } from "./types";

export type FullRoleRow = Required<Pick<RoleRow, "id" | "name" | "description" | "permissions" | "isActive">> & {
  _count?: { users: number };
};

export type RoleDto = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isActive: boolean;
  userCount?: number;
};

export function toRoleDto(row: FullRoleRow): RoleDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    permissions: row.permissions,
    isActive: row.isActive,
    ...(row._count ? { userCount: row._count.users } : {}),
  };
}
