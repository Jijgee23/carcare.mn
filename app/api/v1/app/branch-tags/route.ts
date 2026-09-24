import { enforceRateLimit, jsonOk, PUBLIC_CATALOG_RATE_LIMIT } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

/**
 * GET /api/v1/app/branch-tags — идэвхтэй BranchTag-уудын жагсаалт (нийтэд
 * нээлттэй, discover дээр байгууллага/салбарыг бизнесийн төрлөөр шүүхэд
 * зориулав — харах: /api/v1/app/orgs-ийн branch.tagIds).
 */
export async function GET(req: Request) {
  const limited = enforceRateLimit(req, "public-catalog", PUBLIC_CATALOG_RATE_LIMIT);
  if (limited) return limited;
  setBypassContext();
  // Ямар ч салбарт холбогдоогүй шошгыг ШҮҮНЭ ГАРГАНА — сонговол баталгаатай
  // хоосон жагсаалт буцаах сонголтыг харуулахгүй (харах: service-keys
  // route-ийн ижил шийдвэр).
  const tags = await prisma.branchTag.findMany({
    where: { isActive: true, branches: { some: { isActive: true } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return jsonOk({ tags });
}
