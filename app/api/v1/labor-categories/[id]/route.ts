import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const SELECT = { id: true, name: true, description: true, isActive: true, createdAt: true };

// PATCH /api/v1/labor-categories/[id]
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const existing = await prisma.laborCategory.findFirst({
    where: { id, tenantId: auth.user.tenantId },
  });
  if (!existing) return jsonError(404, "Ангилал олдсонгүй");

  const body = await req.json().catch(() => null);
  if (!body) return jsonError(400, "Буруу өгөгдөл");

  const { name, description, isActive } = body as Record<string, unknown>;

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim())
      return jsonError(400, "Нэр хоосон байж болохгүй");
    const dup = await prisma.laborCategory.findFirst({
      where: { tenantId: auth.user.tenantId, name: (name as string).trim(), NOT: { id } },
    });
    if (dup) return jsonError(400, "Тийм нэртэй ангилал аль хэдийн байна");
  }

  const category = await prisma.laborCategory.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: (name as string).trim() }),
      ...(description !== undefined && {
        description: typeof description === "string" && description.trim() ? description.trim() : null,
      }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    },
    select: SELECT,
  });

  return jsonOk({ category });
}

// DELETE /api/v1/labor-categories/[id]
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const existing = await prisma.laborCategory.findFirst({
    where: { id, tenantId: auth.user.tenantId },
  });
  if (!existing) return jsonError(404, "Ангилал олдсонгүй");

  const usageCount = await prisma.service.count({
    where: { tenantId: auth.user.tenantId, laborCategoryId: id },
  });
  if (usageCount > 0)
    return jsonError(400, `${usageCount} үйлчилгээнд ашиглагдаж байгаа тул устгах боломжгүй`);

  await prisma.laborCategory.delete({ where: { id } });
  return jsonOk({ ok: true });
}
