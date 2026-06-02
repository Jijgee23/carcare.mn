import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const ITEM_KINDS = ["LABOR", "DIAGNOSTIC", "PART", "FEE"] as const;

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const order = await prisma.serviceOrder.findFirst({
    where: { id: params.id, tenantId: auth.user.tenantId },
    select: { id: true, status: true },
  });
  if (!order) return jsonError(404, "Захиалга олдсонгүй.");
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    return jsonError(422, "Дууссан эсвэл цуцлагдсан захиалганд мөр нэмэх боломжгүй.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }

  const b = body as Record<string, unknown>;
  const kind = typeof b.kind === "string" ? b.kind.trim() : "";
  const description = typeof b.description === "string" ? b.description.trim() : "";
  const quantity = Number(b.quantity ?? 1);
  const unitPrice = Number(b.unitPrice ?? 0);
  const serviceId =
    typeof b.serviceId === "string" ? b.serviceId.trim() || null : null;

  const fieldErrors: Record<string, string> = {};
  if (!ITEM_KINDS.includes(kind as (typeof ITEM_KINDS)[number]))
    fieldErrors.kind = "Мөрийн төрөл буруу. (LABOR, DIAGNOSTIC, PART, FEE)";
  if (!description) fieldErrors.description = "Тайлбар оруулна уу.";
  if (isNaN(quantity) || quantity <= 0) fieldErrors.quantity = "Тоо хэмжээ оруулна уу.";
  if (isNaN(unitPrice) || unitPrice < 0) fieldErrors.unitPrice = "Үнэ оруулна уу.";
  if (Object.keys(fieldErrors).length)
    return jsonError(422, "Хүсэлт буруу.", { fieldErrors });

  const total = quantity * unitPrice;

  const item = await prisma.serviceItem.create({
    data: {
      orderId: params.id,
      kind: kind as (typeof ITEM_KINDS)[number],
      description,
      quantity,
      unitPrice,
      total,
      ...(serviceId && { serviceId }),
    },
  });

  // Recalculate order total from all items
  const allItems = await prisma.serviceItem.findMany({
    where: { orderId: params.id },
    select: { total: true },
  });
  const newTotal = allItems.reduce((sum, i) => sum + Number(i.total), 0);
  await prisma.serviceOrder.update({
    where: { id: params.id },
    data: { totalAmount: newTotal },
  });

  return jsonOk({ item }, { status: 201 });
}
