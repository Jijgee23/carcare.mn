import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const SERVICE_DETAIL_SELECT = {
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
  updatedAt: true,
  _count: { select: { items: true } },
} satisfies Prisma.ServiceSelect;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const service = await prisma.service.findFirst({
    where: { id, tenantId: auth.user.tenantId },
    select: SERVICE_DETAIL_SELECT,
  });

  if (!service) return jsonError(404, "Үйлчилгээ олдсонгүй.");
  return jsonOk({ service });
}
