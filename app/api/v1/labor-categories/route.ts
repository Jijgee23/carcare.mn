import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const SELECT = { id: true, name: true, description: true, isActive: true, createdAt: true };

// GET /api/v1/labor-categories
export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "true";

  const categories = await prisma.laborCategory.findMany({
    where: { tenantId: auth.user.tenantId, ...(!all && { isActive: true }) },
    orderBy: { name: "asc" },
    select: SELECT,
  });

  return jsonOk({ categories });
}

// POST /api/v1/labor-categories
export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError(400, "Буруу өгөгдөл");

  const { name, description, isActive } = body as Record<string, unknown>;
  if (!name || typeof name !== "string" || !name.trim())
    return jsonError(400, "Нэр заавал шаардлагатай");

  const existing = await prisma.laborCategory.findFirst({
    where: { tenantId: auth.user.tenantId, name: (name as string).trim() },
  });
  if (existing) return jsonError(400, "Тийм нэртэй ангилал аль хэдийн байна");

  const category = await prisma.laborCategory.create({
    data: {
      name: (name as string).trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      isActive: isActive !== false,
      tenantId: auth.user.tenantId,
    },
    select: SELECT,
  });

  return jsonOk({ category });
}
