import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const SELECT = { id: true, name: true, code: true, isActive: true, createdAt: true };

// GET /api/v1/units
export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "true";

  const units = await prisma.unit.findMany({
    where: { tenantId: auth.user.tenantId, ...(!all && { isActive: true }) },
    orderBy: { name: "asc" },
    select: SELECT,
  });

  return jsonOk({ units });
}

// POST /api/v1/units
export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError(400, "Буруу өгөгдөл");

  const { name, code, isActive } = body as Record<string, unknown>;
  if (!name || typeof name !== "string" || !name.trim())
    return jsonError(400, "Нэр заавал шаардлагатай");

  const existing = await prisma.unit.findFirst({
    where: { tenantId: auth.user.tenantId, name: (name as string).trim() },
  });
  if (existing) return jsonError(400, "Тийм нэртэй нэгж аль хэдийн байна");

  const unit = await prisma.unit.create({
    data: {
      name: (name as string).trim(),
      code: typeof code === "string" && code.trim() ? code.trim() : null,
      isActive: isActive !== false,
      tenantId: auth.user.tenantId,
    },
    select: SELECT,
  });

  return jsonOk({ unit });
}
