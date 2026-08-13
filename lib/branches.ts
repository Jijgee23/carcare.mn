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

// "HH:MM" → минут (өдрийн эхнээс). Буруу бол null.
function timeToMinutes(t: string | null | undefined): number | null {
  if (!t || !isValidTime(t)) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const EN_TO_WEEKDAY: Record<string, Weekday> = {
  Sun: "SUN",
  Mon: "MON",
  Tue: "TUE",
  Wed: "WED",
  Thu: "THU",
  Fri: "FRI",
  Sat: "SAT",
};

type SchedDetail = {
  weekday: Weekday;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
};

/**
 * Салбар яг ОДОО (Монголын цагаар) нээлттэй эсэх + өнөөдрийн ажиллах цаг.
 * Тухайн гарагийн BranchSchedule байвал түүний цагийг, эс бөгөөс салбарын
 * default open/close-г ашиглана. Хагас шөнө дамнасан цагийг (close < open)
 * энгийнээр хаалттай гэж үзнэ.
 */
export function branchStatusNow(
  b: {
    openTime: string | null;
    closeTime: string | null;
    schedules: SchedDetail[];
  },
  now: Date = new Date(),
): { open: boolean; hours: string | null } {
  let weekday: Weekday;
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
    weekday = EN_TO_WEEKDAY[parts.weekday as string] ?? "MON";
    curMin = Number(parts.hour) * 60 + Number(parts.minute);
  } catch {
    return { open: false, hours: null };
  }

  const sched = b.schedules.find((s) => s.weekday === weekday);
  const isOpenDay = sched ? sched.isOpen : Boolean(b.openTime && b.closeTime);
  if (!isOpenDay) return { open: false, hours: null };

  const openT = (sched?.openTime ?? null) || b.openTime;
  const closeT = (sched?.closeTime ?? null) || b.closeTime;
  const o = timeToMinutes(openT);
  const c = timeToMinutes(closeT);
  if (o == null || c == null || c <= o) {
    // Цаг тодорхойгүй ч нээлттэй өдөр — цаггүйгээр "нээлттэй" гэж үзнэ.
    return { open: true, hours: openT && closeT ? `${openT}–${closeT}` : null };
  }
  return { open: curMin >= o && curMin < c, hours: `${openT}–${closeT}` };
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
