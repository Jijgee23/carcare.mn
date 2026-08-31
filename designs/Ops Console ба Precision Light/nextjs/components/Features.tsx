import { Container, Eyebrow } from "./ui";

const features = [
  { title: "Захиалга ба хуанли", body: "Онлайн товлолт, талбайн зэрэгцээ ачаалал, давхардлын хяналт." },
  { title: "Машины паспорт", body: "Улсын дугаараар бүх засвар, сэлбэг, гүйлт, зардлын архив." },
  { title: "Ажлын урсгал", body: "Хүлээгдэж → Явцтай → Хяналт → Дууссан. Шат бүрт хариуцагч." },
  { title: "Сэлбэгийн нөөц", body: "Бараа материалын хөдөлгөөн, доод хязгаар, татан авалтын заявк." },
  { title: "Төлбөр ба падаан", body: "QPay, картын нэгтгэл, ебаримт, урьдчилгааны хяналт." },
  { title: "Тайлан, шинжилгээ", body: "Мастер, үйлчилгээ, салбараар орлогын зүсэлт. Excel экспорт." },
];

export default function Features() {
  return (
    <Container className="pt-24" >
      <div id="boloms" className="scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-10">
          <div>
            <Eyebrow>Боломжууд</Eyebrow>
            <h2 className="mt-4 max-w-[560px] text-[40px] font-semibold tracking-[-0.03em] text-ink text-balance">
              Өдөр тутмын ажилд шаардах бүх модуль
            </h2>
          </div>
          <p className="max-w-[380px] text-[15px] leading-relaxed text-muted2">
            Нэг байгууллага — олон салбар, олон хэрэглэгч. Эрхийн тохиргоо, өгөгдлийн тусгаарлалт нь
            байгууллага тус бүрд.
          </p>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-[10px] border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-panel px-[30px] py-7">
              <div className="text-[17px] font-semibold text-ink2">{f.title}</div>
              <div className="mt-2.5 text-[14.5px] leading-relaxed text-muted2">{f.body}</div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
