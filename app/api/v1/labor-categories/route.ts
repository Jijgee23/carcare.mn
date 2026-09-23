import { jsonError, jsonForbidden, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const SELECT = { id: true, name: true, description: true, isActive: true, createdAt: true };

// GET /api/v1/labor-categories
export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  // Category-д өөрийн permission code байхгүй тул `services.view`-ээр
  // хамгаална (P4-B0b) — жагсаалт зөвхөн үйлчилгээний сонголтын picker-т
  // ашиглагдана.
  const denied = requirePermission(auth.user, "services.view");
  if (denied) return denied;

  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "true";

  const categories = await prisma.category.findMany({
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
  // Category-д permission code байхгүй тул вэб дашбоардын `authorizeOwner()`-ийг
  // (app/_actions/categories.ts) яг таг дуурайлган зөвхөн эзэмшигчид зөвшөөрнө.
  if (!auth.user.isOwner) return jsonForbidden();

  const body = await req.json().catch(() => null);
  if (!body) return jsonError(400, "Буруу өгөгдөл");

  const { name, description, isActive } = body as Record<string, unknown>;
  if (!name || typeof name !== "string" || !name.trim())
    return jsonError(400, "Нэр заавал шаардлагатай");

  const existing = await prisma.category.findFirst({
    where: { tenantId: auth.user.tenantId, name: (name as string).trim() },
  });
  if (existing) return jsonError(400, "Тийм нэртэй ангилал аль хэдийн байна");

  // Мобайл апп системийн ангилал сонгох UI-гүй тул анхдагчаар "Ерөнхий"
  // түлхүүрт холбоно (харах: Category.systemServiceKeyId, вэб дээрх
  // CategoriesSection-ийн адил анхны утга).
  const generalKey = await prisma.systemServiceKey.findFirst({
    where: { name: "Ерөнхий" },
    select: { id: true },
  });
  if (!generalKey) return jsonError(500, "Системийн ерөнхий ангилал тохируулагдаагүй байна.");

  const category = await prisma.category.create({
    data: {
      name: (name as string).trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      isActive: isActive !== false,
      tenantId: auth.user.tenantId,
      systemServiceKeyId: generalKey.id,
    },
    select: SELECT,
  });

  await logAudit({
    tenantId: auth.user.tenantId,
    userId: auth.user.id,
    entity: "Category",
    entityId: category.id,
    action: "CREATE",
    summary: category.name,
    after: { name: category.name },
  });

  return jsonOk({ category });
}
