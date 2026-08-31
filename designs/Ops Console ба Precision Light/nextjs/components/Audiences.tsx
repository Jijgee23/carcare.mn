import Link from "next/link";
import { Container } from "./ui";

const cards = [
  {
    eyebrow: "Засварын газарт",
    eyebrowClass: "text-accent",
    arrowClass: "text-accent",
    title: "Ажлаа удирдах консол",
    body:
      "Захиалга хүлээж авах, мастер хуваарилах, сэлбэг зарлагадах, орлогоо тайлагнах — бүгд нэг дэлгэцээс.",
    items: [
      "Талбай, мастерын ачааллын хуанли",
      "Сэлбэгийн нөөц, доод хязгаарын сануулга",
      "Салбар бүрийн орлогын тайлан, экспорт",
    ],
    cta: { href: "/business/login", label: "Бизнес хандалт", primary: true },
  },
  {
    eyebrow: "Жолоочид",
    eyebrowClass: "text-ok",
    arrowClass: "text-ok",
    title: "Машиныхаа хөтөч",
    body:
      "Хажуугийн сервис төвийн сул цагийг хараад онлайнаар захиал. Засварын түүх, зардал өөрт хадгалагдана.",
    items: [
      "Үнэ, хаяг, үнэлгээгээр сервис сонгох",
      "Засварын явцын мэдэгдэл, SMS",
      "Тос, дугуйн дараагийн хугацааны сануулга",
    ],
    cta: { href: "/login", label: "Жолоочоор нэвтрэх", primary: false },
  },
];

export default function Audiences() {
  return (
    <Container className="pt-[88px]">
      <div className="grid gap-6 lg:grid-cols-2">
        {cards.map((c) => (
          <div key={c.title} className="rounded-[10px] border border-line bg-panel px-9 py-[34px]">
            <div className={`font-mono text-[12px] uppercase tracking-[0.14em] ${c.eyebrowClass}`}>
              {c.eyebrow}
            </div>
            <h3 className="mt-4 text-[26px] font-semibold tracking-[-0.02em] text-ink">{c.title}</h3>
            <p className="mt-3 text-[15.5px] leading-relaxed text-muted">{c.body}</p>
            <div className="mt-6 flex flex-col gap-2.5">
              {c.items.map((i) => (
                <div key={i} className="flex gap-3 text-[14.5px] text-ink2">
                  <span className={`font-mono ${c.arrowClass}`}>→</span>
                  {i}
                </div>
              ))}
            </div>
            <Link
              href={c.cta.href}
              className={
                c.cta.primary
                  ? "mt-[26px] inline-block rounded-lg bg-accent px-5 py-3 text-[14.5px] font-semibold text-carbon hover:bg-accentHi hover:text-carbon"
                  : "mt-[26px] inline-block rounded-lg border border-[#2A2D33] px-5 py-3 text-[14.5px] font-semibold text-ink2 hover:border-[#3D424A] hover:bg-[#14181D] hover:text-ink2"
              }
            >
              {c.cta.label}
            </Link>
          </div>
        ))}
      </div>
    </Container>
  );
}
