/**
 * Ажлын хувиарын харагдацын цэвэр туслахууд — `ScheduleGrid` (7 хоног/сар,
 * олон ажилтан) болон `MonthCalendar` (миний хувиар, сар) хоёул ашиглана.
 * Салбар бүрд `--oc-b1..b6` token-уудаас өнгө оноож, ээлжийн нүд/аватар/чип
 * бүгд ижил өнгөөр танигдана (designs/Schedule Calendar).
 */

export const BRANCH_COLOR_COUNT = 6;

/** `index`-р салбарын өнгийн класс (`.branch-c1..c6`, globals.css) — 6-аас олон
 * салбар бол ээлжлэн давтагдана. Класс нь `--branch-color`-ыг тогтоох тул
 * `.shift-box`/`.branch-avatar`/`.branch-ink`/`.branch-dot`-той хамт хэрэглэнэ. */
export function branchColorClass(index: number): string {
  const n = ((index % BRANCH_COLOR_COUNT) + BRANCH_COLOR_COUNT) % BRANCH_COLOR_COUNT;
  return `branch-c${n + 1}`;
}

/** Нэрээр эрэмбэлэгдсэн салбаруудын жагсаалтаас `branchId → өнгийн класс` map. */
export function buildBranchColorMap(branches: ReadonlyArray<{ id: string }>): Map<string, string> {
  return new Map(branches.map((b, i) => [b.id, branchColorClass(i)]));
}

/** Салбар тодорхойгүй (устсан/хандах эрхгүй) segment-ийн саарал класс. */
export const FALLBACK_BRANCH_CLASS = "branch-c0";

/** "Овог Нэр" → "ОН" (эхний 2 үгийн эхний үсэг). */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** "HH:MM"–"HH:MM" → цаг (шөнө дамнасан бол +24). Аль нэг нь байхгүй бол null. */
export function segmentHours(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const parse = (s: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) return null;
    return Number(m[1]) + Number(m[2]) / 60;
  };
  const a = parse(start);
  const b = parse(end);
  if (a === null || b === null) return null;
  let diff = b - a;
  if (diff < 0) diff += 24;
  return Math.round(diff * 10) / 10;
}

/** 8 → "8", 8.5 → "8.5", 42.333 → "42.3". */
export function formatHours(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** "2026-09-14" → "09/14". */
export function formatMonthDay(dateStr: string): string {
  return `${dateStr.slice(5, 7)}/${dateStr.slice(8, 10)}`;
}
