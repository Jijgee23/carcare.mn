import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { requireSuperAdmin } from "@/lib/auth/system";
import { formatTugrik } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Системийн тойм",
};

export default async function SystemOverviewPage() {
  const admin = await requireSuperAdmin();

  const [
    tenantCount,
    activeTenants,
    suspendedTenants,
    userCount,
    orderCount,
    completedRevenueAgg,
    planCounts,
    recentTenants,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { suspended: false } }),
    prisma.tenant.count({ where: { suspended: true } }),
    prisma.user.count(),
    prisma.serviceOrder.count(),
    prisma.serviceOrder.aggregate({
      where: { status: "COMPLETED" },
      _sum: { totalAmount: true },
    }),
    prisma.tenant.groupBy({
      by: ["plan"],
      _count: { _all: true },
    }),
    prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        registerNumber: true,
        plan: true,
        suspended: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
    }),
  ]);

  const totalRevenue = Number.parseFloat(
    completedRevenueAgg._sum.totalAmount?.toString() ?? "0",
  );

  const planMap = Object.fromEntries(
    planCounts.map((p) => [p.plan, p._count._all]),
  );

  return (
    <div className="p-6 sm:p-8 max-w-7xl">
      <PageHeader
        title={`Сайн байна уу, ${admin.firstName}`}
        description="carcare.mn платформын ерөнхий тойм"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <BigStat
          label="Идэвхтэй байгууллага"
          value={activeTenants.toLocaleString("mn-MN")}
          accent
        />
        <BigStat
          label="Түр зогссон"
          value={suspendedTenants.toLocaleString("mn-MN")}
          color="text-amber-400"
        />
        <BigStat
          label="Нийт хэрэглэгч"
          value={userCount.toLocaleString("mn-MN")}
        />
        <BigStat
          label="Дуусгасан захиалга"
          value={orderCount.toLocaleString("mn-MN")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold">Сүүлд бүртгүүлсэн</h2>
              <p className="text-xs text-white/40 mt-0.5">
                Шинээр нэгдсэн байгууллагууд
              </p>
            </div>
            <Link
              href="/system/tenants"
              className="text-xs text-red-300 hover:text-red-200"
            >
              Бүгдийг харах →
            </Link>
          </div>

          {recentTenants.length === 0 ? (
            <p className="text-sm text-white/40 py-6 text-center">
              Байгууллага бүртгүүлээгүй байна.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {recentTenants.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/system/tenants/${t.id}`}
                    className="flex items-center gap-3 py-3 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500/30 to-violet-500/30 flex items-center justify-center text-sm font-bold text-red-300 shrink-0">
                      {t.name[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white/90 truncate">
                        {t.name}
                        {t.suspended ? (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            ЗОГССОН
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-white/30">
                        #{t.registerNumber} · {t._count.users} ажилтан
                      </div>
                    </div>
                    <span className="text-xs text-white/40 shrink-0">
                      {t.createdAt.toLocaleDateString("mn-MN")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-1">Багцаар</h2>
            <p className="text-xs text-white/40 mb-5">
              Нийт {tenantCount} байгууллага
            </p>
            <div className="space-y-3">
              {(["FREE", "BUSINESS", "ENTERPRISE"] as const).map((p) => {
                const count = planMap[p] ?? 0;
                const pct = tenantCount > 0 ? (count / tenantCount) * 100 : 0;
                return (
                  <div key={p}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-white/80">{p}</span>
                      <span className="text-white/60">{count}</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-violet-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass rounded-2xl p-6 border border-emerald-500/20">
            <div className="text-xs text-white/40 uppercase tracking-wider">
              Нийт орлого (платформ)
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold gradient-text">
              {formatTugrik(totalRevenue)}
            </div>
            <p className="text-xs text-white/40 mt-2">
              Бүх байгууллагын дууссан захиалгын нийлбэр
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  accent = false,
  color,
}: {
  label: string;
  value: string;
  accent?: boolean;
  color?: string;
}) {
  return (
    <div
      className={`glass rounded-2xl p-5 ${
        accent ? "border border-red-500/30" : ""
      }`}
    >
      <div
        className={`text-2xl sm:text-3xl font-bold ${
          color ?? (accent ? "gradient-text" : "text-white")
        }`}
      >
        {value}
      </div>
      <div className="text-sm text-white/40 mt-1">{label}</div>
    </div>
  );
}
