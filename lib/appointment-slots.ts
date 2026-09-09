import type { Weekday } from "@/lib/branches";
import { peakOccupancy } from "@/lib/schedule-capacity";
import { bookingDateKey, bookingDayBounds, bookingSlotTime } from "@/lib/booking-time";

// Salбарын slot тохиргооны анхдагч (Branch.slotMinutes/slotCapacity null үед).
export const DEFAULT_SLOT_MINUTES = 30;
export const DEFAULT_SLOT_CAPACITY = 1;

const JS_DAY_TO_WEEKDAY: Weekday[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

export type DaySlot = {
  time: string; // "HH:MM" эхлэх цаг
  iso: string; // requestedAt-д хадгалах ISO timestamp
  available: boolean; // сонгох боломжтой эсэх (ирээдүйд + сул)
  remaining: number; // үлдсэн багтаамж
};

/**
 * Аль хэдийн авсан (PENDING/CONFIRMED) захиалгын ЖИНХЭНЭ эзэлж буй хугацаа —
 * зөвхөн эхлэх цаг (`start`) төдийгүй түүний өөрийнх нь нийт үргэлжлэх
 * хугацаа (сонгосон ангиллуудын нийлбэр, эсвэл ангилалгүй бол slot-ийн
 * анхдагч урт). Overlap-based шалгалтад ашиглана — өмнө нь зөвхөн `start`
 * цэг тухайн slot-ийн НАРИЙН цонхонд (`[slotStart, slotStart+slotMinutes)`)
 * унасан эсэхийг шалгадаг байсан тул урт хугацаатай захиалга (ж: 120 мин)
 * зөвхөн өөрийн эхлэх slot-т "эзэлсэн" гэж тооцогдож, дараагийн slot-ууд
 * (12:30, 13:00, ...) хоосон мэт харагддаг байсан — давхар захиалгын цоорхой.
 */
export type TakenInterval = {
  start: Date;
  durationMinutes: number;
};

export type DayAvailability = {
  open: boolean;
  reason?: string;
  slots: DaySlot[];
  scheduleSource?: "exception" | "season" | "weekday" | "default";
  scheduleLabel?: string | null;
};

export function weekdayFromDate(d: Date): Weekday {
  return JS_DAY_TO_WEEKDAY[new Date(`${bookingDateKey(d)}T12:00:00Z`).getUTCDay()];
}

function timeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function minutesToTime(m: number): string {
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/**
 * Нэг өдрийн цагийн нүхнүүдийг (slot) тооцоолно — pure. Ажиллах цаг,
 * нүхний урт, багтаамж, аль хэдийн авсан цагуудаас сул/завгүйг гаргана.
 */
export function buildDaySlots(opts: {
  dateStr: string; // YYYY-MM-DD
  open: boolean;
  openTime: string | null;
  closeTime: string | null;
  slotMinutes: number;
  capacity: number;
  // Тухайн өдрийн PENDING/CONFIRMED захиалгуудын ЭЗЭЛЖ буй хугацааны
  // интервал (эхлэх цаг + өөрийнх нь үргэлжлэх хугацаа) — зөвхөн эхлэх цэг биш.
  taken: TakenInterval[];
  now: Date;
  // Захиалгын нийт үргэлжлэх хугацаа (booking v2 — сонгосон ангилалуудын нийлбэр).
  // Slot-ийн АЛХАМ нь slotMinutes хэвээр; энэ нь "хаах цагт багтах уу" хилд
  // болон overlap шалгалтад (энэ шинэ захиалга хэр удаан "эзэлэх") ашиглана.
  // null/0 бол slotMinutes-тэй тэнцүү (хуучин зан төлөв).
  appointmentMinutes?: number;
}): DayAvailability {
  if (!opts.open) return { open: false, reason: "Энэ өдөр амарна.", slots: [] };

  const openMin = timeToMinutes(opts.openTime);
  const closeMin = timeToMinutes(opts.closeTime);
  if (openMin == null || closeMin == null || closeMin <= openMin) {
    return { open: false, reason: "Ажиллах цаг тодорхойлогдоогүй.", slots: [] };
  }

  try { bookingDayBounds(opts.dateStr); } catch {
    return { open: false, reason: "Буруу өдөр.", slots: [] };
  }
  const slotMin = opts.slotMinutes > 0 ? opts.slotMinutes : DEFAULT_SLOT_MINUTES;
  const cap = opts.capacity > 0 ? opts.capacity : DEFAULT_SLOT_CAPACITY;
  // Захиалга багтах ёстой урт — хаах цагийн хилд ашиглана.
  const apptMin =
    opts.appointmentMinutes && opts.appointmentMinutes > 0
      ? opts.appointmentMinutes
      : slotMin;
  const takenIntervals = opts.taken.map((t) => ({
    startMs: t.start.getTime(),
    endMs: t.start.getTime() + t.durationMinutes * 60000,
  }));
  const nowMs = opts.now.getTime();

  const slots: DaySlot[] = [];
  for (let start = openMin; start + apptMin <= closeMin; start += slotMin) {
    const slotStart = bookingSlotTime(opts.dateStr, start);
    const startMs = slotStart.getTime();
    // Энэ slot-т шинэ захиалга байршвал ЭЗЭЛЭХ хугацаа (`apptMin`) — зөвхөн
    // slot-ийн алхам (`slotMin`) биш. Аль хэдийн авсан захиалгуудын жинхэнэ
    // интервалтай ЯМАРЧ давхцал (overlap) байвал багтаамжаас хасна.
    const endMs = startMs + apptMin * 60000;
    const count = peakOccupancy(takenIntervals, startMs, endMs);
    const remaining = Math.max(0, cap - count);
    slots.push({
      time: minutesToTime(start),
      iso: slotStart.toISOString(),
      available: startMs > nowMs && remaining > 0,
      remaining,
    });
  }
  return { open: true, slots };
}

// `isSlotAvailable` (booking-цагийн давхцал шалгах) нь `lib/category-duration.ts`
// руу нүүсэн — тэнд аль хэдийн байгаа `resolveBranchCategoryDurations`-ыг
// ашиглаж эрт эхэлсэн урт захиалгуудын ЖИНХЭНЭ хугацааг шийднэ (энэ файлаас
// тийш импортлож циклик импорт үүсгэхээс зайлсхийв).
