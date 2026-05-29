import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PLAN_LABEL,
  SUBSCRIPTION_STATUS_BADGE,
  SUBSCRIPTION_STATUS_LABEL,
  formatDaysLeft,
  resolveActiveSubscription,
} from "@/lib/subscription";
import { PlanCheckout } from "./plan-checkout";

export const metadata = {
  title: "Багц / Subscription",
};

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("mn-MN");
}

function fmtAmount(v: { toString: () => string } | null | undefined): string {
  if (!v) return "—";
  const n = Number.parseFloat(v.toString());
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("mn-MN")} ₮`;
}

export default async function SubscriptionPage() {
  const user = await requireUser();
  const isOwner = user.isOwner;

  const [subscriptions, planPrices, planFeatures, pendingPayment] = await Promise.all([
    prisma.subscription.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.planPrice.findMany({
      where: { isActive: true },
      orderBy: [{ plan: "asc" }, { period: "asc" }],
    }),
    prisma.planFeature.findMany({
      orderBy: [{ plan: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.subscriptionPayment.findFirst({
      where: { tenantId: user.tenantId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const featuresByPlan: Record<
    "FREE" | "BUSINESS" | "ENTERPRISE",
    { label: string; value: string; description: string | null; highlighted: boolean }[]
  > = { FREE: [], BUSINESS: [], ENTERPRISE: [] };
  for (const f of planFeatures) {
    featuresByPlan[f.plan].push({
      label: f.label,
      value: f.value,
      description: f.description,
      highlighted: f.highlighted,
    });
  }

  const active = resolveActiveSubscription(
    subscriptions.map((s) => ({
      id: s.id,
      plan: s.plan,
      status: s.status,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
    })),
  );

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Багц / Subscription"
        description="Тенантынхаа багц, туршилтын статус, төлбөрийн түүх."
      />

      <div className="grid gap-6">
        {isOwner ? (
          <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
            <h2 className="font-semibold mb-1">
              {pendingPayment ? "QPay төлбөр" : "Багц авах / сунгах"}
            </h2>
            <p className="text-xs text-white/40 mb-5">
              {pendingPayment
                ? "QR-аар төлсний дараа багц автоматаар идэвхжинэ."
                : "Боломжтой багцыг сонгож QPay-ээр төлнө үү."}
            </p>
            <PlanCheckout
              prices={planPrices.map((p) => ({
                id: p.id,
                plan: p.plan,
                period: p.period,
                amount: p.amount.toString(),
                currency: p.currency,
                notes: p.notes,
                features: featuresByPlan[p.plan],
              }))}
              pending={
                pendingPayment
                  ? {
                      id: pendingPayment.id,
                      qrImage: pendingPayment.qrImage,
                      qrText: pendingPayment.qrText,
                      amount: pendingPayment.amount.toString(),
                      currency: pendingPayment.currency,
                      plan: pendingPayment.plan,
                      period: pendingPayment.period,
                    }
                  : null
              }
            />
          </section>
        ) : null}

        <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
          <h2 className="font-semibold mb-4">Одоогийн төлөв</h2>
          {active ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <div className="text-xs text-white/40">Багц</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {PLAN_LABEL[active.subscription.plan]}
                </div>
              </div>
              <div>
                <div className="text-xs text-white/40">Статус</div>
                <div className="mt-1">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full ${SUBSCRIPTION_STATUS_BADGE[active.subscription.status]}`}
                  >
                    {SUBSCRIPTION_STATUS_LABEL[active.subscription.status]}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-white/40">Хугацаа</div>
                <div className="mt-1 text-sm text-white/80">
                  {active.expiresAt ? (
                    <>
                      {fmtDate(active.expiresAt)}
                      <div className="text-xs text-white/40">
                        {formatDaysLeft(active.daysLeft)}
                      </div>
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/40">
              Идэвхтэй багц байхгүй. Багц авахын тулд carcare.mn-тэй холбоо
              барина уу.
            </p>
          )}
        </section>

        <section className="glass rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div>
              <h2 className="font-semibold">Түүх</h2>
              <p className="text-xs text-white/40 mt-0.5">
                Нийт {subscriptions.length} бичлэг
              </p>
            </div>
          </div>
          {subscriptions.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-white/40">
              Subscription түүх алга.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {[
                      "Багц",
                      "Статус",
                      "Эхэлсэн",
                      "Дуусах",
                      "Дүн",
                      "Тэмдэглэл",
                      "Үүсгэсэн",
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
                  {subscriptions.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
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
                        {fmtDate(s.startsAt)}
                      </td>
                      <td className="px-5 py-3 text-xs text-white/60">
                        {fmtDate(s.endsAt)}
                      </td>
                      <td className="px-5 py-3 text-xs text-white/80">
                        {fmtAmount(s.amount)}
                      </td>
                      <td className="px-5 py-3 text-xs text-white/50 max-w-[260px]">
                        {s.notes ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-xs text-white/40">
                        {s.createdBy
                          ? `${s.createdBy.firstName} ${s.createdBy.lastName}`
                          : "Систем"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
