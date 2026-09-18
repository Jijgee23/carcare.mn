import { jsonOk, requireApiUser } from "@/lib/api";
import { eligibleBranchIds } from "@/lib/auth/roles";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { ApiUser } from "@/lib/auth/api-token";

/**
 * Build the tenant- and eligibility-scoped predicate used by both the list
 * and count queries. A floating employee with no eligible IDs intentionally
 * receives all active branches in their own tenant, matching the switchable
 * branch endpoint's semantics.
 */
export function branchListWhere(user: Pick<ApiUser, "tenantId" | "isOwner" | "branchId" | "assignableBranchIds">) {
  const eligible = user.isOwner ? [] : eligibleBranchIds(user);

  return {
    tenantId: user.tenantId,
    isActive: true,
    ...(!user.isOwner && eligible.length > 0 ? { id: { in: eligible } } : {}),
  };
}

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const { page, pageSize, skip, take } = getApiPageInfo(url.searchParams);
  const where = branchListWhere(auth.user);

  const [branches, total] = await Promise.all([
    prisma.branch.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
      select: { id: true, name: true, address: true, phone: true },
    }),
    prisma.branch.count({ where }),
  ]);

  return jsonOk({ branches, pagination: buildMeta(total, page, pageSize) });
}
