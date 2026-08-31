import { Container, Eyebrow } from "./ui";

const steps = [
  {
    kicker: "01 / Тохиргоо",
    title: "Байгууллага, салбар нэмэх",
    body: "Талбай, мастер, үйлчилгээний үнийн лист, ажлын цагийг оруулна.",
    active: true,
  },
  {
    kicker: "02 / Нэвтрүүлэлт",
    title: "Хэрэглэгчийн эрх, сургалт",
    body: "Админ, менежер, мастерын эрх. 90 минутын онлайн сургалт.",
    active: false,
  },
  {
    kicker: "03 / Ажиллагаа",
    title: "Онлайн захиалга нээх",
    body: "Сервис төв нь жолоочийн апп дээр харагдаж, захиалга шууд орж эхэлнэ.",
    active: false,
  },
];

export default function HowItWorks() {
  return (
    <Container className="pt-24">
      <div id="hows" className="scroll-mt-24">
        <Eyebrow>Хэрхэн ажилладаг</Eyebrow>
        <h2 className="mb-10 mt-4 text-[40px] font-semibold tracking-[-0.03em] text-ink">
          Гурван хоногт бүрэн нэвтэрнэ
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.kicker}
              className={`border-t-2 pt-[22px] ${s.active ? "border-accent" : "border-[#2A2D33]"}`}
            >
              <div className="font-mono text-[13px] text-muted3">{s.kicker}</div>
              <div className="mt-3 text-[19px] font-semibold text-ink2">{s.title}</div>
              <div className="mt-2.5 text-[14.5px] leading-relaxed text-muted2">{s.body}</div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
