import { ButtonGhost, ButtonPrimary, Container } from "./ui";

export default function Cta() {
  return (
    <Container className="pt-24">
      <div className="relative overflow-hidden rounded-xl border border-line bg-panel p-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_85%_20%,rgba(245,165,36,0.14),transparent_70%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-12">
          <div>
            <h2 className="text-[36px] font-semibold tracking-[-0.03em] text-ink text-balance">
              Засварын газраа carcare дээр нээ
            </h2>
            <p className="mt-3.5 max-w-[560px] text-[16px] leading-relaxed text-muted">
              14 хоног үнэгүй туршиж, нэвтрүүлэлтийн дэмжлэгийг бидний ажилтнаас аваарай.
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <ButtonPrimary href="/business/signup">Үнэгүй эхлүүлэх</ButtonPrimary>
            <ButtonGhost href="#hows">Демо үзэх</ButtonGhost>
          </div>
        </div>
      </div>
    </Container>
  );
}
