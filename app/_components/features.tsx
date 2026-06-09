import { SectionHeading } from "./section-heading";

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
    <section
      id="features"
      className="scroll-mt-24 py-24 px-4 sm:px-6 lg:px-8 bg-[#0d0d14]"
    >
      <div className="max-w-7xl mx-auto">
        <SectionHeading
          label="Боломжууд"
          title="Сервисийн өдөр тутамд хэрэгцээтэй бүх зүйл"
          subtitle="Сэлбэгийн нөөцөөс эхлээд тайлан хүртэл — нэг систем дотор."
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass card-hover rounded-2xl p-6">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-2xl mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
