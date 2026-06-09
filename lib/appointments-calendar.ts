/**
 * Цаг захиалгын календарь — 7 хоног / сарын интервалаар хугацааны муж + нүднүүдийг
 * тооцоолно. Огнооны бүх логик энд (lib) байрлана — server component-ийн render
 * дотор `new Date()` дуудвал react-hooks/purity дүрэм алдаа өгдөг тул.
 *
 * Долоо хоног Даваагаар эхэлнэ (MN бизнесийн жишгээр).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// Даваа эхэлсэн долоо хоногийн өдрийн товч нэр.
export const WEEKDAY_LABELS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

export type CalendarInterval = "week" | "month";

export type CalendarDay = {
  key: string; // YYYY-MM-DD (local)
  date: Date; // өдрийн эхлэл (00:00)
  inMonth: boolean; // (сар харагдацад) anchor сард хамаарах эсэх
  isToday: boolean;
};

export type ResolvedCalendar = {
  interval: CalendarInterval;
  rangeStart: Date; // query gte (inclusive)
  rangeEnd: Date; // query lt (exclusive)
  days: CalendarDay[];
  label: string;
  prevAnchorKey: string;
  nextAnchorKey: string;
  todayKey: string;
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Тухайн өдрийг агуулсан долоо хоногийн Даваа.
function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Ня..6=Бя
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

/** Огноог локал YYYY-MM-DD түлхүүр болгоно. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Өнөөдрийн YYYY-MM-DD (локал). Component-ийн render дотор шууд `new Date()`
 * дуудвал react-hooks/purity алдаа өгдөг тул энэ helper-ээр авна. */
export function todayKey(): string {
  return dateKey(new Date());
}

function parseAnchor(s: string | undefined): Date {
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`);
    if (Number.isFinite(d.getTime())) return startOfDay(d);
  }
  return startOfDay(new Date());
}

export function resolveCalendar(sp: {
  interval?: string;
  anchor?: string;
}): ResolvedCalendar {
  const interval: CalendarInterval = sp.interval === "month" ? "month" : "week";
  const today = startOfDay(new Date());
  const todayKey = dateKey(today);
  const anchor = parseAnchor(sp.anchor);

  const mk = (date: Date, anchorMonth?: number): CalendarDay => ({
    key: dateKey(date),
    date,
    inMonth: anchorMonth === undefined ? true : date.getMonth() === anchorMonth,
    isToday: dateKey(date) === todayKey,
  });

  if (interval === "week") {
    const start = mondayOf(anchor);
    const days = Array.from({ length: 7 }, (_, i) => mk(addDays(start, i)));
    const end = addDays(start, 6);
    return {
      interval,
      rangeStart: start,
      rangeEnd: addDays(start, 7),
      days,
      label: `${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`,
      prevAnchorKey: dateKey(addDays(start, -7)),
      nextAnchorKey: dateKey(addDays(start, 7)),
      todayKey,
    };
  }

  // Сар — anchor сарыг бүтэн долоо хоногуудаар бүрхэнэ.
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = mondayOf(first);
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const gridEnd = addDays(mondayOf(lastOfMonth), 7); // сүүлийн долоо хоногийн төгсгөл
  const cellCount = Math.round(
    (gridEnd.getTime() - gridStart.getTime()) / DAY_MS,
  );
  const days = Array.from({ length: cellCount }, (_, i) =>
    mk(addDays(gridStart, i), anchor.getMonth()),
  );
  return {
    interval,
    rangeStart: gridStart,
    rangeEnd: gridEnd,
    days,
    label: `${anchor.getFullYear()} оны ${anchor.getMonth() + 1}-р сар`,
    prevAnchorKey: dateKey(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1)),
    nextAnchorKey: dateKey(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)),
    todayKey,
  };
}
