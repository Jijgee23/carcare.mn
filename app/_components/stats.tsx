import { Container } from "./landing-ops-ui";

const STATS = [
  { value: "100+", label: "Сервис төв" },
  { value: "5,000+", label: "Захиалга / сар" },
  { value: "30+", label: "Машины марк" },
  { value: "4.9★", label: "Дундаж үнэлгээ" },
];

export function Stats() {
  return (
    <section className="border-y border-[var(--oc-line2)] bg-[var(--oc-panel)]">
      <Container>
        <div className="grid gap-px bg-[var(--oc-line2)] sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-[var(--oc-panel)] py-9 pr-2 lg:pl-7 lg:first:pl-0">
              <div className="font-plex-mono text-[34px] font-semibold text-[var(--oc-ink)]">
                {s.value}
              </div>
              <div className="mt-2 text-[13.5px] text-[var(--oc-muted2)]">{s.label}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
