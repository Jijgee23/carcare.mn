"use client";

import { splitMinutes } from "@/lib/category-duration";

// Цаг + минут хос input — server action-д `durationHours`/`durationMinutes`
// хоёр талбар болж очих ба сервер тал нийт минут болгон нэгтгэнэ (хадгалалт нь
// минутаар хэвээр). Хоёул хоосон = тохируулаагүй / цэвэрлэх.
export function DurationHmInput({
  defaultMinutes,
  invalid,
  compact,
}: {
  defaultMinutes: number | null;
  invalid?: boolean;
  compact?: boolean;
}) {
  const split = defaultMinutes != null ? splitMinutes(defaultMinutes) : null;
  const w = compact ? "w-16" : "w-20";
  const border = invalid ? "border-red-500/50" : "";
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <input
        name="durationHours"
        type="number"
        min={0}
        max={12}
        step={1}
        defaultValue={split ? String(split.hours) : ""}
        placeholder="0"
        aria-label="Цаг"
        className={`auth-input ${w} ${border}`}
      />
      <span className="text-xs text-[var(--oc-muted3)]">ц</span>
      <input
        name="durationMinutes"
        type="number"
        min={0}
        max={59}
        step={5}
        defaultValue={split ? String(split.minutes) : ""}
        placeholder="00"
        aria-label="Минут"
        className={`auth-input ${w} ${border}`}
      />
      <span className="text-xs text-[var(--oc-muted3)]">мин</span>
    </div>
  );
}
