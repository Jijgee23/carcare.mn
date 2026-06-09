import Link from "next/link";
import { formatTugrik } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { SectionHeading } from "./section-heading";

type PlanKey = "FREE" | "BUSINESS" | "ENTERPRISE";

const PLAN_ORDER: PlanKey[] = ["FREE", "BUSINESS", "ENTERPRISE"];

// Маркетингийн текст (нэр, тайлбар, CTA) код дотор. Үнэ + боломжийн жагсаалт нь
// backend-аас (PlanPrice / PlanFeature) ирнэ. DB-д тухайн багцын боломж байхгүй
// бол доорх fallback-ийг харуулна.
const PLAN_META: Record<
  PlanKey,
  {
    name: string;
    desc: string;
    cta: string;
    href: string;
    highlighted: boolean;
    fallbackPrice: string;
    fallbackFeatures: string[];
  }
> = {
  FREE: {
    name: "Эхлэл",
    desc: "Жижиг сервис, дөнгөж эхэлж буй багуудад.",
    cta: "Үнэгүй бүртгүүлэх",
    href: "/page/signup",
    highlighted: false,
    fallbackPrice: "Үнэгүй",
    fallbackFeatures: [
      "1 салбар",
      "3 хүртэлх хэрэглэгч",
      "Захиалга & машины түүх",
      "Үндсэн тайлан",
    ],
  },
  BUSINESS: {
    name: "Бизнес",
    desc: "Олон мастертай, өсөн нэмэгдэж буй сервисүүдэд.",
    cta: "14 хоног үнэгүй",
    href: "/page/signup?plan=business",
    highlighted: true,
    fallbackPrice: "Захиалгат",
    fallbackFeatures: [
      "5 хүртэл салбар",
      "30 хүртэлх хэрэглэгч",
      "SMS сануулга",
      "Дэвшилтэт тайлан & экспорт",
      "API хандалт",
    ],
  },
  ENTERPRISE: {
    name: "Энтерпрайз",
    desc: "Сүлжээ, олон улсын байгууллагуудад.",
    cta: "Холбоо барих",
    href: "/contact",
    highlighted: false,
    fallbackPrice: "Захиалгат",
    fallbackFeatures: [
      "Хязгааргүй салбар & хэрэглэгч",
      "SSO & SLA",
      "Зориулсан тохиргоо",
      "Тусгай интеграц",
    ],
  },
};

function isAbsent(v: string): boolean {
  const s = v.trim().toLowerCase();
  return ["", "—", "-", "үгүй", "байхгүй", "no", "false", "x"].includes(s);
}
function isYes(v: string): boolean {
  const s = v.trim().toLowerCase();
  return ["тийм", "бий", "байгаа", "yes", "true", "✓"].includes(s);
}
function featureText(label: string, value: string): string | null {
  if (isAbsent(value)) return null;
  if (isYes(value)) return label;
  return `${label}: ${value}`;
}

export async function Pricing() {
  const [prices, features] = await Promise.all([
    prisma.planPrice.findMany({
      where: { isActive: true, period: "MONTH" },
      select: { plan: true, amount: true },
    }),
    prisma.planFeature.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { plan: true, label: true, value: true },
    }),
  ]);

  const priceByPlan = new Map(prices.map((p) => [p.plan, p.amount]));

  const plans = PLAN_ORDER.map((plan) => {
    const meta = PLAN_META[plan];
    const amount = priceByPlan.get(plan);
    const hasPaidPrice = amount != null && Number(amount.toString()) > 0;

    let price: string;
    let period: string;
    if (hasPaidPrice) {
      price = formatTugrik(amount.toString());
      period = "/сар";
    } else if (plan === "FREE") {
      price = "Үнэгүй";
      period = "үргэлж";
    } else {
      price = meta.fallbackPrice;
      period = "";
    }

    const dbFeatures = features
      .filter((f) => f.plan === plan)
      .map((f) => featureText(f.label, f.value))
      .filter((t): t is string => t !== null);
    const featureList =
      dbFeatures.length > 0 ? dbFeatures : meta.fallbackFeatures;

    return {
      key: plan,
      name: meta.name,
      desc: meta.desc,
      cta: meta.cta,
      href: meta.href,
      highlighted: meta.highlighted,
      price,
      period,
      features: featureList,
    };
  });

  return (
    <section
      id="pricing"
      className="scroll-mt-24 py-24 px-4 sm:px-6 lg:px-8 bg-[#0d0d14]"
    >
      <div className="max-w-7xl mx-auto">
        <SectionHeading
          label="Үнэ"
          title="Жижиг сервисээс эхлээд сүлжээ хүртэл"
          subtitle="Хэдхэн машинаар эхэлж, бизнесийнхээ хэмжээгээр өс. Үнэ ил тод, нуугдмал төлбөргүй."
        />

        <div className="grid gap-5 lg:grid-cols-3 items-stretch max-w-6xl mx-auto">
          {plans.map((p) => (
            <div
              key={p.key}
              className={`relative rounded-2xl p-7 flex flex-col ${
                p.highlighted
                  ? "glass border border-violet-500/40 shadow-[0_8px_60px_rgba(108,71,255,0.15)]"
                  : "glass card-hover"
              }`}
            >
              {p.highlighted ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 px-3 py-1 rounded-full text-xs font-semibold">
                  Алдартай
                </span>
              ) : null}

              <h3 className="font-semibold text-lg">{p.name}</h3>
              <p className="mt-1 text-sm text-white/50">{p.desc}</p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight">
                  {p.price}
                </span>
                <span className="text-sm text-white/40">{p.period}</span>
              </div>

              <Link
                href={p.href}
                className={`mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition-all ${
                  p.highlighted
                    ? "bg-violet-600 hover:bg-violet-500"
                    : "glass hover:bg-white/[0.08] text-white/80"
                }`}
              >
                {p.cta}
              </Link>

              <ul className="mt-6 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-white/70">
                    <span className="mt-0.5 text-violet-400">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
