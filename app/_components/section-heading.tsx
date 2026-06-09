import { SectionLabel } from "./section-label";

/** Landing section-уудын нэгдсэн гарчиг блок (шошго + гарчиг + дэд тайлбар). */
export function SectionHeading({
  label,
  title,
  subtitle,
}: {
  label: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-12 sm:mb-14">
      <SectionLabel>{label}</SectionLabel>
      <h2 className="text-3xl sm:text-4xl font-bold text-center tracking-tight">
        {title}
      </h2>
      {subtitle ? (
        <p className="text-center text-white/45 mt-4 max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
