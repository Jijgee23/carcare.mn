import type { Weekday } from "@/lib/branches";

export type EmployeeShiftSource = "exception" | "weekly" | "default";

export type EmployeeShiftSegment = {
  branchId: string;
  startTime: string | null;
  endTime: string | null;
};

export type EmployeeWeeklyRule = {
  weekday: Weekday;
  isWorking: boolean;
  segments: EmployeeShiftSegment[];
};

export type EmployeeShiftException = {
  date: Date | string;
  isWorking: boolean;
  segments: EmployeeShiftSegment[];
  label?: string | null;
};

export type ResolvedEmployeeDay = {
  date: string;
  weekday: Weekday;
  working: boolean;
  // Нэг өдөр хэд хэдэн салбарт (өөр өөр цагаар) дамжиж ажиллаж болно тул
  // жагсаалт — ажиллахгүй өдөр хоосон массив.
  segments: EmployeeShiftSegment[];
  source: EmployeeShiftSource;
  label: string | null;
};

function dateKey(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/**
 * Ажилтны нэг өдрийн effective хувиарыг шийднэ — Prisma-гүй pure функц,
 * `resolveEffectiveSchedule`-тэй (lib/branch-effective-schedule.ts) ижил
 * загвар. Шатлал (өндрөөс нам руу):
 *   EmployeeScheduleException (тухайн өдөр)
 *     → EmployeeWorkSchedule мөр (тухайн гараг)
 *     → `homeBranchId` дээр байнга ажилладаг гэсэн platform default (1 segment).
 * Override мөр (`weekly`/`exception`) өөрөө өөрийн segment-үүдийг бүрэн
 * эзэмшинэ — homeBranchId рүү буцаж fallback хийхгүй (segment бүр өөрийн
 * салбараа тодорхой зааx ёстой тул).
 */
export function resolveEmployeeDay(input: {
  dateStr: string;
  weekday: Weekday;
  homeBranchId: string | null;
  weeklyRules: EmployeeWeeklyRule[];
  exceptions?: EmployeeShiftException[];
}): ResolvedEmployeeDay {
  const { dateStr, weekday, homeBranchId } = input;

  const exception = input.exceptions?.find((e) => dateKey(e.date) === dateStr);
  if (exception) {
    return {
      date: dateStr,
      weekday,
      working: exception.isWorking,
      segments: exception.isWorking ? exception.segments : [],
      source: "exception",
      label: exception.label ?? null,
    };
  }

  const weekly = input.weeklyRules.find((r) => r.weekday === weekday);
  if (weekly) {
    return {
      date: dateStr,
      weekday,
      working: weekly.isWorking,
      segments: weekly.isWorking ? weekly.segments : [],
      source: "weekly",
      label: null,
    };
  }

  return {
    date: dateStr,
    weekday,
    working: Boolean(homeBranchId),
    segments: homeBranchId ? [{ branchId: homeBranchId, startTime: null, endTime: null }] : [],
    source: "default",
    label: null,
  };
}

export type TimedSegment = {
  branchId: string;
  startMinutes: number | null; // өдрийн эхнээс минутаар; null = хугацаагүй (бүх өдөр)
  endMinutes: number | null;
};

/**
 * Өгөгдсөн `nowMinutes`-д хамаарах segment-ийг сонгоно (нэг өдөр хэд хэдэн
 * салбарт дамжиж болдог тул) — хамгийн СҮҮЛД эхэлсэн (одоо идэвхтэй, эсвэл
 * дараагийнх хараахан эхлээгүй цоорхойд ч сүүлд эхэлсэн нь хариуцна гэж
 * үзнэ) segment-ийг олно; хараахан юу ч эхлээгүй бол хамгийн эрт эхлэх нь.
 */
export function pickActiveSegment<T extends TimedSegment>(
  segments: T[],
  nowMinutes: number,
): T | null {
  if (segments.length === 0) return null;
  const started = segments.filter(
    (s) => s.startMinutes == null || s.startMinutes <= nowMinutes,
  );
  if (started.length > 0) {
    return started.reduce((latest, s) =>
      (s.startMinutes ?? -1) > (latest.startMinutes ?? -1) ? s : latest,
    );
  }
  return segments.reduce((earliest, s) =>
    (s.startMinutes ?? Infinity) < (earliest.startMinutes ?? Infinity) ? s : earliest,
  );
}

/** `dateStr`-ийг агуулсан долоо хоногийн Даваа өдрийг олно (7 хоног Даваа-Ням). */
export function mondayOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0=Ня..6=Бя
  const mondayOffset = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  return d.toISOString().slice(0, 10);
}

/** Даваагаас эхэлсэн 7 өдрийн огнооны key-үүд. */
export function weekDates(mondayStr: string): string[] {
  const d = new Date(`${mondayStr}T12:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => {
    const cur = new Date(d);
    cur.setUTCDate(cur.getUTCDate() + i);
    return cur.toISOString().slice(0, 10);
  });
}

/** `dateStr`-ийг агуулсан сарын 1-ний огноог олно ("YYYY-MM-01"). */
export function firstOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** Тухайн сарын бүх өдрийн (1-нээс сүүлчийнх хүртэл) огнооны key-үүд. */
export function monthDates(firstOfMonthStr: string): string[] {
  const d = new Date(`${firstOfMonthStr}T12:00:00Z`);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const cur = new Date(Date.UTC(year, month, i + 1, 12));
    return cur.toISOString().slice(0, 10);
  });
}

/** Сарын эхлэлийг `delta` сараар шилжүүлнэ (`delta` сөрөг бол урагшаа). */
export function shiftMonth(firstOfMonthStr: string, delta: number): string {
  const d = new Date(`${firstOfMonthStr}T12:00:00Z`);
  const shifted = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1, 12));
  return shifted.toISOString().slice(0, 10);
}
