import { jsonError, jsonForbidden, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const SELECT = { id: true, name: true, code: true, isActive: true, createdAt: true };

// GET /api/v1/units
export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  // Unit-д өөрийн permission code байхгүй тул `services.view`-ээр хамгаална
  // (P4-B0b) — жагсаалт зөвхөн үйлчилгээний сонголтын picker-т ашиглагдана.
  const denied = requirePermission(auth.user, "services.view");
  if (denied) return denied;

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
  // Unit-д permission code байхгүй тул вэб дашбоардын `authorizeOwner()`-ийг
  // (app/_actions/units.ts) яг таг дуурайлган зөвхөн эзэмшигчид зөвшөөрнө.
  if (!auth.user.isOwner) return jsonForbidden();

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

  await logAudit({
    tenantId: auth.user.tenantId,
    userId: auth.user.id,
    entity: "Unit",
    entityId: unit.id,
    action: "CREATE",
    summary: unit.name,
    after: { name: unit.name, code: unit.code },
  });

  return jsonOk({ unit });
}
