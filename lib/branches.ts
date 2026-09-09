import { bookingDateKey } from "@/lib/booking-time";
import { resolveEffectiveSchedule, type ScheduleException, type ScheduleSeason } from "@/lib/branch-effective-schedule";

export type Weekday = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

// UI-д харуулах дараалал — Даваагаас Ням.
export const WEEK_DAYS: ReadonlyArray<{
  value: Weekday;
  short: string;
  long: string;
}> = [
  { value: "MON", short: "Дав", long: "Даваа" },
  { value: "TUE", short: "Мяг", long: "Мягмар" },
  { value: "WED", short: "Лха", long: "Лхагва" },
  { value: "THU", short: "Пүр", long: "Пүрэв" },
  { value: "FRI", short: "Баа", long: "Баасан" },
  { value: "SAT", short: "Бям", long: "Бямба" },
  { value: "SUN", short: "Ням", long: "Ням" },
];

export const ALL_WEEKDAYS: Weekday[] = WEEK_DAYS.map((d) => d.value);

export const DEFAULT_OPEN_DAYS: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI"];

export function isWeekday(v: unknown): v is Weekday {
  return (
    typeof v === "string" &&
    (v === "SUN" ||
      v === "MON" ||
      v === "TUE" ||
      v === "WED" ||
      v === "THU" ||
      v === "FRI" ||
      v === "SAT")
  );
}

export function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** "HH:MM" эсвэл хоосон бол null. */
export function parseTime(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  return isValidTime(t) ? t : null;
}

type ScheduleLike = {
  weekday: Weekday;
  isOpen: boolean;
};

/** BranchSchedule-ийн жагсаалтаас нээлттэй өдрүүдийг "Дав, Мяг, Лха" гэх мэтээр. */
export function formatWorkDays(
  schedules: ScheduleLike[] | null | undefined,
): string {
  if (!schedules || schedules.length === 0) return "—";
  const open = new Set(
    schedules.filter((s) => s.isOpen).map((s) => s.weekday),
  );
  if (open.size === 0) return "—";
  return WEEK_DAYS.filter((d) => open.has(d.value))
    .map((d) => d.short)
    .join(", ");
}

/**
 * Салбарын ажилладаг гарагуудыг тооцоолно. BranchSchedule бичлэг байвал isOpen,
 * үгүй бол салбарын default нээх/хаах цаг тохируулсан эсэхээр.
 * (Booking календарын disabled гарагтай нийцнэ.)
 */
export function openWeekdaysOf(b: {
  openTime: string | null;
  closeTime: string | null;
  schedules: { weekday: string; isOpen: boolean }[];
}): Weekday[] {
  const hasDefault = Boolean(b.openTime && b.closeTime);
  return ALL_WEEKDAYS.filter((w) => {
    const s = b.schedules.find((x) => x.weekday === w);
    return s ? s.isOpen : hasDefault;
  });
}

/** Салбар Бямба/Ням аль нэгэнд ажилладаг эсэх ("Амралтын өдөр ажилладаг" шүүлт). */
export function worksWeekends(b: {
  openTime: string | null;
  closeTime: string | null;
  schedules: { weekday: string; isOpen: boolean }[];
}): boolean {
  const days = openWeekdaysOf(b);
  return days.includes("SAT") || days.includes("SUN");
}

export function formatWorkHoursSummary(b: {
  openTime: string | null;
  closeTime: string | null;
  schedules: { isOpen: boolean; openTime?: string | null; closeTime?: string | null }[];
}): string {
  const hours = new Set<string>();
  for (const schedule of b.schedules) {
    if (!schedule.isOpen) continue;
    const open = schedule.openTime ?? b.openTime;
    const close = schedule.closeTime ?? b.closeTime;
    if (open && close) hours.add(`${open}–${close}`);
  }
  if (hours.size === 0 && b.openTime && b.closeTime) return `${b.openTime}–${b.closeTime}`;
  if (hours.size === 1) return [...hours][0];
  if (hours.size > 1) return "Өдөр бүр өөр";
  return "—";
}

