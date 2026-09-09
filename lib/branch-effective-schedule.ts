import type { Weekday } from "@/lib/branches";
import { bookingDateKey } from "@/lib/booking-time";

export const BUSINESS_TIME_ZONE = "Asia/Ulaanbaatar";

export type EffectiveScheduleSource =
  | "exception"
  | "season"
  | "weekday"
  | "default";

export type ScheduleRule = {
  weekday: Weekday;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
};

export type ScheduleException = {
  date: Date | string;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  label?: string | null;
};

export type ScheduleSeason = {
  startsOn: Date | string;
  endsOn: Date | string;
  isActive: boolean;
  days?: ScheduleRule[];
  name?: string;
};

export type EffectiveSchedule = {
  date: string;
  weekday: Weekday;
  open: boolean;
  openTime: string | null;
  closeTime: string | null;
  source: EffectiveScheduleSource;
  label: string | null;
};

const WEEKDAY_BY_INDEX: Weekday[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

function dateKey(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function weekdayForDate(dateStr: string): Weekday {
  const day = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return WEEKDAY_BY_INDEX[day] ?? "MON";
}

/**
 * Resolve one branch's effective opening interval for a business date.
 * This is deliberately Prisma-free so every caller and its tests share the
 * same precedence rules.
 */
export function resolveEffectiveSchedule(input: {
  dateStr: string;
  branch: {
    openTime: string | null;
    closeTime: string | null;
    schedules: ScheduleRule[];
    scheduleExceptions?: ScheduleException[];
    scheduleSeasons?: ScheduleSeason[];
  };
}): EffectiveSchedule {
  const { dateStr, branch } = input;
  const weekday = weekdayForDate(dateStr);
  const base = branch.schedules.find((s) => s.weekday === weekday);
  const fallbackOpen = Boolean(branch.openTime && branch.closeTime);
  const fallback = {
    open: fallbackOpen,
    openTime: branch.openTime,
    closeTime: branch.closeTime,
  };

  const exception = branch.scheduleExceptions?.find(
    (e) => dateKey(e.date) === dateStr,
  );
  if (exception) {
    return {
      date: dateStr,
      weekday,
      open: exception.isOpen,
      openTime: exception.openTime,
      closeTime: exception.closeTime,
      source: "exception",
      label: exception.label ?? null,
    };
  }

  const season = branch.scheduleSeasons?.find(
    (s) =>
      s.isActive &&
      dateStr >= dateKey(s.startsOn) &&
      dateStr < dateKey(s.endsOn),
  );
  const seasonalRule = season?.days?.find((s) => s.weekday === weekday);
  if (season && seasonalRule) {
    return {
      date: dateStr,
      weekday,
      open: seasonalRule.isOpen,
      openTime: seasonalRule.openTime ?? base?.openTime ?? fallback.openTime,
      closeTime: seasonalRule.closeTime ?? base?.closeTime ?? fallback.closeTime,
      source: "season",
      label: season.name ?? null,
    };
  }

  if (base) {
    return {
      date: dateStr,
      weekday,
      open: base.isOpen,
      openTime: base.openTime ?? fallback.openTime,
      closeTime: base.closeTime ?? fallback.closeTime,
      source: "weekday",
      label: null,
    };
  }

  return {
    date: dateStr,
    weekday,
    ...fallback,
    source: "default",
    label: null,
  };
}

/** Resolve the business date key for an instant in the product timezone. */
export function businessDateKey(date: Date = new Date()): string {
  return bookingDateKey(date);
}

export function scheduleDisplayLabel(schedule: EffectiveSchedule): string | null {
  if (schedule.label) return schedule.label;
  if (schedule.source === "season") return "Улирлын хуваарь";
  if (schedule.source === "exception") return "Тусгай өдөр";
  return null;
}
