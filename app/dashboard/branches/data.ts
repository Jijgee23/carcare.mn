import type { Prisma } from "@/app/generated/prisma/client";

export type BranchStatusFilter = "active" | "inactive" | undefined;

/** Жагсаалт (`page.tsx`) болон Excel export (`export/route.ts`) хоёул хуваалцах
 * шүүлтүүр — хайлт/төлөв хоёул ижил байх ёстой тул нэг эх сурвалжид. */
export function buildBranchWhere(
  tenantId: string,
  q: string,
  status: BranchStatusFilter,
): Prisma.BranchWhereInput {
  const where: Prisma.BranchWhereInput = { tenantId };
  if (status === "active") where.isActive = true;
  else if (status === "inactive") where.isActive = false;

  const query = q.trim();
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { address: { contains: query, mode: "insensitive" } },
      { district: { contains: query, mode: "insensitive" } },
      { khoroo: { contains: query, mode: "insensitive" } },
      { phone: { contains: query } },
    ];
  }
  return where;
}
