import { Container, Eyebrow } from "./landing-ops-ui";

const FEATURES = [
  {
    title: "Ухаалаг оношилгоо",
    desc: "OBD-II алдааны код танилт, машины үндсэн үзүүлэлтийг автоматаар бүртгэнэ.",
  },
  {
    title: "Захиалга & SMS",
    desc: "Үйлчлүүлэгчид онлайнаар цаг товлоно. ТО-ны хугацааг автоматаар сануулна.",
  },
  {
    title: "Машины бүрэн түүх",
    desc: "Машин бүрийн засвар, сольсон сэлбэг, гүйцэтгэсэн мастер — бүгд хадгалагдана.",
  },
  {
    title: "Нөөц & сэлбэг",
    desc: "Барааны үлдэгдэл, орлого зарлага, нийлүүлэгчийн захиалга нэг дороос.",
  },
  {
    title: "Багийн менежмент",
    desc: "Мастер бүрийн ачаалал, гүйцэтгэл, цалин урамшууллыг тооцоолно.",
  },
  {
    title: "Бодит цагийн тайлан",
    desc: "Орлого, ашиг, ачаалал, үйлчлүүлэгчийн сэтгэл ханамжийг шууд хяна.",
  },
];

export function Features() {
  return (
    <Container className="pt-24">
      <div id="boloms" className="scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-10">
          <div>
            <Eyebrow>Боломжууд</Eyebrow>
            <h2 className="mt-4 max-w-[560px] text-3xl sm:text-4xl lg:text-[40px] font-semibold tracking-[-0.03em] text-[var(--oc-ink)] text-balance">
              Сервисийн өдөр тутамд хэрэгцээтэй бүх зүйл
            </h2>
          </div>
          <p className="max-w-[380px] text-[15px] leading-relaxed text-[var(--oc-muted2)]">
            Сэлбэгийн нөөцөөс эхлээд тайлан хүртэл — нэг систем дотор.
          </p>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-line)] md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-[var(--oc-panel)] px-[30px] py-7 min-w-0">
              <div className="text-[17px] font-semibold text-[var(--oc-ink2)]">{f.title}</div>
              <div className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--oc-muted2)]">
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
