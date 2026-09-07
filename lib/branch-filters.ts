import type { Weekday } from "@/lib/branches";

// CarCare-ийн бүх салбар Монголд — цагийн бүс тогтмол (UTC+8, DST байхгүй).
export const APP_TIMEZONE = "Asia/Ulaanbaatar";

const WEEKDAYS: Weekday[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Тухайн цагийн бүс дэх "одоо"-г 7 хоногийн өдөр + өдрийн минут болгон гаргана. */
export function nowInZone(
  now: Date = new Date(),
  timeZone: string = APP_TIMEZONE,
): { weekday: Weekday; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = get("weekday").toUpperCase().slice(0, 3); // "MON" гэх мэт
  const weekday = (WEEKDAYS.find((d) => d === wd) ?? "MON") as Weekday;
  // hour "24" зарим орчинд гардаг — 0 болгож хэвийн болгоно.
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return { weekday, minutes: hour * 60 + minute };
}

function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export type BranchHours = {
  openTime: string | null;
  closeTime: string | null;
  schedules: {
    weekday: Weekday;
    isOpen: boolean;
    openTime: string | null;
    closeTime: string | null;
  }[];
};

/**
 * Салбар тухайн агшинд нээлттэй эсэх — pure. Тухайн өдрийн `BranchSchedule` мөр
 * байвал түүнийг баримтална (isOpen + өөрийн/branch-ийн default цаг); мөр
 * байхгүй бол branch-ийн default нээх/хаах цагийг ашиглана. Цаг тодорхойгүй бол
 * "нээлттэй" гэж баталгаажуулах боломжгүй тул false.
 */
export function isBranchOpenAt(
  branch: BranchHours,
  weekday: Weekday,
  minutes: number,
): boolean {
  const sched = branch.schedules.find((s) => s.weekday === weekday);
  let openStr: string | null;
  let closeStr: string | null;
  if (sched) {
    if (!sched.isOpen) return false;
    openStr = sched.openTime ?? branch.openTime;
    closeStr = sched.closeTime ?? branch.closeTime;
  } else {
    openStr = branch.openTime;
    closeStr = branch.closeTime;
  }
  const open = timeToMinutes(openStr);
  const close = timeToMinutes(closeStr);
  if (open == null || close == null || close <= open) return false;
  return minutes >= open && minutes < close;
}

/** Хоёр координатын хоорондох зай (км) — haversine. */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
