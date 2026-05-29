import { PageHeader } from "@/app/_components/page-header";
import { requireSuperAdmin } from "@/lib/auth/system";
import { prisma } from "@/lib/prisma";
import { PlanFeaturesManager } from "./plan-features-manager";
import { PlanLimitsManager } from "./plan-limits-manager";
import { PlanPriceMatrix } from "./plan-price-matrix";

export const metadata = {
  title: "Багц / Үнэ / Боломж / Хязгаар",
};

export default async function SystemPlanPricesPage() {
  await requireSuperAdmin();

  const [features, limits, prices] = await Promise.all([
    prisma.planFeature.findMany({
      orderBy: [{ plan: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.planLimit.findMany({
      orderBy: [{ plan: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.planPrice.findMany({
      orderBy: [{ plan: "asc" }, { period: "asc" }],
    }),
  ]);

  return (
    <div className="p-6 sm:p-8 max-w-7xl flex flex-col gap-6">
      <PageHeader
        title="Багц / Үнэ / Боломж / Хязгаар"
        description="SuperAdmin: үнэ + хязгаар + дэлгэцийн боломжийн жагсаалт."
      />

      <PlanPriceMatrix
        prices={prices.map((p) => ({
          id: p.id,
          plan: p.plan,
          period: p.period,
          amount: p.amount.toString(),
          currency: p.currency,
          isActive: p.isActive,
          notes: p.notes,
        }))}
      />

      <PlanLimitsManager
        limits={limits.map((l) => ({
          id: l.id,
          plan: l.plan,
          code: l.code,
          intValue: l.intValue,
          boolValue: l.boolValue,
          highlighted: l.highlighted,
        }))}
      />

      <div>
        <h2 className="font-semibold text-sm mb-3">
          Дэлгэцэнд харагдах боломжийн жагсаалт
        </h2>
        <PlanFeaturesManager
          features={features.map((f) => ({
            id: f.id,
            plan: f.plan,
            label: f.label,
            value: f.value,
            description: f.description,
            sortOrder: f.sortOrder,
            highlighted: f.highlighted,
          }))}
        />
      </div>
    </div>
  );
}
