import { notFound } from "next/navigation";
import {
  cancelSubscriptionAction,
  createSubscriptionAction,
  extendSubscriptionAction,
} from "@/app/_actions/system-subscriptions";
import {
  activateTenantAction,
  deleteTenantAction,
  suspendTenantAction,
} from "@/app/_actions/system-tenants";
import { DatePicker } from "@/app/_components/date-picker";
import { PageHeader } from "@/app/_components/page-header";
import { requireSuperAdmin } from "@/lib/auth/system";
import { formatTugrik } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import {
  PLAN_LABEL,
  SUBSCRIPTION_STATUS_BADGE,
  SUBSCRIPTION_STATUS_LABEL,
  formatDaysLeft,
  resolveActiveSubscription,
} from "@/lib/subscription";

export const metadata = {
  title: "Байгууллагын дэлгэрэнгүй",
};

export default async function SystemTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true,
          branches: true,
          customers: true,
          vehicles: true,
          services: true,
          serviceOrders: true,
        },
      },
      users: {
        where: { isOwner: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          isOwner: true,
          createdAt: true,
        },
      },
    },
  });

  if (!tenant) notFound();

  const [revenueAgg, subscriptions] = await Promise.all([
    prisma.serviceOrder.aggregate({
      where: { tenantId: tenant.id, status: "COMPLETED" },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.subscription.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);
  const revenue = Number.parseFloat(
    revenueAgg._sum.totalAmount?.toString() ?? "0",
  );
  const activeSub = resolveActiveSubscription(
    subscriptions.map((s) => ({
      id: s.id,
      plan: s.plan,
      status: s.status,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
    })),
  );

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <PageHeader
        title={tenant.name}
        description={`#${tenant.registerNumber} · ${tenant.email}`}
        actions={
          tenant.suspended ? (
            <span className="text-xs px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
              Зогссон
            </span>
          ) : (
            <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              Идэвхтэй
            </span>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <BigStat label="Салбар" value={tenant._count.branches} />
        <BigStat label="Ажилтан" value={tenant._count.users} />
        <BigStat label="Үйлчлүүлэгч" value={tenant._count.customers} />
        <BigStat label="Машин" value={tenant._count.vehicles} />
        <BigStat label="Үйлчилгээ" value={tenant._count.services} />
        <BigStat label="Захиалга" value={tenant._count.serviceOrders} />
        <BigStat
          label="Дуусгасан"
          value={revenueAgg._count._all}
          color="text-emerald-400"
        />
        <BigStat
          label="Орлого"
          value={formatTugrik(revenue)}
          accent
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Үндсэн мэдээлэл</h2>
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <Row label="Нэр" value={tenant.name} />
              <Row label="Регистр" value={tenant.registerNumber} />
              <Row label="Slug" value={tenant.slug} mono />
              <Row label="Багц" value={tenant.plan} />
              <Row label="Gmail" value={tenant.email} />
              <Row label="Утас 1" value={tenant.phone1} />
              {tenant.phone2 ? (
                <Row label="Утас 2" value={tenant.phone2} />
              ) : null}
              <Row
                label="Бүртгүүлсэн"
                value={tenant.createdAt.toLocaleString("mn-MN")}
              />
            </dl>
          </section>

          <section className="glass rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div>
                <h2 className="font-semibold">Subscription түүх</h2>
                <p className="text-xs text-white/40 mt-0.5">
                  Нийт {subscriptions.length} бичлэг
                </p>
              </div>
            </div>
            {subscriptions.length === 0 ? (
              <div className="px-6 py-8 text-sm text-white/40 text-center">
                Subscription түүх алга.
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full min-w-[680px]">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {[
                        "Багц",
                        "Статус",
                        "Эхэлсэн",
                        "Дуусах",
                        "Дүн",
                        "Үүсгэсэн",
                        "",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left text-xs text-white/30 font-medium px-5 py-3"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((s) => {
                      const canCancel =
                        s.status === "TRIAL" || s.status === "ACTIVE";
                      return (
                        <tr
                          key={s.id}
                          className="border-b border-white/[0.04] last:border-0"
                        >
                          <td className="px-5 py-3 text-sm text-white/85">
                            {PLAN_LABEL[s.plan]}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${SUBSCRIPTION_STATUS_BADGE[s.status]}`}
                            >
                              {SUBSCRIPTION_STATUS_LABEL[s.status]}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-white/60">
                            {s.startsAt.toLocaleDateString("mn-MN")}
                          </td>
                          <td className="px-5 py-3 text-xs text-white/60">
                            {s.endsAt
                              ? s.endsAt.toLocaleDateString("mn-MN")
                              : "—"}
                          </td>
                          <td className="px-5 py-3 text-xs text-white/80">
                            {s.amount
                              ? formatTugrik(s.amount.toString())
                              : "—"}
                          </td>
                          <td className="px-5 py-3 text-xs text-white/40">
                            {s.createdBy
                              ? `${s.createdBy.firstName} ${s.createdBy.lastName}`
                              : "Систем"}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {canCancel ? (
                              <form action={cancelSubscriptionAction}>
                                <input
                                  type="hidden"
                                  name="id"
                                  value={tenant.id}
                                />
                                <input
                                  type="hidden"
                                  name="subscriptionId"
                                  value={s.id}
                                />
                                <button
                                  type="submit"
                                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-md hover:bg-red-500/10 transition-colors"
                                >
                                  Цуцлах
                                </button>
                              </form>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Админ (OWNER)</h2>
            {tenant.users.length === 0 ? (
              <p className="text-sm text-white/40">Админ алга байна.</p>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {tenant.users.map((u) => (
                  <li key={u.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white/90">
                          {u.lastName} {u.firstName}
                        </div>
                        <div className="text-xs text-white/40">
                          {u.email} · {u.phone}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                        Админ
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="glass rounded-2xl p-5">
            <h2 className="font-semibold mb-1 text-sm">Одоогийн багц</h2>
            {activeSub ? (
              <div className="text-xs text-white/40 mb-4">
                <div>
                  <span className="text-white/70">
                    {PLAN_LABEL[activeSub.subscription.plan]}
                  </span>{" "}
                  ·{" "}
                  <span
                    className={`px-1.5 py-0.5 rounded ${SUBSCRIPTION_STATUS_BADGE[activeSub.subscription.status]}`}
                  >
                    {SUBSCRIPTION_STATUS_LABEL[activeSub.subscription.status]}
                  </span>
                </div>
                {activeSub.expiresAt ? (
                  <div className="mt-1">
                    {activeSub.expiresAt.toLocaleDateString("mn-MN")} —{" "}
                    {formatDaysLeft(activeSub.daysLeft)}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-white/40 mb-4">Идэвхтэй багц алга.</p>
            )}

            {activeSub ? (
              <form
                action={extendSubscriptionAction}
                className="flex items-center gap-2 mb-4"
              >
                <input type="hidden" name="id" value={tenant.id} />
                <input
                  type="hidden"
                  name="subscriptionId"
                  value={activeSub.subscription.id}
                />
                <input
                  type="number"
                  name="addDays"
                  min={1}
                  defaultValue={14}
                  className="auth-input !py-1.5 !text-sm w-20"
                />
                <span className="text-xs text-white/40">хоног</span>
                <button
                  type="submit"
                  className="text-xs bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-3 py-1.5 rounded-lg transition-colors"
                >
                  Сунгах
                </button>
              </form>
            ) : null}

            <h3 className="text-xs uppercase tracking-wider text-white/40 mb-2">
              Шинэ subscription
            </h3>
            <form action={createSubscriptionAction} className="space-y-2">
              <input type="hidden" name="id" value={tenant.id} />
              <div className="grid grid-cols-2 gap-2">
                <select
                  name="plan"
                  defaultValue={tenant.plan}
                  className="auth-input !py-2 !text-sm"
                >
                  <option value="FREE" className="bg-[#0d0d14]">
                    FREE
                  </option>
                  <option value="BUSINESS" className="bg-[#0d0d14]">
                    BUSINESS
                  </option>
                  <option value="ENTERPRISE" className="bg-[#0d0d14]">
                    ENTERPRISE
                  </option>
                </select>
                <select
                  name="status"
                  defaultValue="ACTIVE"
                  className="auth-input !py-2 !text-sm"
                >
                  <option value="ACTIVE" className="bg-[#0d0d14]">
                    ACTIVE
                  </option>
                  <option value="TRIAL" className="bg-[#0d0d14]">
                    TRIAL
                  </option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-[10px] text-white/40">
                  Эхэлсэн
                  <DatePicker
                    name="startsAt"
                    defaultValue={todayISO}
                    className="mt-1"
                  />
                </div>
                <div className="text-[10px] text-white/40">
                  Дуусах
                  <DatePicker name="endsAt" className="mt-1" />
                </div>
              </div>
              <input
                type="text"
                name="amount"
                inputMode="decimal"
                placeholder="Дүн (заавал биш)"
                className="auth-input !py-2 !text-sm"
              />
              <textarea
                name="notes"
                rows={2}
                placeholder="Тэмдэглэл (заавал биш)"
                className="auth-input resize-none !py-2 !text-sm"
              />
              <button
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-500 transition-colors py-2 rounded-xl text-sm font-medium"
              >
                Subscription нэмэх
              </button>
            </form>
          </section>

          {tenant.suspended ? (
            <form
              action={activateTenantAction}
              className="glass rounded-2xl p-5 border border-emerald-500/20"
            >
              <h2 className="font-semibold mb-1 text-sm text-emerald-300">
                Сэргээх
              </h2>
              <p className="text-xs text-white/40 mb-4">
                Хэрэглэгчид нэвтэрч чадахгүй байна.
              </p>
              <input type="hidden" name="id" value={tenant.id} />
              <button
                type="submit"
                className="w-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors py-2.5 rounded-xl text-sm font-medium"
              >
                Идэвхжүүлэх
              </button>
            </form>
          ) : (
            <form
              action={suspendTenantAction}
              className="glass rounded-2xl p-5 border border-amber-500/20"
            >
              <h2 className="font-semibold mb-1 text-sm text-amber-300">
                Түр зогсоох
              </h2>
              <p className="text-xs text-white/40 mb-4">
                Үйлчлүүлэгчид нэвтэрч чадахгүй болно. Өгөгдөл хадгалагдсаар үлдэнэ.
              </p>
              <input type="hidden" name="id" value={tenant.id} />
              <button
                type="submit"
                className="w-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors py-2.5 rounded-xl text-sm font-medium"
              >
                Зогсоох
              </button>
            </form>
          )}

          <form
            action={deleteTenantAction}
            className="glass rounded-2xl p-5 border border-red-500/30"
          >
            <h2 className="font-semibold mb-1 text-sm text-red-300">
              Бүрэн устгах
            </h2>
            <p className="text-xs text-white/40 mb-4">
              БҮХ өгөгдөл (захиалга, машин, сэлбэг, ажилтан) устана.
              Сэргээх боломжгүй. Доор байгууллагын нэрийг бичнэ үү:
            </p>
            <input type="hidden" name="id" value={tenant.id} />
            <input
              type="text"
              name="confirmName"
              required
              placeholder={tenant.name}
              className="auth-input mb-3 !text-xs"
            />
            <button
              type="submit"
              className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 transition-colors py-2.5 rounded-xl text-sm font-medium"
            >
              Устгах
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-white/40">{label}</dt>
      <dd
        className={`mt-0.5 text-white/80 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
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
  value: number | string;
  accent?: boolean;
  color?: string;
}) {
  return (
    <div
      className={`glass rounded-xl p-4 ${
        accent ? "border border-red-500/30" : ""
      }`}
    >
      <div
        className={`text-xl font-bold ${
          color ?? (accent ? "gradient-text" : "text-white")
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-white/40 mt-1">{label}</div>
    </div>
  );
}
