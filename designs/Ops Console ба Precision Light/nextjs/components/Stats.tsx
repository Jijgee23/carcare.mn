import { Container } from "./ui";

const stats = [
  { value: "100+", label: "Сервис төв" },
  { value: "48,200", label: "Бүртгэсэн захиалга" },
  { value: "32%", label: "Талбайн эргэлт өссөн" },
  { value: "99.98%", label: "Системийн ажиллагаа" },
];

export default function Stats() {
  return (
    <section className="border-y border-line2 bg-panel">
      <Container>
        <div className="grid gap-px bg-line2 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-panel py-9 pr-2 lg:pl-7 lg:first:pl-0">
              <div className="font-mono text-[34px] font-semibold text-ink">{s.value}</div>
              <div className="mt-2 text-[13.5px] text-muted2">{s.label}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
