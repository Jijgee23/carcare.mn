import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const { id } = await ctx.params;
  const template = await prisma.diagnosticTemplate.findFirst({
    where: { id, tenantId: auth.user.tenantId },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      version: true,
      isActive: true,
      price: true,
      durationMin: true,
      schema: true,
      updatedAt: true,
    },
  });
  if (!template) return jsonError(404, "Загвар олдсонгүй.");

  return jsonOk({ template });
}
