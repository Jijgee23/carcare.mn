import { SectionLabel } from "./section-label";

const FEATURES = [
  {
    icon: "🔧",
    title: "Ухаалаг оношилгоо",
    desc: "OBD-II алдааны код танилт, машины үндсэн үзүүлэлтийг автоматаар бүртгэнэ.",
  },
  {
    icon: "📅",
    title: "Захиалга & SMS",
    desc: "Үйлчлүүлэгчид онлайнаар цаг товлоно. ТО-ны хугацааг автоматаар сануулна.",
  },
  {
    icon: "📋",
    title: "Машины бүрэн түүх",
    desc: "Машин бүрийн засвар, сольсон сэлбэг, гүйцэтгэсэн мастер — бүгд хадгалагдана.",
  },
  {
    icon: "📦",
    title: "Нөөц & сэлбэг",
    desc: "Барааны үлдэгдэл, орлого зарлага, нийлүүлэгчийн захиалга нэг дороос.",
  },
  {
    icon: "👥",
    title: "Багийн менежмент",
    desc: "Мастер бүрийн ачаалал, гүйцэтгэл, цалин урамшууллыг тооцоолно.",
  },
  {
    icon: "📊",
    title: "Бодит цагийн тайлан",
    desc: "Орлого, ашиг, ачаалал, үйлчлүүлэгчийн сэтгэл ханамжийг шууд хяна.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0d0d14]">
      <div className="max-w-6xl mx-auto">
        <SectionLabel>Боломжууд</SectionLabel>
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
          Сервисийн өдөр тутамд хэрэгцээтэй бүх зүйл
        </h2>
        <p className="text-center text-white/40 text-sm mb-14">
          Сэлбэгийн нөөцөөс эхлээд тайлан хүртэл — нэг систем дотор
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass card-hover rounded-2xl p-6">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
