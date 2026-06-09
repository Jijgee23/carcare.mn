import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { branchScopeId, userRoleLabel } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { formatTugrik } from "@/lib/orders";
import { DatePicker } from "@/app/_components/date-picker";
import { Sparkline } from "@/app/_components/sparkline";
import { IncomeChart } from "./income-chart";
import { type Trend, dailyTrend } from "./trend";
import {
  INCOME_QUICK_RANGES,
  type IncomeRangeKey,
  buildIncomeSeries,
  resolveIncomeRange,
} from "./income-range";
import {
  PLAN_LABEL,
  SUBSCRIPTION_STATUS_BADGE,
  SUBSCRIPTION_STATUS_LABEL,
  formatDaysLeft,
  resolveActiveSubscription,
} from "@/lib/subscription";

export const metadata = {
  title: "Хяналтын самбар",
};

function incomeRangeHref(key: IncomeRangeKey): string {
  return key === "week" ? "/dashboard" : `/dashboard?range=${key}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser();

  const params = await searchParams;
  const incomeRange = resolveIncomeRange(params);

  // 14-day window for the stat-card trend sparklines.
  const now = new Date();
  const trendStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 13,
  );
  const recentWhere = {
    tenantId: user.tenantId,
    createdAt: { gte: trendStart },
  };

  // Салбараар хязгаарлагдсан ажилтны хувьд захиалга/орлогын тоог салбараар нь шүүнэ.
  const scopeBranchId = branchScopeId(user);
  const orderBranchFilter = scopeBranchId ? { branchId: scopeBranchId } : {};

  const [
    branchCount,
    employeeCount,
    customerCount,
    vehicleCount,
    openOrderCount,
    completedThisMonth,
    incomeOrders,
    subscriptions,
    orderDates,
    completedDates,
    customerDates,
    vehicleDates,
    branchDates,
    employeeDates,
  ] = await Promise.all([
    prisma.branch.count({ where: { tenantId: user.tenantId } }),
    prisma.user.count({ where: { tenantId: user.tenantId } }),
    prisma.customer.count({ where: { tenantId: user.tenantId } }),
    prisma.vehicle.count({ where: { tenantId: user.tenantId } }),
    prisma.serviceOrder.count({
      where: {
        tenantId: user.tenantId,
        ...orderBranchFilter,
        status: { in: ["SCHEDULED", "IN_PROGRESS", "WAITING_PARTS"] },
      },
    }),
    prisma.serviceOrder.count({
      where: {
        tenantId: user.tenantId,
        ...orderBranchFilter,
        status: "COMPLETED",
        completedAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.serviceOrder.findMany({
      where: {
        tenantId: user.tenantId,
        ...orderBranchFilter,
        status: "COMPLETED",
        completedAt: { gte: incomeRange.fetchFrom, lte: incomeRange.to },
      },
      select: { completedAt: true, totalAmount: true },
    }),
    prisma.subscription.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { startsAt: "desc" },
      select: {
        id: true,
        plan: true,
        status: true,
        startsAt: true,
        endsAt: true,
      },
    }),
    prisma.serviceOrder.findMany({
      where: { ...recentWhere, ...orderBranchFilter },
      select: { createdAt: true },
    }),
    prisma.serviceOrder.findMany({
      where: {
        tenantId: user.tenantId,
        ...orderBranchFilter,
        status: "COMPLETED",
        completedAt: { gte: trendStart },
      },
      select: { completedAt: true },
    }),
    prisma.customer.findMany({
      where: recentWhere,
      select: { createdAt: true },
    }),
    prisma.vehicle.findMany({
      where: recentWhere,
      select: { createdAt: true },
    }),
    prisma.branch.findMany({
      where: recentWhere,
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: recentWhere,
      select: { createdAt: true },
    }),
  ]);
  const activeSub = resolveActiveSubscription(subscriptions);

  const income = buildIncomeSeries(incomeOrders, incomeRange);
  const incomeUp = income.changePct == null ? true : income.changePct >= 0;

  // Per-card growth/decline trends.
  const orderTrend = dailyTrend(orderDates.map((o) => o.createdAt));
  const completedTrend = dailyTrend(completedDates.map((o) => o.completedAt));
  const customerTrend = dailyTrend(customerDates.map((c) => c.createdAt));
  const vehicleTrend = dailyTrend(vehicleDates.map((v) => v.createdAt));
  const branchTrend = dailyTrend(branchDates.map((b) => b.createdAt));
  const employeeTrend = dailyTrend(employeeDates.map((e) => e.createdAt));

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title={`Сайн байна уу, ${user.firstName}!`}
        description={`${user.tenant.name} · ${userRoleLabel(user)}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Идэвхтэй захиалга"
          value={openOrderCount}
          href="/dashboard/orders"
          trend={orderTrend}
          accent
        />
        <StatCard
          label="Энэ сар дуусгасан"
          value={completedThisMonth}
          href="/dashboard/orders?status=COMPLETED"
          trend={completedTrend}
        />
        <StatCard
          label="Үйлчлүүлэгч"
          value={customerCount}
          href="/dashboard/customers"
          trend={customerTrend}
        />
        <StatCard
          label="Машин"
          value={vehicleCount}
          href="/dashboard/vehicles"
          trend={vehicleTrend}
        />
        <StatCard
          label="Салбар"
          value={branchCount}
          href="/dashboard/branches"
          trend={branchTrend}
        />
        <StatCard
          label="Ажилтан"
          value={employeeCount}
          href="/dashboard/employees"
          trend={employeeTrend}
        />
      </div>

      <section className="mt-6 glass rounded-2xl p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-semibold mb-1">Орлогын явц</h2>
            <p className="text-xs text-white/40">{incomeRange.label}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-bold gradient-text leading-none">
              {formatTugrik(income.total)}
            </div>
            {income.changePct != null ? (
              <div
                className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  incomeUp
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-red-500/15 text-red-300"
                }`}
              >
                <span>{incomeUp ? "▲" : "▼"}</span>
                <span className="tabular-nums">
                  {Math.abs(income.changePct).toFixed(1)}%
                </span>
                <span className="text-white/30">өмнөх үе</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-5">
          {INCOME_QUICK_RANGES.map((q) => {
            const active = incomeRange.key === q.key;
            return (
              <Link
                key={q.key}
                href={incomeRangeHref(q.key)}
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

          <form className="ml-auto flex items-center gap-2" action="/dashboard">
            <DatePicker
              mode="range"
              fromName="from"
              toName="to"
              defaultValue={{ from: params.from ?? "", to: params.to ?? "" }}
              className="w-[15rem]"
            />
            <button
              type="submit"
              className="text-xs bg-violet-600 hover:bg-violet-500 transition-colors px-3 py-1.5 rounded-lg font-medium shrink-0"
            >
              Шүүх
            </button>
          </form>
        </div>

        <IncomeChart points={income.points} up={incomeUp} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 glass rounded-2xl p-6 sm:p-8">
          <h2 className="font-semibold mb-1">Хурдан үйлдлүүд</h2>
          <p className="text-sm text-white/40 mb-6">
            Дарж шууд эхэлнэ.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <QuickAction
              href="/dashboard/orders/new"
              title="Шинэ захиалга авах"
              desc="Үйлчилгээний ажлыг бүртгэж эхлэх"
              icon="🧾"
            />
            <QuickAction
              href="/dashboard/customers/new"
              title="Үйлчлүүлэгч нэмэх"
              desc="Шинэ харилцагчийг бүртгэх"
              icon="🙋"
            />
            <QuickAction
              href="/dashboard/vehicles/new"
              title="Машин бүртгэх"
              desc="Машины мэдээлэл, эзэмшигчийг бүртгэх"
              icon="🚗"
            />
            <QuickAction
              href="/dashboard/employees/new"
              title="Ажилтан нэмэх"
              desc="Мастер, кассчин, менежерийг урих"
              icon="👤"
            />
          </div>
        </div>

        <div className="glass rounded-2xl p-6 sm:p-8">
          <h2 className="font-semibold mb-4">Байгууллагын мэдээлэл</h2>
          <dl className="space-y-3 text-sm">
            <InfoRow label="Нэр" value={user.tenant.name} />
            <InfoRow label="Регистр" value={user.tenant.registerNumber} />
            <InfoRow label="Gmail" value={user.tenant.email} />
            <InfoRow label="Утас" value={user.tenant.phone1} />
            {user.tenant.phone2 ? (
              <InfoRow label="Утас 2" value={user.tenant.phone2} />
            ) : null}
            <div className="pt-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-white/40">Багц</span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full ${
                    activeSub
                      ? SUBSCRIPTION_STATUS_BADGE[activeSub.subscription.status]
                      : "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                  }`}
                >
                  {activeSub
                    ? PLAN_LABEL[activeSub.subscription.plan]
                    : user.tenant.plan}
                  {activeSub
                    ? ` · ${SUBSCRIPTION_STATUS_LABEL[activeSub.subscription.status]}`
                    : ""}
                </span>
              </div>
              {activeSub?.expiresAt ? (
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-white/40">Хугацаа</span>
                  <span className="text-white/80 text-right">
                    {activeSub.expiresAt.toLocaleDateString("mn-MN")}
                    <span
                      className={`block text-[10px] ${
                        activeSub.daysLeft <= 3
                          ? "text-red-300"
                          : "text-white/40"
                      }`}
                    >
                      {formatDaysLeft(activeSub.daysLeft)}
                    </span>
                  </span>
                </div>
              ) : null}
              <Link
                href="/dashboard/settings/subscription"
                className="mt-3 inline-block text-xs text-violet-300 hover:text-violet-200"
              >
                Дэлгэрэнгүй / түүх →
              </Link>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  trend,
  accent = false,
}: {
  label: string;
  value: number;
  href?: string;
  trend?: Trend;
  accent?: boolean;
}) {
  const up = trend?.changePct == null ? true : trend.changePct >= 0;
  const inner = (
    <div
      className={`group glass card-hover rounded-2xl p-4 flex flex-col gap-3 h-full ${
        accent ? "border border-violet-500/30" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-white/40 truncate">{label}</div>
          <div
            className={`text-2xl font-bold mt-0.5 tabular-nums ${
              accent ? "gradient-text" : "text-white"
            }`}
          >
            {value.toLocaleString("mn-MN")}
          </div>
        </div>
        {trend?.changePct != null ? (
          <span
            className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              up
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-red-500/15 text-red-300"
            }`}
          >
            <span>{up ? "▲" : "▼"}</span>
            <span className="tabular-nums">
              {Math.abs(trend.changePct).toFixed(0)}%
            </span>
          </span>
        ) : null}
      </div>
      {trend ? <Sparkline data={trend.spark} up={up} className="h-8" /> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function QuickAction({
  href,
  title,
  desc,
  icon,
}: {
  href: string;
  title: string;
  desc: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="group glass card-hover rounded-xl p-5 flex items-start gap-4"
    >
      <div className="text-3xl shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="font-semibold text-white group-hover:text-violet-300 transition-colors">
          {title}
        </div>
        <div className="text-sm text-white/40 mt-0.5">{desc}</div>
      </div>
    </Link>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/40">{label}</span>
      <span className="text-white/90 truncate text-right">{value}</span>
    </div>
  );
}
