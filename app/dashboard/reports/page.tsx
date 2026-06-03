import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { customerLabel } from "@/lib/customers";
import {
  ITEM_KIND_BADGE,
  ITEM_KIND_LABEL,
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  type ItemKind,
  type OrderStatus,
  formatTugrik,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Тайлан",
};

type Range = { from: Date; to: Date; label: string; key: string };

function parseRange(searchParams: { from?: string; to?: string }): Range {
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

const QUICK_RANGES = [
  { key: "this-month", label: "Энэ сар" },
  { key: "last-month", label: "Өнгөрсөн сар" },
  { key: "last-30", label: "Сүүлийн 30 хоног" },
  { key: "this-year", label: "Энэ жил" },
] as const;

function buildQuickHref(key: (typeof QUICK_RANGES)[number]["key"]): string {
  const now = new Date();
  let from: Date;
  let to: Date = now;
  switch (key) {
    case "this-month":
      return "/dashboard/reports";
    case "last-month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      from = start;
      to = end;
      break;
    }
    case "last-30":
      from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "this-year":
      from = new Date(now.getFullYear(), 0, 1);
      break;
  }
  return `/dashboard/reports?from=${fmt(from)}&to=${fmt(to)}`;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isQuickActive(active: Range, key: string): boolean {
  return active.key === key || (key === "this-month" && active.key === "this-month");
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const range = parseRange(params);

  const completedWhere = {
    tenantId: user.tenantId,
    status: "COMPLETED" as const,
    completedAt: { gte: range.from, lte: range.to },
  };

  const allInRangeWhere = {
    tenantId: user.tenantId,
    OR: [
      { completedAt: { gte: range.from, lte: range.to } },
      { createdAt: { gte: range.from, lte: range.to } },
    ],
  };

  const [
    revenueAgg,
    completedCount,
    statusCounts,
    byBranch,
    byTech,
    kindTotals,
    topCustomers,
    topPartsRaw,
    branchesMap,
    techsMap,
    customersMap,
    partsMap,
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
    prisma.branch.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.customer.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, fullName: true, phone: true },
    }),
    prisma.service.findMany({
      where: { tenantId: user.tenantId, type: "GOODS" },
      select: {
        id: true,
        code: true,
        name: true,
        unit: { select: { name: true } },
      },
    }),
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
  );
  const totalInRange = statusCounts.reduce((a, s) => a + s._count._all, 0);

  // Branch breakdown
  const branchRows = byBranch
    .map((r) => ({
      id: r.branchId,
      name: branchById.get(r.branchId)?.name ?? "—",
      revenue: Number.parseFloat(r._sum.totalAmount?.toString() ?? "0"),
      count: r._count._all,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const maxBranchRevenue = branchRows[0]?.revenue ?? 1;

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
  const kindRows = (
    ["LABOR", "DIAGNOSTIC", "PART", "FEE"] as ItemKind[]
  ).map((k) => {
    const found = kindTotals.find((kt) => kt.kind === k);
    return {
      kind: k,
      total: Number.parseFloat(found?._sum.total?.toString() ?? "0"),
    };
  });
  const kindTotal = kindRows.reduce((a, r) => a + r.total, 0) || 1;

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
        count: r._count._all,
      };
    });

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Тайлан"
        description={`${range.label} · ${completedCount} дууссан захиалга · ${totalInRange} нийт`}
      />

      <div className="flex items-center gap-2 flex-wrap mb-6">
        {QUICK_RANGES.map((q) => {
          const active = isQuickActive(range, q.key);
          return (
            <Link
              key={q.key}
              href={buildQuickHref(q.key)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                active
                  ? "bg-violet-600/30 text-violet-300 border border-violet-500/30"
                  : "text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20"
              }`}
            >
              {q.label}
            </Link>
          );
        })}

        <form className="ml-auto flex items-center gap-2" action="/dashboard/reports">
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? fmt(range.from)}
            className="auth-input !py-1.5 !text-xs"
          />
          <span className="text-white/30 text-xs">→</span>
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? fmt(range.to)}
            className="auth-input !py-1.5 !text-xs"
          />
          <button
            type="submit"
            className="text-xs bg-violet-600 hover:bg-violet-500 transition-colors px-3 py-1.5 rounded-lg font-medium"
          >
            Хэрэгжүүлэх
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <BigStat
          label="Нийт орлого"
          value={formatTugrik(totalRevenue)}
          accent
        />
        <BigStat
          label="Дууссан захиалга"
          value={completedCount.toLocaleString("mn-MN")}
        />
        <BigStat
          label="Дундаж дүн"
          value={formatTugrik(avgTicket)}
        />
        <BigStat
          label="Идэвхтэй"
          value={(
            (statusCountMap.SCHEDULED ?? 0) +
            (statusCountMap.IN_PROGRESS ?? 0) +
            (statusCountMap.WAITING_PARTS ?? 0)
          ).toLocaleString("mn-MN")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-1">Орлого — ажил vs сэлбэг</h2>
          <p className="text-xs text-white/40 mb-5">
            Дууссан захиалгын мөрүүдийн хуваарилалт.
          </p>
          <div className="space-y-4">
            {kindRows.map((r) => {
              const pct = Math.round((r.total / kindTotal) * 100);
              return (
                <div key={r.kind}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        ITEM_KIND_BADGE[r.kind]
                      }`}
                    >
                      {ITEM_KIND_LABEL[r.kind]}
                    </span>
                    <span className="text-sm text-white/80">
                      {formatTugrik(r.total)} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-blue-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-1">Захиалгын статус</h2>
          <p className="text-xs text-white/40 mb-5">Сонгосон хугацааны нийт захиалга.</p>
          <div className="space-y-2">
            {(
              [
                "SCHEDULED",
                "IN_PROGRESS",
                "WAITING_PARTS",
                "COMPLETED",
                "CANCELLED",
              ] as OrderStatus[]
            ).map((s) => {
              const count = statusCountMap[s] ?? 0;
              const pct = totalInRange > 0 ? Math.round((count / totalInRange) * 100) : 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${ORDER_STATUS_BADGE[s]} shrink-0`}
                  >
                    {ORDER_STATUS_LABEL[s]}
                  </span>
                  <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/30"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-white/80 tabular-nums shrink-0 w-14 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-1">Салбараар</h2>
          <p className="text-xs text-white/40 mb-5">Орлого ба захиалгын тоо.</p>
          {branchRows.length === 0 ? (
            <p className="text-sm text-white/40 py-4 text-center">Өгөгдөл алга.</p>
          ) : (
            <div className="space-y-4">
              {branchRows.map((b) => {
                const pct = Math.round((b.revenue / (maxBranchRevenue || 1)) * 100);
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-white/80">
                        {b.name}
                      </span>
                      <span className="text-sm text-white/60">
                        {formatTugrik(b.revenue)}{" "}
                        <span className="text-white/30">· {b.count}</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-1">Мастер / Менежер</h2>
          <p className="text-xs text-white/40 mb-5">Хариуцсан захиалгын орлого.</p>
          {techRows.length === 0 ? (
            <p className="text-sm text-white/40 py-4 text-center">Өгөгдөл алга.</p>
          ) : (
            <div className="space-y-4">
              {techRows.slice(0, 6).map((t) => {
                const max = techRows[0]?.revenue || 1;
                const pct = Math.round((t.revenue / max) * 100);
                return (
                  <div key={t.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-white/80">
                        {t.name}
                      </span>
                      <span className="text-sm text-white/60">
                        {formatTugrik(t.revenue)}{" "}
                        <span className="text-white/30">· {t.count}</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-1">Топ үйлчлүүлэгчид</h2>
          <p className="text-xs text-white/40 mb-5">Хамгийн их орлого авчирсан.</p>
          {customerRows.length === 0 ? (
            <p className="text-sm text-white/40 py-4 text-center">Өгөгдөл алга.</p>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {customerRows.map((c, i) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/customers/${c.id}`}
                    className="flex items-center gap-3 py-3 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <span className="text-xs text-white/30 font-mono w-5 shrink-0">
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white/90 truncate">
                        {c.name}
                      </div>
                      <div className="text-xs text-white/30">
                        {c.count} захиалга
                      </div>
                    </div>
                    <span className="text-sm text-white/80 shrink-0">
                      {formatTugrik(c.revenue)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-1">Топ сэлбэгүүд</h2>
          <p className="text-xs text-white/40 mb-5">Хамгийн их орлоготой сэлбэг.</p>
          {partRows.length === 0 ? (
            <p className="text-sm text-white/40 py-4 text-center">Өгөгдөл алга.</p>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {partRows.map((p, i) => (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/services/${p.id}`}
                    className="flex items-center gap-3 py-3 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <span className="text-xs text-white/30 font-mono w-5 shrink-0">
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white/90 truncate">
                        {p.name}
                      </div>
                      <div className="text-xs text-white/30 font-mono">
                        {p.sku}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm text-white/80">
                        {formatTugrik(p.revenue)}
                      </div>
                      <div className="text-xs text-white/40">
                        {p.qty.toLocaleString("mn-MN", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        {p.unit}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`glass rounded-2xl p-5 ${
        accent ? "border border-violet-500/30" : ""
      }`}
    >
      <div
        className={`text-2xl sm:text-3xl font-bold ${
          accent ? "gradient-text" : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="text-sm text-white/40 mt-1">{label}</div>
    </div>
  );
}
