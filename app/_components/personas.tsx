import Link from "next/link";
import { CarIcon, TrendingUpIcon, WrenchIcon } from "./landing-icons";
import { SectionHeading } from "./section-heading";

const PERSONAS = [
  {
    icon: <TrendingUpIcon />,
    role: "Сервисийн эзэн",
    title: "Олон салбараа нэг дороос удирд",
    desc: "Орлого, ачаалал, нөөц, ажилчдын гүйцэтгэлийг бодит цагт хяна. Шийдвэрээ өгөгдөл дээр тулгуурлан гарга.",
  },
  {
    icon: <WrenchIcon />,
    role: "Менежер / Мастер",
    title: "Өдрийн ажлын явц гартаа",
    desc: "Захиалга, машины түүх, ашиглах сэлбэг — гар утаснаасаа л шууд харна. Урт жагсаалт хэвлэхээ боль.",
  },
  {
    icon: <CarIcon />,
    role: "Үйлчлүүлэгч",
    title: "Машиныхаа эрүүл мэндийг мэдэх",
    desc: "Өмнөх засваруудын түүх, дараагийн ТО-ны хугацаа, үнийн саналыг утсан дээрээ.",
    href: "/login",
    ctaLabel: "Утасны дугаараа оруулж нэвтрэх",
  },
];

export function Personas() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <SectionHeading
          label="Хэнд зориулсан"
          title="Сервистэй холбоотой хүн бүхэнд"
        />

        <div className="grid md:grid-cols-3 gap-6">
          {PERSONAS.map((p) => (
            <div key={p.role} className="glass card-hover rounded-2xl p-7 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4">
                {p.icon}
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                {p.role}
              </span>
              <h3 className="mt-2 text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-white/50 leading-relaxed">
                {p.desc}
              </p>
              {p.href ? (
                <Link
                  href={p.href}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
                >
                  {p.ctaLabel} →
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
