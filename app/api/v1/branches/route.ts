import { jsonOk, requireApiUser } from "@/lib/api";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const { page, pageSize, skip, take } = getApiPageInfo(url.searchParams);
  const where = { tenantId: auth.user.tenantId };

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
