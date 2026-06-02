import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; itemId: string } },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const order = await prisma.serviceOrder.findFirst({
    where: { id: params.id, tenantId: auth.user.tenantId },
    select: { id: true, status: true },
  });
  if (!order) return jsonError(404, "Захиалга олдсонгүй.");
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    return jsonError(422, "Дууссан эсвэл цуцлагдсан захиалганаас мөр устгах боломжгүй.");
  }

  const item = await prisma.serviceItem.findFirst({
    where: { id: params.itemId, orderId: params.id },
  });
  if (!item) return jsonError(404, "Мөр олдсонгүй.");

  await prisma.serviceItem.delete({ where: { id: params.itemId } });

  // Recalculate order total
  const allItems = await prisma.serviceItem.findMany({
    where: { orderId: params.id },
    select: { total: true },
  });
  const newTotal = allItems.reduce((sum, i) => sum + Number(i.total), 0);
  await prisma.serviceOrder.update({
    where: { id: params.id },
    data: { totalAmount: newTotal },
  });

  return jsonOk({ ok: true });
}
