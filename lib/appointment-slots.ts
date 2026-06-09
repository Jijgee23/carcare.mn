import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import type { Weekday } from "@/lib/branches";

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

export type DayAvailability = {
  open: boolean;
  reason?: string;
  slots: DaySlot[];
};

export function weekdayFromDate(d: Date): Weekday {
  return JS_DAY_TO_WEEKDAY[d.getDay()];
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
  taken: Date[]; // тухайн өдрийн PENDING/CONFIRMED цагуудын requestedAt
  now: Date;
}): DayAvailability {
  if (!opts.open) return { open: false, reason: "Энэ өдөр амарна.", slots: [] };

  const openMin = timeToMinutes(opts.openTime);
  const closeMin = timeToMinutes(opts.closeTime);
  if (openMin == null || closeMin == null || closeMin <= openMin) {
    return { open: false, reason: "Ажиллах цаг тодорхойлогдоогүй.", slots: [] };
  }

  const [y, m, d] = opts.dateStr.split("-").map(Number);
  const slotMin = opts.slotMinutes > 0 ? opts.slotMinutes : DEFAULT_SLOT_MINUTES;
  const cap = opts.capacity > 0 ? opts.capacity : DEFAULT_SLOT_CAPACITY;
  const takenMs = opts.taken.map((t) => t.getTime());
  const nowMs = opts.now.getTime();

  const slots: DaySlot[] = [];
  for (let start = openMin; start + slotMin <= closeMin; start += slotMin) {
    const slotStart = new Date(y, m - 1, d, Math.floor(start / 60), start % 60);
    const startMs = slotStart.getTime();
    const endMs = startMs + slotMin * 60000;
    const count = takenMs.filter((ms) => ms >= startMs && ms < endMs).length;
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

type Client = PrismaClient | Prisma.TransactionClient;

/**
 * Сервер тал — тухайн цаг (slot) хараахан дүүрээгүй эсэхийг шалгана
 * (давхар захиалгаас сэргийлнэ).
 */
export async function isSlotAvailable(
  client: Client,
  branchId: string,
  when: Date,
): Promise<boolean> {
  const branch = await client.branch.findUnique({
    where: { id: branchId },
    select: { slotMinutes: true, slotCapacity: true },
  });
  const slotMin = branch?.slotMinutes ?? DEFAULT_SLOT_MINUTES;
  const cap = branch?.slotCapacity ?? DEFAULT_SLOT_CAPACITY;
  const end = new Date(when.getTime() + slotMin * 60000);
  const count = await client.appointment.count({
    where: {
      branchId,
      status: { in: ["PENDING", "CONFIRMED"] },
      requestedAt: { gte: when, lt: end },
    },
  });
  return count < cap;
}
