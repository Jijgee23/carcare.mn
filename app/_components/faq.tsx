import { SectionLabel } from "./section-label";

const ITEMS = [
  {
    q: "Хэдэн салбартай байж болох вэ?",
    a: "Эхлэл багц 1 салбар, Бизнес багц 5 салбар хүртэл. Энтерпрайз багцанд салбарын тоо хязгааргүй.",
  },
  {
    q: "Өгөгдлийн нууцлал хэр найдвартай вэ?",
    a: "Сервер дээрх өгөгдөл шифрлэгдсэн, өдөр тутмын backup автоматаар хийгдэнэ. Салбар бүрийн өгөгдөл бие даан тусгаарлагдсан (multi-tenant).",
  },
  {
    q: "Гар утсаар ашиглах боломжтой юу?",
    a: "carcare нь mobile-first зарчмаар хийгдсэн. iOS, Android-ийн ямар ч хөтчөөс асуудалгүй ажиллана.",
  },
  {
    q: "Хуучин Excel/1C-н өгөгдлөө шилжүүлж болох уу?",
    a: "Тийм. CSV, Excel импорт боломжтой. Том багуудад манай баг тусгайлсан шилжилт хийж өгнө.",
  },
  {
    q: "Дэмжлэг хэрхэн авах вэ?",
    a: "Чат, имэйл, утсаар Mongolia дотроос дэмжлэг үзүүлдэг. Бизнес ба Энтерпрайз багцанд тэргүүн ээлжид хариулна.",
  },
  {
    q: "Гэрээт интеграц хийж болох уу?",
    a: "Манай REST API ба webhook системээр касс, банк, нягтлан бодох системтэй холбогдоно.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <SectionLabel>Асуулт хариулт</SectionLabel>
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
          Түгээмэл асуултууд
        </h2>
        <p className="text-center text-white/40 text-sm mb-12">
          Хариулт олдсонгүй юу?{" "}
          <a
            href="mailto:hi@carcare.mn"
            className="text-violet-400 hover:text-violet-300"
          >
            hi@carcare.mn
          </a>
        </p>

        <div className="flex flex-col gap-3">
          {ITEMS.map((it, i) => (
            <details
              key={it.q}
              className="group glass rounded-2xl px-5 py-4 sm:px-6"
              {...(i === 0 ? { open: true } : {})}
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left font-medium">
                <span>{it.q}</span>
                <span
                  aria-hidden
                  className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm flex items-center justify-center transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-white/50 leading-relaxed">
                {it.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
