import { SectionLabel } from "./section-label";

const STEPS = [
  {
    num: "01",
    title: "Бүртгүүлэх",
    desc: "Имэйлээрээ 2 минутын дотор салбараа үүсгэж тохируулна.",
  },
  {
    num: "02",
    title: "Багаа урих",
    desc: "Менежер, мастер, кассчдаа үүрэгтэйгээр урина — хандалт хязгаарлагдсан.",
  },
  {
    num: "03",
    title: "Удирдлагаа эхлүүлэх",
    desc: "Захиалга авч, машины түүх хөтлөж, тайлангаа шууд харна.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <SectionLabel>Хэрхэн ажилладаг</SectionLabel>
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">
          3 алхамд үйлчилгээгээ онлайн болго
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="glass card-hover rounded-2xl p-7 relative overflow-hidden"
            >
              <div className="text-6xl font-black text-white/[0.04] absolute top-4 right-6 leading-none select-none">
                {step.num}
              </div>
              <div className="text-violet-400 font-mono text-sm font-bold mb-4">
                {step.num}
              </div>
              <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
