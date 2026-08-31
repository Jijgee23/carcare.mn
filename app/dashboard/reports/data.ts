import type { requireUser } from "@/lib/auth";
import { branchScopeId } from "@/lib/auth/roles";
import { customerLabel } from "@/lib/customers";
import {
  ITEM_KIND_LABEL,
  ORDER_STATUS_LABEL,
  type ItemKind,
  type OrderStatus,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { buildIncomeSeries, type ResolvedIncomeRange } from "../income-range";
import type { IncomePoint } from "../income-chart";

export type Range = { from: Date; to: Date; label: string; key: string };

const STATUS_ORDER: OrderStatus[] = [
  "SCHEDULED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "COMPLETED",
  "CANCELLED",
];
const KIND_ORDER: ItemKind[] = ["LABOR", "DIAGNOSTIC", "PART", "FEE"];

export function parseRange(searchParams: { from?: string; to?: string }): Range {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (searchParams.from || searchParams.to) {
    const from = searchParams.from
      ? new Date(`${searchParams.from}T00:00:00`)
      : startOfThisMonth;
    const to = searchParams.to
      ? new Date(`${searchParams.to}T23:59:59.999`)
      : now;
    return {
      from,
      to,
      label: `${from.toLocaleDateString("mn-MN")} – ${to.toLocaleDateString("mn-MN")}`,
      key: "custom",
    };
  }

  return {
    from: startOfThisMonth,
    to: now,
    label: "Энэ сар",
    key: "this-month",
  };
}

// Локал цагаар YYYY-MM-DD. toISOString() нь UTC руу хөрвүүлдэг тул UTC+8-д
// шөнө дундын огноо өмнөх өдөр рүү "гулсаж" муж 1 өдрөөр буруу болдгийг зассан.
export function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daySpan(from: Date, to: Date): number {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((sod(to).getTime() - sod(from).getTime()) / DAY_MS) + 1;
}

export type ReportData = {
  totalRevenue: number;
  completedCount: number;
  avgTicket: number;
  activeCount: number;
  statusRows: { status: OrderStatus; label: string; count: number; pct: number }[];
  kindRows: { kind: ItemKind; label: string; total: number; pct: number }[];
  branchRows: { id: string; name: string; revenue: number; count: number }[];
  techRows: { id: string; name: string; revenue: number; count: number }[];
  customerRows: {
    id: string;
    name: string;
    phone: string;
    revenue: number;
    count: number;
  }[];
  partRows: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    qty: number;
    revenue: number;
  }[];
  income: { points: IncomePoint[]; changePct: number | null };
};

