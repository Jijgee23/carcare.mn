import { Prisma } from "@/app/generated/prisma/client";
import { jsonOk, requireApiUser } from "@/lib/api";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const SERVICE_SELECT = {
  id: true,
  type: true,
  name: true,
  code: true,
  price: true,
  costPrice: true,
  stock: true,
  description: true,
  isActive: true,
  durationValue: true,
  unit: { select: { id: true, name: true, code: true } },
  durationUnit: { select: { id: true, name: true, code: true } },
  laborCategory: { select: { id: true, name: true } },
  createdAt: true,
} satisfies Prisma.ServiceSelect;

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const type = url.searchParams.get("type")?.trim() || undefined;
  const q = url.searchParams.get("q")?.trim() || undefined;
  const onlyActive = url.searchParams.get("isActive") !== "false";
  const { page, pageSize, skip, take } = getApiPageInfo(url.searchParams);

  const where: Prisma.ServiceWhereInput = {
    tenantId: auth.user.tenantId,
    ...(type && { type: type as any }),
    ...(onlyActive && { isActive: true }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: [{ type: "asc" }, { name: "asc" }],
      skip,
      take,
      select: SERVICE_SELECT,
    }),
    prisma.service.count({ where }),
  ]);

  return jsonOk({ services, pagination: buildMeta(total, page, pageSize) });
}
