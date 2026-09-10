"use client";

import { splitMinutes } from "@/lib/category-duration";

// Цаг + минут хос input — server action-д `durationHours`/`durationMinutes`
// хоёр талбар болж очих ба сервер тал нийт минут болгон нэгтгэнэ (хадгалалт нь
// минутаар хэвээр). Хоёул хоосон = тохируулаагүй / цэвэрлэх.
export function DurationHmInput({
  defaultMinutes,
  invalid,
  compact,
  onChange,
}: {
  defaultMinutes: number | null;
  invalid?: boolean;
  compact?: boolean;
  // Заавал биш: сонгосон нийт минутыг (хоёул хоосон бол null) ажиглах хэрэгтэй
  // дуудагчид зориулав (ж: order-form.tsx-ийн "ghost" урьдчилсан харагдац) —
  // энэ талбар өөрөө хэвээрээ uncontrolled (defaultValue), зөвхөн нэмэлт
  // ажиглалт, төлөв удирдахгүй.
  onChange?: (minutes: number | null) => void;
}) {
  const split = defaultMinutes != null ? splitMinutes(defaultMinutes) : null;
  const w = compact ? "w-16" : "w-20";
  const border = invalid ? "border-red-500/50" : "";

  function emit(hoursRaw: string, minutesRaw: string) {
    if (!onChange) return;
    const h = hoursRaw.trim() ? Number(hoursRaw) : 0;
    const m = minutesRaw.trim() ? Number(minutesRaw) : 0;
    if (!hoursRaw.trim() && !minutesRaw.trim()) {
      onChange(null);
      return;
    }
    onChange(Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null);
  }

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
        onChange={
          onChange
            ? (e) => emit(e.target.value, (e.target.form?.elements.namedItem("durationMinutes") as HTMLInputElement | null)?.value ?? "")
            : undefined
        }
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
        onChange={
          onChange
            ? (e) => emit((e.target.form?.elements.namedItem("durationHours") as HTMLInputElement | null)?.value ?? "", e.target.value)
            : undefined
        }
        className={`auth-input ${w} ${border}`}
      />
      <span className="text-xs text-[var(--oc-muted3)]">мин</span>
    </div>
  );
}
