import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { userRoleLabel } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
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

export default async function DashboardPage() {
  const user = await requireUser();

  const [
    branchCount,
    employeeCount,
    customerCount,
    vehicleCount,
    openOrderCount,
    completedThisMonth,
    subscriptions,
  ] = await Promise.all([
    prisma.branch.count({ where: { tenantId: user.tenantId } }),
    prisma.user.count({ where: { tenantId: user.tenantId } }),
    prisma.customer.count({ where: { tenantId: user.tenantId } }),
    prisma.vehicle.count({ where: { tenantId: user.tenantId } }),
    prisma.serviceOrder.count({
      where: {
        tenantId: user.tenantId,
        status: { in: ["SCHEDULED", "IN_PROGRESS", "WAITING_PARTS"] },
      },
    }),
    prisma.serviceOrder.count({
      where: {
        tenantId: user.tenantId,
        status: "COMPLETED",
        completedAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
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
  ]);
  const activeSub = resolveActiveSubscription(subscriptions);

  return (
    <div className="p-6 sm:p-8">
      <PageHeader
        title={`Сайн байна уу, ${user.firstName}!`}
        description={`${user.tenant.name} · ${userRoleLabel(user)}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Идэвхтэй захиалга"
          value={openOrderCount}
          href="/dashboard/orders"
          accent
        />
        <StatCard
          label="Энэ сар дуусгасан"
          value={completedThisMonth}
          href="/dashboard/orders?status=COMPLETED"
        />
        <StatCard
          label="Үйлчлүүлэгч"
          value={customerCount}
          href="/dashboard/customers"
        />
        <StatCard
          label="Машин"
          value={vehicleCount}
          href="/dashboard/vehicles"
        />
        <StatCard label="Салбар" value={branchCount} href="/dashboard/branches" />
        <StatCard
          label="Ажилтан"
          value={employeeCount}
          href="/dashboard/employees"
        />
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
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
  accent = false,
}: {
  label: string;
  value: number;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <div
      className={`glass card-hover rounded-2xl p-5 ${
        accent ? "border border-violet-500/30" : ""
      }`}
    >
      <div
        className={`text-3xl font-bold ${accent ? "gradient-text" : "text-white"}`}
      >
        {value}
      </div>
      <div className="text-sm text-white/40 mt-1">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
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
