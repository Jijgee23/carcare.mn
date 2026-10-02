import type { Prisma } from "@/app/generated/prisma/client";

export type EmployeeStatusFilter = "active" | "inactive" | "temp" | "expired" | undefined;

/** Жагсаалт (`page.tsx`) болон Excel export (`export/route.ts`) хоёул хуваалцах
 * шүүлтүүр — хайлт/үүрэг/салбар/төлөв бүгд ижил байх ёстой тул нэг эх сурвалжид. */
export function buildEmployeeWhere(
  tenantId: string,
  q: string,
  roleId: string,
  branchId: string,
  status: EmployeeStatusFilter,
): Prisma.UserWhereInput {
  // Tombstoned (self-deleted) users no longer exist as people — hide them
  // from every list/export; they stay resolvable by id elsewhere (e.g.
  // orders' assignedTo) since only this shared list-where filters them.
  const where: Prisma.UserWhereInput = { tenantId, deletedAt: null };
  // Хайлт болон "идэвхтэй" төлвийн OR-ууд хоёул where.OR-г ашиглавал
  // хоорондоо дарж бичих тул AND массивт тусад нь нэмнэ.
  const and: Prisma.UserWhereInput[] = [];

  const query = q.trim();
  if (query) {
    and.push({
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
      ],
    });
  }

  if (roleId === "__owner__") {
    where.isOwner = true;
  } else if (roleId) {
    where.roleId = roleId;
  }
  if (branchId) where.branchId = branchId;

  const now = new Date();
  if (status === "active") {
    where.isActive = true;
    where.verified = true;
    and.push({ OR: [{ activeUntil: null }, { activeUntil: { gt: now } }] });
  } else if (status === "inactive") {
    where.isActive = false;
  } else if (status === "expired") {
    where.activeUntil = { not: null, lte: now };
  } else if (status === "temp") {
    where.activeUntil = { not: null };
  }

  if (and.length > 0) where.AND = and;
  return where;
}
