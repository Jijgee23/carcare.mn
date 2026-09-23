// Framework-free validation for the employee form — moved verbatim from
// `app/_actions/employees.ts` so error messages/behaviour stay byte-identical.

import { isValidPhone, normalizePhone } from "@/lib/phone";
import type { ValidatedEmployee } from "./types";

export function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function validateCommon(
  fd: FormData,
  opts?: { requireRole?: boolean },
): {
  data: ValidatedEmployee;
  errors: Record<string, string>;
} {
  const requireRole = opts?.requireRole ?? true;
  const firstName = s(fd, "firstName");
  const lastName = s(fd, "lastName");
  // Нэвтрэх үед имэйлийг lowercase хийдэг тул хадгалахдаа ч мөн адил болгоно —
  // эс бол том үсэгтэй хадгалсан ажилтан нэвтэрч чадахгүй / давхцал танигдахгүй.
  const email = s(fd, "email").toLowerCase();
  const phone = s(fd, "phone");
  const roleId = s(fd, "roleId");
  const branchIdRaw = s(fd, "branchId");
  // Нэмэлт салбарууд — үндсэн салбараа давхардуулж сонгосон бол хасна.
  const assignableBranchIds = [...new Set(fd.getAll("assignableBranchIds"))]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .filter((v) => v !== branchIdRaw);
  const isActive = fd.get("isActive") !== "off"; // default true
  const activeUntilRaw = s(fd, "activeUntil");

  const errors: Record<string, string> = {};
  if (!lastName) errors.lastName = "Овгоо оруулна уу.";
  if (!firstName) errors.firstName = "Нэрээ оруулна уу.";
  if (!isEmail(email)) errors.email = "Имэйл хаяг буруу.";
  if (!phone) errors.phone = "Утасны дугаар оруулна уу.";
  else if (!isValidPhone(phone))
    errors.phone = "Утасны дугаар 8 оронтой тоо байх ёстой.";
  if (requireRole && !roleId) errors.roleId = "Үүрэг сонгоно уу.";

  let activeUntil: Date | null = null;
  if (activeUntilRaw) {
    const d = new Date(activeUntilRaw);
    if (!Number.isFinite(d.getTime())) {
      errors.activeUntil = "Огноо буруу.";
    } else {
      activeUntil = d;
    }
  }

  return {
    data: {
      firstName,
      lastName,
      email,
      // Канон 8 оронтой хэлбэрт хадгална (давхцал шалгахад тогтвортой байх).
      phone: normalizePhone(phone) ?? phone,
      roleId: roleId || null,
      branchId: branchIdRaw || null,
      assignableBranchIds,
      isActive,
      activeUntil,
    },
    errors,
  };
}
