// Explicit-whitelist DTO builder — structurally cannot emit passwordHash,
// failedLoginAttempts, lockedAt, or any OTP/verification-secret field, even
// if the row passed in carries them (as Prisma rows typically do).

import type { EmployeeRow } from "./types";

// The full-record shape the DTO builder expects (a fully-loaded employee,
// e.g. for a list/detail API response) — distinct from `EmployeeRow`, which
// is deliberately loose because `EmployeesClient` methods return whatever
// subset a `select` asked for.
export type FullEmployeeRow = Required<
  Pick<
    EmployeeRow,
    | "id"
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "isOwner"
    | "roleId"
    | "isActive"
    | "activeUntil"
    | "tenantId"
    | "branchId"
    | "assignableBranchIds"
    | "verified"
  >
> & { role?: { name: string } | null };

export type EmployeeDto = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isOwner: boolean;
  roleId: string | null;
  roleName: string | null;
  isActive: boolean;
  activeUntil: Date | null;
  tenantId: string;
  branchId: string | null;
  assignableBranchIds: string[];
  verified: boolean;
};

export function toEmployeeDto(row: FullEmployeeRow): EmployeeDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    isOwner: row.isOwner,
    roleId: row.roleId,
    roleName: row.role?.name ?? null,
    isActive: row.isActive,
    activeUntil: row.activeUntil,
    tenantId: row.tenantId,
    branchId: row.branchId,
    assignableBranchIds: row.assignableBranchIds,
    // Whether the employee has completed OTP activation — not a secret
    // itself (unlike passwordHash/failedLoginAttempts/lockedAt/OTP codes,
    // which this DTO never reads from `row` at all).
    verified: row.verified,
  };
}
