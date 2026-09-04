import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { ownedVehicleIdsForAccount } from "@/lib/vehicles";

// GET /api/v1/app/orders — миний үйлчилгээний түүх (auth, бүх байгууллага
// дамнасан). Захиалга бүрт хавсаргасан оношилгооны тайлангийн товч жагсаалт
// (reports) хавсарна — дэлгэрэнгүй бөглөлтийг [id] дуудлагаас авна.
export async function GET(req: Request) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const url = new URL(req.url);
  const vehicleIdFilter = url.searchParams.get("vehicleId")?.trim() || undefined;
  const { page, pageSize, skip, take } = getApiPageInfo(url.searchParams);

  // Эзэмшлийн машинууд (баталгаажсан холбоос) — account/history веб хуудастай
  // ижил зарчим (харах: lib/vehicles.ts ownedVehicleIdsForAccount).
  const ownedVehicleIds = await ownedVehicleIdsForAccount(account.id, account.phone);

  const where: Prisma.ServiceOrderWhereInput = {
    OR: [
      { customer: { accountId: account.id } },
      ...(ownedVehicleIds.length
        ? [{ vehicleId: { in: ownedVehicleIds } }]
        : []),
    ],
  };
  if (vehicleIdFilter) where.vehicleId = vehicleIdFilter;

  const [orders, total] = await Promise.all([
    prisma.serviceOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        scheduledAt: true,
        completedAt: true,
        createdAt: true,
        totalAmount: true,
        paidAmount: true,
        tenant: { select: { name: true, slug: true } },
        branch: { select: { name: true } },
        vehicle: {
          select: { plate: true, make: true, model: true, year: true },
        },
        _count: { select: { items: true } },
        reports: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            mileageAtReport: true,
            template: { select: { name: true, type: true } },
          },
        },
      },
    }),
    prisma.serviceOrder.count({ where }),
  ]);

  const shaped = orders.map((o) => {
    const { _count, reports, ...rest } = o;
    return {
      ...rest,
      itemCount: _count.items,
      reports: reports.map((r) => ({
        id: r.id,
        type: r.template.type,
        templateName: r.template.name,
        mileageAtReport: r.mileageAtReport,
        createdAt: r.createdAt,
      })),
    };
  });

  return jsonOk({ orders: shaped, pagination: buildMeta(total, page, pageSize) });
}