/** Whether the next Saturday or Sunday has effective open hours. */
export function worksEffectiveWeekends(
  b: BranchScheduleDisplay,
  reference: Date = new Date(),
): boolean {
  const todayKey = bookingDateKey(reference);
  const base = new Date(`${todayKey}T12:00:00Z`);
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(base.getTime() + offset * 86400000);
    const day = candidate.getUTCDay();
    if ((day === 0 || day === 6) && branchHoursForDate(b, candidate)) return true;
  }
  return false;
}

// "HH:MM" → минут (өдрийн эхнээс). Буруу бол null.
export function timeToMinutes(t: string | null | undefined): number | null {
  if (!t || !isValidTime(t)) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

type SchedDetail = {
  weekday: Weekday;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
};

type BranchScheduleDisplay = {
  openTime: string | null;
  closeTime: string | null;
  schedules: SchedDetail[];
  scheduleExceptions?: ScheduleException[];
  scheduleSeasons?: ScheduleSeason[];
};

/**
 * Салбар яг ОДОО (Монголын цагаар) нээлттэй эсэх + өнөөдрийн ажиллах цаг.
 * Тухайн гарагийн BranchSchedule байвал түүний цагийг, эс бөгөөс салбарын
 * default open/close-г ашиглана. Хагас шөнө дамнасан цагийг (close < open)
 * энгийнээр хаалттай гэж үзнэ.
 */
export function branchStatusNow(
  b: BranchScheduleDisplay,
  now: Date = new Date(),
): { open: boolean; hours: string | null } {
  let curMin: number;
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ulaanbaatar",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(now)
        .map((p) => [p.type, p.value]),
    );
    curMin = Number(parts.hour) * 60 + Number(parts.minute);
  } catch {
    return { open: false, hours: null };
  }

  const effective = resolveEffectiveSchedule({ dateStr: bookingDateKey(now), branch: b });
  if (!effective.open) return { open: false, hours: null };
  const openT = effective.openTime;
  const closeT = effective.closeTime;
  const o = timeToMinutes(openT);
  const c = timeToMinutes(closeT);
  if (o == null || c == null || c <= o) {
    // Цаг тодорхойгүй ч нээлттэй өдөр — цаггүйгээр "нээлттэй" гэж үзнэ.
    return { open: true, hours: openT && closeT ? `${openT}–${closeT}` : null };
  }
  return { open: curMin >= o && curMin < c, hours: `${openT}–${closeT}` };
}

/**
 * Тухайн (дурын, "одоо" биш) огнооны ажиллах цагийг минутаар өгнө — Хуваарийн
 * grid харагдацын цагийн тэнхлэгийг тогтооход ашиглана. `branchStatusNow`-той
 * ижил логик, гагцхүү "одоо" бус, өгөгдсөн огноогоор.
 */
export function branchHoursForDate(
  b: BranchScheduleDisplay,
  date: Date,
): { openMinutes: number; closeMinutes: number } | null {
  const dateStr = bookingDateKey(date);
  const effective = resolveEffectiveSchedule({ dateStr, branch: b });
  if (!effective.open) return null;
  try {
    // Validate the business date before using the resolved times.
    if (bookingDateKey(date) !== dateStr) return null;
  } catch {
    return null;
  }
  const o = timeToMinutes(effective.openTime);
  const c = timeToMinutes(effective.closeTime);
  if (o == null || c == null || c <= o) return null;
  return { openMinutes: o, closeMinutes: c };
}

/** Хаягийг "Хот, Дүүрэг, Хороо, Гудамж" нэг мөрөнд. */
export function formatAddress(b: {
  city?: string | null;
  district?: string | null;
  khoroo?: string | null;
  address?: string | null;
}): string {
  const parts = [b.city, b.district, b.khoroo, b.address]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  return parts.length > 0 ? parts.join(", ") : "—";
}
