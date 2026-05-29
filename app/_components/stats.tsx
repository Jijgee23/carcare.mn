const STATS = [
  { value: "100+", label: "Сервис төв" },
  { value: "5,000+", label: "Захиалга / сар" },
  { value: "30+", label: "Машины марк" },
  { value: "4.9★", label: "Дундаж үнэлгээ" },
];

export function Stats() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 border-y border-white/[0.06]">
      <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-3xl sm:text-4xl font-bold gradient-text mb-1">
              {s.value}
            </div>
            <div className="text-sm text-white/40">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
