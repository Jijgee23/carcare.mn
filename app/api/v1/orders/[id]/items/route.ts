import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { ITEM_KINDS, isOrderLocked, type ItemKind, type OrderStatus } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

// Service.type → ServiceItem.kind тааруулга (DIAGNOSTIC-г template-ээр нэмнэ)
const SERVICE_KIND_TO_ITEM_KIND: Record<string, ItemKind> = {
  LABOR: "LABOR",
  GOODS: "PART",
};

// Decimal баганын хязгаар: quantity Decimal(12,3), unitPrice/total Decimal(12,2).
// Хэт том утга DB бичихэд алдаа өгөхөөс сэргийлж app-level дээр хязгаарлана.
const MAX_QUANTITY = new Prisma.Decimal(1_000_000);
const MAX_UNIT_PRICE = new Prisma.Decimal(1_000_000_000);
const MAX_TOTAL = new Prisma.Decimal("9999999999.99");

// Нөөц хүрэлцэхгүй үед transaction-г rollback хийхэд хэрэглэх sentinel.
class StockError extends Error {}

// Хэрэглэгчээс ирсэн утгыг 0+ finite Decimal болгож хувиргана (буруу бол null).
function parseDecimal(v: unknown): Prisma.Decimal | null {
  const str =
    typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  if (!str) return null;
  let d: Prisma.Decimal;
  try {
    d = new Prisma.Decimal(str);
  } catch {
    return null;
  }
  if (!d.isFinite() || d.lt(0)) return null;
  return d;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.edit");
  if (denied) return denied;

  const tenantId = auth.user.tenantId;

  const order = await prisma.serviceOrder.findFirst({
    where: { id: params.id, tenantId },
    select: { id: true, status: true },
  });
  if (!order) return jsonError(404, "Захиалга олдсонгүй.");
  if (isOrderLocked(order.status as OrderStatus)) {
    return jsonError(
      422,
      "Дууссан эсвэл цуцлагдсан захиалганд мөр нэмэх боломжгүй.",
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const serviceIdRaw = str(b.serviceId);
  const templateIdRaw = str(b.diagnosticTemplateId);
  let kind = str(b.kind) as ItemKind;
  let description = str(b.description);
  const quantity = parseDecimal(b.quantity ?? 1);
  let unitPrice = parseDecimal(b.unitPrice);

  let serviceId: string | null = null;
  let isGoods = false;

  // --- Каталог / загвараас server-authoritative утга гаргах ---
  if (templateIdRaw) {
    // Оношилгооны загвар — DIAGNOSTIC мөр
    const tpl = await prisma.diagnosticTemplate.findFirst({
      where: { id: templateIdRaw, tenantId, isActive: true },
      select: { id: true, name: true, price: true },
    });
    if (!tpl) {
      return jsonError(422, "Хүсэлт буруу.", {
        fieldErrors: { diagnosticTemplateId: "Оношилгоо олдсонгүй." },
      });
    }
    kind = "DIAGNOSTIC";
    if (!description) description = tpl.name;
    if (!unitPrice) unitPrice = tpl.price ?? new Prisma.Decimal(0);
  } else if (serviceIdRaw) {
    // Үйлчилгээний каталог — serviceId-г tenant-аар баталгаажуулна
    const svc = await prisma.service.findFirst({
      where: { id: serviceIdRaw, tenantId, isActive: true },
      select: {
        id: true,
        type: true,
        name: true,
        code: true,
        price: true,
        stock: true,
        unit: { select: { name: true } },
      },
    });
    if (!svc) {
      return jsonError(422, "Хүсэлт буруу.", {
        fieldErrors: { serviceId: "Үйлчилгээ олдсонгүй." },
      });
    }
    const mappedKind = SERVICE_KIND_TO_ITEM_KIND[svc.type];
    if (!mappedKind) {
      return jsonError(422, "Хүсэлт буруу.", {
        fieldErrors: { serviceId: "Үйлчилгээний төрөл буруу." },
      });
    }
    serviceId = svc.id;
    kind = mappedKind;
    isGoods = svc.type === "GOODS";
    if (!description) {
      description = svc.code ? `${svc.name} (${svc.code})` : svc.name;
    }
    if (!unitPrice) unitPrice = svc.price;

    if (isGoods && quantity && svc.stock && svc.stock.lt(quantity)) {
      return jsonError(422, "Хүсэлт буруу.", {
        fieldErrors: {
          quantity: `Үлдэгдэл хүрэхгүй (одоо: ${svc.stock.toString()}${svc.unit?.name ? ` ${svc.unit.name}` : ""}).`,
        },
      });
    }
  }

  // --- Validation ---
  const fieldErrors: Record<string, string> = {};
  if (!(ITEM_KINDS as readonly string[]).includes(kind))
    fieldErrors.kind = "Мөрийн төрөл буруу. (LABOR, DIAGNOSTIC, PART, FEE)";
  if (!description) fieldErrors.description = "Тайлбар оруулна уу.";
  if (!quantity || quantity.lte(0)) fieldErrors.quantity = "Тоо хэмжээ буруу.";
  else if (quantity.gt(MAX_QUANTITY)) fieldErrors.quantity = "Тоо хэмжээ хэт их.";
  if (!unitPrice) fieldErrors.unitPrice = "Үнэ буруу.";
  else if (unitPrice.gt(MAX_UNIT_PRICE)) fieldErrors.unitPrice = "Үнэ хэт их.";
  if (Object.keys(fieldErrors).length)
    return jsonError(422, "Хүсэлт буруу.", { fieldErrors });

  const total = quantity!.times(unitPrice!);
  if (total.gt(MAX_TOTAL)) {
    return jsonError(422, "Хүсэлт буруу.", {
      fieldErrors: { unitPrice: "Нийт дүн хэт их." },
    });
  }

  // --- Бичих (атомик): мөр үүсгэх + нөөц хорогдуулах + нийт дүн дахин тооцох + audit ---
  let createdItem;
  try {
    createdItem = await prisma.$transaction(async (tx) => {
      const item = await tx.serviceItem.create({
        data: {
          orderId: order.id,
          kind,
          description,
          quantity: quantity!,
          unitPrice: unitPrice!,
          total,
          serviceId,
        },
        select: {
          id: true,
          kind: true,
          description: true,
          quantity: true,
          unitPrice: true,
          total: true,
          serviceId: true,
        },
      });

      await logAudit(
        {
          tenantId,
          userId: auth.user.id,
          entity: "ServiceOrder",
          entityId: order.id,
          action: "ITEM_ADDED",
          summary: `${kind} · ${description} × ${quantity!.toString()} @ ${unitPrice!.toString()}`,
          after: {
            itemId: item.id,
            kind,
            description,
            quantity: quantity!.toString(),
            unitPrice: unitPrice!.toString(),
            total: total.toString(),
            serviceId,
          },
        },
        tx,
      );

      if (serviceId && isGoods) {
        const svcAfter = await tx.service.update({
          where: { id: serviceId },
          data: { stock: { decrement: quantity! } },
          select: { stock: true },
        });
        // Атомик decrement-ийн дараа сөрөг болбол зэрэгцээ хүсэлт нөөцийг
        // хэтрүүлсэн тул transaction-г бүхэлд нь буцаана.
        if (svcAfter.stock != null && svcAfter.stock.lt(0)) {
          throw new StockError();
        }
        await logAudit(
          {
            tenantId,
            userId: auth.user.id,
            entity: "Service",
            entityId: serviceId,
            action: "STOCK_CHANGE",
            summary: `-${quantity!.toString()} (захиалга #${order.id})`,
            after: { delta: `-${quantity!.toString()}`, reason: "ORDER_ITEM_ADD" },
          },
          tx,
        );
      }

      // Нийт дүнг бүх мөрөөс дахин тооцох (мөн транзакц дотор)
      const items = await tx.serviceItem.findMany({
        where: { orderId: order.id },
        select: { total: true },
      });
      const newTotal = items.reduce(
        (acc, it) => acc.plus(it.total),
        new Prisma.Decimal(0),
      );
      await tx.serviceOrder.update({
        where: { id: order.id },
        data: { totalAmount: newTotal },
      });

      return item;
    });
  } catch (e) {
    if (e instanceof StockError) {
      return jsonError(422, "Хүсэлт буруу.", {
        fieldErrors: { quantity: "Үлдэгдэл хүрэхгүй байна." },
      });
    }
    throw e;
  }

  return jsonOk({ item: createdItem }, { status: 201 });
}
