import { ButtonGhost, ButtonPrimary, Container, StatusPill } from "./ui";

type Job = {
  car: string;
  meta: string;
  status: "Дууссан" | "Явцтай" | "Товлосон";
  progress?: { step: string; percent: number; color: string };
};

const jobs: Job[] = [
  {
    car: "Toyota Prius 30",
    meta: "1234 УБА · Тосны солилт",
    status: "Дууссан",
    progress: { step: "4/4 шат", percent: 100, color: "bg-ok" },
  },
  {
    car: "Hyundai Sonata",
    meta: "5678 УНМ · Тормосны наклад",
    status: "Явцтай",
    progress: { step: "2/4 шат", percent: 52, color: "bg-accent" },
  },
  { car: "Lexus RX 350", meta: "9012 УВД · Оношилгоо · 14:30", status: "Товлосон" },
];

const statusStyle: Record<Job["status"], string> = {
  Дууссан: "bg-ok/10 text-ok",
  Явцтай: "bg-accent/15 text-accent",
  Товлосон: "bg-[#1A1E24] text-muted",
};

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-grid bg-[length:72px_72px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_520px_at_20%_0%,rgba(245,165,36,0.12),transparent_70%)]" />
      <Container className="relative grid items-center gap-[72px] py-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <StatusPill>100+ сервис төв carcare дээр ажиллаж байна</StatusPill>
          <h1 className="mt-7 text-[60px] font-semibold leading-[1.04] tracking-[-0.035em] text-ink text-balance">
            Автосервисийн ажлыг <span className="text-accent">нэг урсгал</span> болгоно.
          </h1>
          <p className="mt-6 max-w-[520px] text-[18px] leading-relaxed text-muted text-pretty">
            carcare.mn нь засварын газруудад захиалга, ажлын хуваарь, нөөц, тайланг; жолоочид цаг
            товлолт, засварын түүхийг нэг платформ дээр нэгтгэдэг.
          </p>
          <div className="mt-9 flex gap-3">
            <ButtonPrimary href="#price">Үнэгүй эхлүүлэх</ButtonPrimary>
            <ButtonGhost href="#hows">Хэрхэн ажилладаг</ButtonGhost>
          </div>
          <div className="mt-7 text-[13px] text-muted3">
            14 хоног үнэгүй · карт шаардахгүй · 1 хоногт нэвтрүүлнэ
          </div>
        </div>

        <div className="overflow-hidden rounded-[10px] border border-line bg-panel shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)]">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span className="text-[14px] font-semibold text-ink2">Ажлын урсгал</span>
            </div>
            <span className="font-mono text-[12px] text-muted3">live · 28/08</span>
          </div>
          <div className="flex flex-col gap-3 p-5">
            {jobs.map((job) => (
              <div key={job.car} className="rounded-lg border border-line bg-panel2 px-[18px] py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[15px] font-semibold text-ink2">{job.car}</div>
                    <div className="mt-1 font-mono text-[13px] text-muted2">{job.meta}</div>
                  </div>
                  <span className={`rounded px-2.5 py-1 font-mono text-[12px] ${statusStyle[job.status]}`}>
                    {job.status}
                  </span>
                </div>
                {job.progress && (
                  <>
                    <div className="mt-4 flex items-center justify-between font-mono text-[12px] text-muted3">
                      <span>Ажлын явц</span>
                      <span>{job.progress.step}</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#1A1E24]">
                      <div className={`h-full ${job.progress.color}`} style={{ width: `${job.progress.percent}%` }} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
