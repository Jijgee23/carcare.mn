import { jsonError, jsonOk } from "@/lib/api";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { ORDER_STATUS_HISTORY_CUSTOMER_SELECT } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { ownedVehicleIdsForAccount } from "@/lib/vehicles";

// GET /api/v1/app/orders/[id] — нэг засварын хуудасны дэлгэрэнгүй + хавсаргасан
// оношилгооны тайлангуудын БҮРЭН бөглөлт (template.schema-тай хамт, апп талд
// шууд харуулахад зориулав). Зөвшөөрөл: account/history веб хуудастай ижил —
// засварын хуудас account-тай холбоотой Customer-ийнх ЭСВЭЛ эзэмшлийн машины
// засварын хуудас байх ёстой.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const { id } = await ctx.params;
  const ownedVehicleIds = await ownedVehicleIdsForAccount(account.id, account.phone);

  const order = await prisma.serviceOrder.findFirst({
    where: {
      id,
      OR: [
        { customer: { accountId: account.id } },
        ...(ownedVehicleIds.length
          ? [{ vehicleId: { in: ownedVehicleIds } }]
          : []),
      ],
    },
    select: {
      id: true,
      number: true,
      status: true,
      paymentStatus: true,
      scheduledAt: true,
      completedAt: true,
      createdAt: true,
      notes: true,
      totalAmount: true,
      paidAmount: true,
      tenant: { select: { name: true, slug: true } },
      branch: { select: { name: true, phone: true } },
      vehicle: {
        select: { plate: true, make: true, model: true, year: true },
      },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          description: true,
          quantity: true,
          unitPrice: true,
          total: true,
          status: true,
        },
      },
      reports: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          templateVersion: true,
          data: true,
          signatureUrl: true,
          mileageAtReport: true,
          notes: true,
          createdAt: true,
          template: { select: { name: true, type: true, schema: true } },
        },
      },
      statusChanges: {
        orderBy: { createdAt: "desc" },
        select: ORDER_STATUS_HISTORY_CUSTOMER_SELECT,
      },
      timeBookings: {
        where: { kind: "SCHEDULED", closedAt: null },
        select: { startAt: true },
        take: 1,
      },
    },
  });
  if (!order) return jsonError(404, "Засварын хуудас олдсонгүй.");

  const { reports, statusChanges, timeBookings, ...rest } = order;
  return jsonOk({
    order: {
      ...rest,
      statusHistory: statusChanges,
      scheduledReturnAt: timeBookings[0]?.startAt ?? null,
      reports: reports.map((r) => ({
        id: r.id,
        type: r.template.type,
        templateName: r.template.name,
        templateSchema: r.template.schema,
        templateVersion: r.templateVersion,
        data: r.data,
        signatureUrl: r.signatureUrl,
        mileageAtReport: r.mileageAtReport,
        notes: r.notes,
        createdAt: r.createdAt,
      })),
    },
  });
}
