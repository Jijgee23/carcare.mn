import Link from "next/link";
import { Container, Eyebrow } from "./ui";

const plans = [
  {
    name: "Жижиг",
    scope: "1–2 талбай",
    price: "149,000₮",
    items: ["Захиалга, хуанли, машины паспорт", "3 хэрэглэгч", "Имэйл дэмжлэг"],
    cta: "Сонгох",
    featured: false,
  },
  {
    name: "Стандарт",
    scope: "3–8 талбай",
    price: "349,000₮",
    items: ["Жижиг багцын бүх боломж", "Нөөц, төлбөр, тайлангийн модуль", "12 хэрэглэгч · SMS сануулга"],
    cta: "14 хоног үнэгүй",
    featured: true,
  },
  {
    name: "Сүлжээ",
    scope: "Олон салбар",
    price: "Тохиролцоно",
    items: ["Салбар хоорондын нэгдсэн тайлан", "SSO, API, нягтлан нэгтгэл", "Хувийн дэмжлэгийн менежер"],
    cta: "Холбоо барих",
    featured: false,
  },
];

export default function Pricing() {
  return (
    <Container className="pt-24">
      <div id="price" className="scroll-mt-24">
        <Eyebrow>Үнэ</Eyebrow>
        <h2 className="mb-2 mt-4 text-[40px] font-semibold tracking-[-0.03em] text-ink">Талбайн тоогоор</h2>
        <p className="mb-10 text-[15.5px] text-muted2">Жолоочид үргэлж үнэгүй. Сар бүр, НӨАТ ороогүй.</p>
        <div className="grid items-start gap-6 lg:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={
                p.featured
                  ? "rounded-[10px] border border-accent bg-[#12141A] px-8 py-[30px] shadow-[0_24px_60px_-30px_rgba(245,165,36,0.35)]"
                  : "rounded-[10px] border border-line bg-panel px-8 py-[30px]"
              }
            >
              <div className="flex items-center justify-between">
                <div className="text-[18px] font-semibold text-ink2">{p.name}</div>
                {p.featured && (
                  <span className="rounded bg-accent px-2.5 py-1 font-mono text-[11.5px] tracking-[0.06em] text-carbon">
                    ХАМГИЙН ТОХИРОМЖТОЙ
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-[14px] text-muted2">{p.scope}</div>
              <div className="mt-[22px] font-mono text-[32px] font-semibold text-ink">{p.price}</div>
              <div className="mt-[22px] flex flex-col gap-2.5 text-[14.5px] text-muted">
                {p.items.map((i) => (
                  <span key={i}>{i}</span>
                ))}
              </div>
              <Link
                href="/business/signup"
                className={
                  p.featured
                    ? "mt-[26px] block rounded-lg bg-accent py-3 text-center text-[14.5px] font-semibold text-carbon hover:bg-accentHi hover:text-carbon"
                    : "mt-[26px] block rounded-lg border border-[#2A2D33] py-3 text-center text-[14.5px] font-semibold text-ink2 hover:border-[#3D424A] hover:bg-[#14181D] hover:text-ink2"
                }
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