export async function loadReportData(
  user: Awaited<ReturnType<typeof requireUser>>,
  range: Range,
): Promise<ReportData> {
  const scopeBranchId = branchScopeId(user);
  const branchFilter = scopeBranchId ? { branchId: scopeBranchId } : {};

  const completedWhere = {
    tenantId: user.tenantId,
    ...branchFilter,
    status: "COMPLETED" as const,
    completedAt: { gte: range.from, lte: range.to },
  };

  const allInRangeWhere = {
    tenantId: user.tenantId,
    ...branchFilter,
    OR: [
      { completedAt: { gte: range.from, lte: range.to } },
      { createdAt: { gte: range.from, lte: range.to } },
    ],
  };

  // 1-р давалгаа — нэгтгэлүүд (lookup entity-гүйгээр).
  const [
    revenueAgg,
    completedCount,
    statusCounts,
    byBranch,
    byTech,
    kindTotals,
    topCustomers,
    topPartsRaw,
    trendOrders,
  ] = await Promise.all([
    prisma.serviceOrder.aggregate({
      where: completedWhere,
      _sum: { totalAmount: true },
    }),
    prisma.serviceOrder.count({ where: completedWhere }),
    prisma.serviceOrder.groupBy({
      by: ["status"],
      where: allInRangeWhere,
      _count: { _all: true },
    }),
    prisma.serviceOrder.groupBy({
      by: ["branchId"],
      where: completedWhere,
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.serviceOrder.groupBy({
      by: ["assignedToId"],
      where: { ...completedWhere, assignedToId: { not: null } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.serviceItem.groupBy({
      by: ["kind"],
      where: {
        order: completedWhere,
      },
      _sum: { total: true },
    }),
    prisma.serviceOrder.groupBy({
      by: ["customerId"],
      where: completedWhere,
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    }),
    prisma.serviceItem.groupBy({
      by: ["serviceId"],
      where: {
        order: completedWhere,
        serviceId: { not: null },
        service: { type: "GOODS" },
      },
      _sum: { quantity: true, total: true },
      _count: { _all: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }),
    prisma.serviceOrder.findMany({
      where: completedWhere,
      select: { completedAt: true, totalAmount: true },
    }),
  ]);

  // 2-р давалгаа — зөвхөн дээрх нэгтгэлд гарч ирсэн ID-уудыг л нэрлэхийн тулд
  // татна. Өмнө нь бүх салбар/ажилтан/үйлчлүүлэгч/сэлбэгийг татдаг байсан нь
  // том tenant дээр удаан байсныг (top-5 гаргахад мянга мянган мөр) зассан.
  const branchIds = byBranch
    .map((r) => r.branchId)
    .filter((id): id is string => Boolean(id));
  const techIds = byTech
    .map((r) => r.assignedToId)
    .filter((id): id is string => Boolean(id));
  const customerIds = topCustomers
    .map((r) => r.customerId)
    .filter((id): id is string => Boolean(id));
  const partIds = topPartsRaw
    .map((r) => r.serviceId)
    .filter((id): id is string => Boolean(id));

  const [branchesMap, techsMap, customersMap, partsMap] = await Promise.all([
    branchIds.length
      ? prisma.branch.findMany({
          where: { tenantId: user.tenantId, id: { in: branchIds } },
          select: { id: true, name: true },
        })
      : [],
    techIds.length
      ? prisma.user.findMany({
          where: { tenantId: user.tenantId, id: { in: techIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [],
    customerIds.length
      ? prisma.customer.findMany({
          where: { tenantId: user.tenantId, id: { in: customerIds } },
          select: { id: true, fullName: true, phone: true },
        })
      : [],
    partIds.length
      ? prisma.service.findMany({
          where: { tenantId: user.tenantId, id: { in: partIds } },
          select: {
            id: true,
            code: true,
            name: true,
            unit: { select: { name: true } },
          },
        })
      : [],
  ]);

  const branchById = new Map(branchesMap.map((b) => [b.id, b]));
  const userById = new Map(techsMap.map((u) => [u.id, u]));
  const customerById = new Map(customersMap.map((c) => [c.id, c]));
  const partById = new Map(partsMap.map((p) => [p.id, p]));

  const totalRevenue = Number.parseFloat(
    revenueAgg._sum.totalAmount?.toString() ?? "0",
  );
  const avgTicket = completedCount > 0 ? totalRevenue / completedCount : 0;

  const statusCountMap = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count._all]),
  ) as Partial<Record<OrderStatus, number>>;
  const totalInRange = statusCounts.reduce((a, s) => a + s._count._all, 0);

  const statusRows = STATUS_ORDER.map((status) => {
    const count = statusCountMap[status] ?? 0;
    return {
      status,
      label: ORDER_STATUS_LABEL[status],
      count,
      pct: totalInRange > 0 ? Math.round((count / totalInRange) * 100) : 0,
    };
  });

  const activeCount =
    (statusCountMap.SCHEDULED ?? 0) +
    (statusCountMap.IN_PROGRESS ?? 0) +
    (statusCountMap.WAITING_PARTS ?? 0);

  // Branch breakdown
  const branchRows = byBranch
    .map((r) => ({
      id: r.branchId,
      name: branchById.get(r.branchId)?.name ?? "—",
      revenue: Number.parseFloat(r._sum.totalAmount?.toString() ?? "0"),
      count: r._count._all,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Technician breakdown
  const techRows = byTech
    .map((r) => {
      const u = r.assignedToId ? userById.get(r.assignedToId) : null;
      return {
        id: r.assignedToId ?? "—",
        name: u ? `${u.lastName} ${u.firstName}` : "Хариуцагчгүй",
        revenue: Number.parseFloat(r._sum.totalAmount?.toString() ?? "0"),
        count: r._count._all,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // Kind breakdown
  const kindTotalsRaw = KIND_ORDER.map((k) => {
    const found = kindTotals.find((kt) => kt.kind === k);
    return {
      kind: k,
      total: Number.parseFloat(found?._sum.total?.toString() ?? "0"),
    };
  });
  const kindTotal = kindTotalsRaw.reduce((a, r) => a + r.total, 0) || 1;
  const kindRows = kindTotalsRaw.map((r) => ({
    ...r,
    label: ITEM_KIND_LABEL[r.kind],
    pct: Math.round((r.total / kindTotal) * 100),
  }));

  // Top customers
  const customerRows = topCustomers.map((r) => {
    const c = customerById.get(r.customerId);
    return {
      id: r.customerId,
      name: c ? customerLabel(c) : "—",
      phone: c?.phone ?? "",
      revenue: Number.parseFloat(r._sum.totalAmount?.toString() ?? "0"),
      count: r._count._all,
    };
  });

  // Top parts (services of type GOODS)
  const partRows = topPartsRaw
    .filter((r) => r.serviceId)
    .map((r) => {
      const p = partById.get(r.serviceId!);
      return {
        id: r.serviceId!,
        name: p?.name ?? "—",
        sku: p?.code ?? "",
        unit: p?.unit?.name ?? "",
        qty: Number.parseFloat(r._sum.quantity?.toString() ?? "0"),
        revenue: Number.parseFloat(r._sum.total?.toString() ?? "0"),
      };
    });

  const incomeRange: ResolvedIncomeRange = {
    key: "custom",
    from: range.from,
    to: range.to,
    fetchFrom: range.from,
    bucket: daySpan(range.from, range.to) > 45 ? "week" : "day",
    label: range.label,
  };
  const incomeSeries = buildIncomeSeries(trendOrders, incomeRange);

  return {
    totalRevenue,
    completedCount,
    avgTicket,
    activeCount,
    statusRows,
    kindRows,
    branchRows,
    techRows,
    customerRows,
    partRows,
    income: { points: incomeSeries.points, changePct: incomeSeries.changePct },
  };
}
