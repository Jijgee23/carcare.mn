import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
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

const KINDS = ["LABOR", "GOODS", "DIAGNOSTIC"] as const;

// POST /api/v1/services
export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError(400, "Буруу өгөгдөл");

  const {
    type, name, code, price, costPrice, stock, description, isActive,
    unitId, laborCategoryId, durationValue, durationUnitId,
  } = body as Record<string, unknown>;

  if (!type || !(KINDS as readonly string[]).includes(type as string))
    return jsonError(400, "Төрөл буруу байна (LABOR | GOODS | DIAGNOSTIC)");
  if (!name || typeof name !== "string" || !name.trim())
    return jsonError(400, "Нэр заавал шаардлагатай");

  const priceNum = Number(price);
  if (isNaN(priceNum) || priceNum < 0)
    return jsonError(400, "Үнэ буруу байна");

  const service = await prisma.service.create({
    data: {
      type: type as (typeof KINDS)[number],
      name: (name as string).trim(),
      code: typeof code === "string" && code.trim() ? code.trim() : null,
      price: priceNum,
      costPrice: costPrice !== undefined && costPrice !== "" ? Number(costPrice) || null : null,
      stock: stock !== undefined && stock !== "" ? Number(stock) || null : null,
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      isActive: isActive !== false,
      unitId: typeof unitId === "string" && unitId ? unitId : null,
      laborCategoryId: typeof laborCategoryId === "string" && laborCategoryId ? laborCategoryId : null,
      durationValue: durationValue !== undefined && durationValue !== "" ? Number(durationValue) || null : null,
      durationUnitId: typeof durationUnitId === "string" && durationUnitId ? durationUnitId : null,
      tenantId: auth.user.tenantId,
    },
    select: SERVICE_SELECT,
  });

  return jsonOk({ service });
}
