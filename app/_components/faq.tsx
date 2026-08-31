import { Container, Eyebrow } from "./landing-ops-ui";

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
    <Container className="pt-24">
      <div id="faq" className="scroll-mt-24 grid gap-10 lg:gap-14 lg:grid-cols-[340px_1fr]">
        <div>
          <Eyebrow>Асуулт хариулт</Eyebrow>
          <h2 className="mt-4 text-2xl sm:text-3xl lg:text-[34px] font-semibold tracking-[-0.03em] text-[var(--oc-ink)]">
            Түгээмэл асуултууд
          </h2>
          <p className="mt-4 text-[14.5px] leading-relaxed text-[var(--oc-muted2)]">
            Хариулт олдсонгүй юу?{" "}
            <a href="mailto:hi@carcare.mn" className="text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)]">
              hi@carcare.mn
            </a>
          </p>
        </div>
        <div className="flex flex-col">
          {ITEMS.map((it, i) => (
            <div
              key={it.q}
              className={`border-t border-[var(--oc-line)] py-[22px] ${
                i === ITEMS.length - 1 ? "border-b" : ""
              }`}
            >
              <div className="text-[16.5px] font-semibold text-[var(--oc-ink2)]">{it.q}</div>
              <div className="mt-2.5 max-w-[700px] text-[14.5px] leading-relaxed text-[var(--oc-muted2)]">
                {it.a}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
