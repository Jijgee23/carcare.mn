import Link from "next/link";
import { SectionLabel } from "./section-label";

const PLANS = [
  {
    name: "Эхлэл",
    price: "Үнэгүй",
    period: "үргэлж",
    desc: "Жижиг сервис, дөнгөж эхэлж буй багуудад.",
    cta: "Үнэгүй бүртгүүлэх",
    href: "/page/signup",
    features: [
      "1 салбар",
      "3 хүртэлх хэрэглэгч",
      "Захиалга & машины түүх",
      "Үндсэн тайлан",
    ],
    highlighted: false,
  },
  {
    name: "Бизнес",
    price: "199,000₮",
    period: "/сар",
    desc: "Олон мастертай, өсөн нэмэгдэж буй сервисүүдэд.",
    cta: "14 хоног үнэгүй",
    href: "/page/signup?plan=business",
    features: [
      "5 хүртэл салбар",
      "30 хүртэлх хэрэглэгч",
      "SMS сануулга",
      "Нөөц, нийлүүлэгч",
      "Дэвшилтэт тайлан & экспорт",
      "API хандалт",
    ],
    highlighted: true,
  },
  {
    name: "Энтерпрайз",
    price: "Захиалгат",
    period: "үнэ",
    desc: "Сүлжээ, олон улсын байгууллагуудад.",
    cta: "Холбоо барих",
    href: "/contact",
    features: [
      "Хязгааргүй салбар & хэрэглэгч",
      "SSO & SLA",
      "Зориулсан тохиргоо",
      "Тусгай интеграц",
      "Тогтмол менежертэй",
    ],
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0d0d14]">
      <div className="max-w-6xl mx-auto">
        <SectionLabel>Үнэ</SectionLabel>
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
          Жижиг сервисээс эхлээд сүлжээ хүртэл
        </h2>
        <p className="text-center text-white/40 text-sm mb-14 max-w-xl mx-auto">
          Хэдхэн машинаар эхэлж, бизнесийнхээ хэмжээгээр өс. Үнэ нь ил тод, нуугдмал төлбөргүй.
        </p>

        <div className="grid gap-5 lg:grid-cols-3 items-stretch">
          {PLANS.map((p) => (
            <div
              key={p.name}
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
