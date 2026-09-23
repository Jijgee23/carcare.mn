// JSON body -> FormData glue shared by the employees mutation routes
// (POST /employees, PATCH /employees/[id], POST /employees/bulk). The
// employee business rules in `lib/employees/core.ts` (P6-B0) are
// `FormData`-shaped because they were moved verbatim from the web's
// `<form action={...}>` server actions — routes must call the same cores,
// not reimplement their validation/guards, so a JSON API body is translated
// into the same `FormData` shape here rather than duplicating any rule.
//
// This file is route glue only: it does no validation, no Prisma calls, no
// guard logic. Every field it sets is re-validated by `validateCommon`
// (lib/employees/validate.ts) exactly as the web form's submission is.

export type EmployeeJsonBody = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  roleId?: unknown;
  branchId?: unknown;
  assignableBranchIds?: unknown;
  isActive?: unknown;
  activeUntil?: unknown;
  isOwner?: unknown;
};

/**
 * Builds the same `FormData` shape `<EmployeeForm>` submits, from a JSON
 * request body. `isActive` defaults to `true` (matching
 * `validateCommon`'s `fd.get("isActive") !== "off"` default) unless the
 * body explicitly sends `isActive: false`.
 */
export function employeeBodyToFormData(body: EmployeeJsonBody): FormData {
  const fd = new FormData();
  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

  fd.set("firstName", str(body.firstName));
  fd.set("lastName", str(body.lastName));
  fd.set("email", str(body.email));
  fd.set("phone", str(body.phone));
  if (body.roleId != null) fd.set("roleId", str(body.roleId));
  if (body.branchId != null) fd.set("branchId", str(body.branchId));
  if (Array.isArray(body.assignableBranchIds)) {
    for (const id of body.assignableBranchIds) {
      if (typeof id === "string" && id) fd.append("assignableBranchIds", id);
    }
  }
  // Default true — only send "off" when the body explicitly opts out.
  fd.set("isActive", body.isActive === false ? "off" : "on");
  if (typeof body.activeUntil === "string" && body.activeUntil) {
    fd.set("activeUntil", body.activeUntil);
  }
  if (body.isOwner === true) fd.set("isOwner", "on");

  return fd;
}
