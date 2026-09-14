import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { ownedVehicleIdsForAccount } from "@/lib/vehicles";
import { bookingDateKey, bookingDayBounds } from "@/lib/booking-time";

// GET /api/v1/app/orders — миний үйлчилгээний түүх (auth, бүх байгууллага
// дамнасан). Засварын хуудас бүрт хавсаргасан оношилгооны тайлангийн товч жагсаалт
// (reports) хавсарна — дэлгэрэнгүй бөглөлтийг [id] дуудлагаас авна.
export async function GET(req: Request) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const url = new URL(req.url);
  const vehicleIdFilter = url.searchParams.get("vehicleId")?.trim() || undefined;
  const { page, pageSize, skip, take } = getApiPageInfo(url.searchParams);
  const q = url.searchParams.get("q")?.trim() || undefined;
  const yearRaw = url.searchParams.get("year")?.trim();
  const year = yearRaw ? Number(yearRaw) : undefined;
  if (
    yearRaw &&
    (!/^\d{4}$/.test(yearRaw) ||
      year == null ||
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100)
  ) {
    return jsonError(400, "Он буруу байна.");
  }

  // Эзэмшлийн машинууд (баталгаажсан холбоос) — account/history веб хуудастай
  // ижил зарчим (харах: lib/vehicles.ts ownedVehicleIdsForAccount).
  const ownedVehicleIds = await ownedVehicleIdsForAccount(account.id, account.phone);

  const where: Prisma.ServiceOrderWhereInput = {
    // Дууссан AND цуцлагдсан ажлыг харуулна (D-085) — SCHEDULED/IN_PROGRESS
    // хараахан идэвхтэй, /api/v1/app/appointments дээр харагдана.
    // Төлбөрийн төлөв нэмэлт шүүлт биш: төлөгдөөгүй ч дууссан ажил энд
    // харагдана (chip нь unpaid/partial/paid-г тусад нь харуулна).
    status: { in: ["COMPLETED", "CANCELLED"] },
    OR: [
      { customer: { accountId: account.id } },
      ...(ownedVehicleIds.length
        ? [{ vehicleId: { in: ownedVehicleIds } }]
        : []),
    ],
  };
  if (vehicleIdFilter) where.vehicleId = vehicleIdFilter;
  if (year) {
    const bounds = bookingDayBounds(`${year}-01-01`);
    const nextBounds = bookingDayBounds(`${year + 1}-01-01`);
    where.completedAt = {
      gte: bounds.start,
      lt: nextBounds.start,
    };
  }
  if (q) {
    where.AND = [
      {
        OR: [
          { tenant: { name: { contains: q, mode: "insensitive" } } },
          { tenant: { slug: { contains: q, mode: "insensitive" } } },
          { branch: { name: { contains: q, mode: "insensitive" } } },
          { vehicle: { plate: { contains: q, mode: "insensitive" } } },
          { vehicle: { make: { contains: q, mode: "insensitive" } } },
          { vehicle: { model: { contains: q, mode: "insensitive" } } },
          { number: { contains: q } },
        ],
      },
    ];
  }

  const cancelledWhere: Prisma.AppointmentWhereInput = {
    accountId: account.id,
    status: { in: ["CANCELLED", "NO_SHOW", "REJECTED"] },
    serviceOrderId: null,
  };
  if (year) {
    const bounds = bookingDayBounds(`${year}-01-01`);
    const nextBounds = bookingDayBounds(`${year + 1}-01-01`);
    cancelledWhere.requestedAt = {
      gte: bounds.start,
      lt: nextBounds.start,
    };
  }
  if (q) {
    cancelledWhere.AND = [
      {
        OR: [
          { tenant: { name: { contains: q, mode: "insensitive" } } },
          { tenant: { slug: { contains: q, mode: "insensitive" } } },
          { branch: { name: { contains: q, mode: "insensitive" } } },
          { category: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
    ];
  }

  const facetOrders = await prisma.serviceOrder.findMany({
    where: {
      status: { in: ["COMPLETED", "CANCELLED"] },
      OR: [
        { customer: { accountId: account.id } },
        ...(ownedVehicleIds.length ? [{ vehicleId: { in: ownedVehicleIds } }] : []),
      ],
    },
    select: { completedAt: true },
  });
  const facetCancelled = await prisma.appointment.findMany({
    where: {
      accountId: account.id,
      status: { in: ["CANCELLED", "NO_SHOW", "REJECTED"] },
      serviceOrderId: null,
    },
    select: { requestedAt: true },
  });
  const availableYears = [
    ...new Set([
      ...facetOrders.flatMap((row) => (row.completedAt ? [Number(bookingDateKey(row.completedAt).slice(0, 4))] : [])),
      ...facetCancelled.map((row) => Number(bookingDateKey(row.requestedAt).slice(0, 4))),
    ]),
  ].sort((a, b) => b - a);

  const [orders, total, cancelledAppointments, cancelledTotal] = await Promise.all([
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

    // D-085: keep terminal appointments separate from service orders, but
    // apply the same filters and page window so neither list has a hidden cap.
    prisma.appointment.findMany({
      where: cancelledWhere,
      orderBy: { requestedAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        status: true,
        requestedAt: true,
        tenant: { select: { name: true, slug: true } },
        branch: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.appointment.count({ where: cancelledWhere }),
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

  return jsonOk({
    orders: shaped,
    pagination: buildMeta(total, page, pageSize),
    cancelledAppointments,
    cancelledPagination: buildMeta(cancelledTotal, page, pageSize),
    availableYears,
  });
}
