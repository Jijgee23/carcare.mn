import { SectionLabel } from "./section-label";

const PERSONAS = [
  {
    icon: "📈",
    role: "Сервисийн эзэн",
    title: "Олон салбараа нэг дороос удирд",
    desc: "Орлого, ачаалал, нөөц, ажилчдын гүйцэтгэлийг бодит цагт хяна. Шийдвэрээ өгөгдөл дээр тулгуурлан гарга.",
  },
  {
    icon: "🛠️",
    role: "Менежер / Мастер",
    title: "Өдрийн ажлын явц гартаа",
    desc: "Захиалга, машины түүх, ашиглах сэлбэг — гар утаснаасаа л шууд харна. Урт жагсаалт хэвлэхээ боль.",
  },
  {
    icon: "🚗",
    role: "Үйлчлүүлэгч",
    title: "Машиныхаа эрүүл мэндийг мэдэх",
    desc: "Өмнөх засваруудын түүх, дараагийн ТО-ны хугацаа, үнийн саналыг утсан дээрээ.",
  },
];

export function Personas() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <SectionLabel>Хэнд зориулсан</SectionLabel>
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">
          Сервистэй холбоотой хүн бүхэнд
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {PERSONAS.map((p) => (
            <div key={p.role} className="glass card-hover rounded-2xl p-7">
              <div className="text-4xl mb-4">{p.icon}</div>
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                {p.role}
              </span>
              <h3 className="mt-2 text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-white/50 leading-relaxed">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
