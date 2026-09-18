/**
 * Хувиарын хуудсуудын гарчгийн блок (designs/Schedule Calendar): жижиг
 * eyebrow → том h1 → тайлбар. `ScheduleGrid`-ийн `header` слотод өгнө.
 */
export function ScheduleHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--oc-muted3)]">
        {eyebrow}
      </div>
      <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.03em] text-[var(--oc-ink)]">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-[56ch] text-sm text-[var(--oc-muted2)] [text-wrap:pretty]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
