import { jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

/**
 * GET /api/v1/app/service-keys — идэвхтэй SystemServiceKey-үүдийн жагсаалт
 * (нийтэд нээлттэй, org сонголтоос өмнөх "ямар ажил хийлгэх гэж байна?"
 * сонголтод зориулав — харах: /api/v1/app/orgs-ийн branch.serviceKeyIds).
 */
export async function GET() {
  setBypassContext();
  // Ямар ч ангилалд холбогдоогүй түлхүүрийг ШҮҮНЭ ГАРГАНА — сонговол
  // баталгаатай хоосон салбарын жагсаалт буцаах сонголтыг харуулахгүй (харах:
  // web-ийн app/(app)/discover/page.tsx-ийн ижил шийдвэр).
  const serviceKeys = await prisma.systemServiceKey.findMany({
    where: { isActive: true, categories: { some: { isActive: true } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return jsonOk({ serviceKeys });
}
