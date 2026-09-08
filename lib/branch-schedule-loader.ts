import { prisma } from "@/lib/prisma";
import { bookingDayBounds } from "@/lib/booking-time";
import {
  buildBranchSchedule,
  type ScheduleIssue,
  type ScheduleInterval,
} from "@/lib/branch-schedule";

/**
 * Loads one branch's real appointment/order rows for a single business-timezone
 * day (Asia/Ulaanbaatar, per lib/booking-time.ts — never the deployment host's
 * clock) and projects them through buildBranchSchedule. Kept in its own module,
 * separate from lib/branch-schedule.ts, because that module is deliberately
 * Prisma-free so its fixture tests (tests/scheduling.test.ts) can run without a
 * DATABASE_URL — importing @/lib/prisma at module scope there broke that.
 *
 * Only active-status rows are fetched: appointments still PENDING/CONFIRMED and
 * orders still SCHEDULED/IN_PROGRESS/WAITING_PARTS. Terminal orders
 * (COMPLETED/CANCELLED) always have occupiesCapacity=false as of the
 * status-change actions, so they carry no remaining occupancy signal and are
 * deliberately excluded rather than fetched and filtered client-side.
 *
 * Appointments are floored at `rangeStart` (no carry-over from earlier days) —
 * unlike an order, an appointment has no "still in progress" concept, so a
 * long-stale PENDING/CONFIRMED appointment from months ago must never appear
 * on today's schedule; buildBranchSchedule would otherwise clamp its
 * out-of-range start into today and render a phantom midnight-to-midnight
 * entry (found live: several such stale rows, June/July requestedAt values,
 * all showing as "00:00–00:00" on the day view — this floor is the fix).
 * Orders deliberately keep no lower bound: a still-open job that started
 * before today legitimately keeps occupying capacity today (see
 * buildBranchSchedule's "carry-over active job from yesterday" case) — the
 * overdue/uncertain flags exist precisely to surface a job that's been open
 * unrealistically long, not to hide it.
 */
export type BranchScheduleAppointmentRow = Awaited<
  ReturnType<typeof fetchAppointmentRows>
>[number];
export type BranchScheduleOrderRow = Awaited<
  ReturnType<typeof fetchOrderRows>
>[number] & { carriedOver: boolean };

// buildBranchSchedule-ийн "scheduled"/"date" логиктой яг адил — захиалгын бодит
// (clamp хийгдээгүй) огноог тодорхойлно. Зөвхөн энэ файлд carriedOver
// тэмдэглэхэд ашиглана, buildBranchSchedule-д дамжуулах өгөгдлийг өөрчлөхгүй.
function orderEffectiveDate(o: {
  status: string;
  occupiesCapacity: boolean | null;
  scheduledAt: Date | null;
  startedAt: Date | null;
}): Date | null {
  const scheduled = o.status === "SCHEDULED" && o.occupiesCapacity !== true;
  return scheduled ? o.scheduledAt : o.startedAt;
}

function fetchAppointmentRows(
  scope: { tenantId: string; branchId: string },
  rangeStart: Date,
  rangeEnd: Date,
) {
  return prisma.appointment.findMany({
    where: {
      ...scope,
      status: { in: ["PENDING", "CONFIRMED"] },
      requestedAt: { gte: rangeStart, lt: rangeEnd },
    },
    select: {
      id: true,
      tenantId: true,
      branchId: true,
      status: true,
      requestedAt: true,
      estimatedDurationMinutes: true,
      serviceOrderId: true,
      arrivedAt: true,
      customerId: true,
      vehicleId: true,
      note: true,
      account: { select: { name: true, phone: true } },
      customer: { select: { fullName: true, phone: true } },
    },
  });
}

function fetchOrderRows(scope: { tenantId: string; branchId: string }, rangeEnd: Date) {
  return prisma.serviceOrder.findMany({
    where: {
      ...scope,
      status: { in: ["SCHEDULED", "IN_PROGRESS", "WAITING_PARTS"] },
      OR: [{ scheduledAt: { lt: rangeEnd } }, { scheduledAt: null }],
    },
    select: {
      id: true,
      tenantId: true,
      branchId: true,
      status: true,
      scheduledAt: true,
      startedAt: true,
      estimatedDurationMinutes: true,
      expectedFinishAt: true,
      occupiesCapacity: true,
      customer: { select: { fullName: true, phone: true } },
      vehicle: { select: { plate: true, make: true, model: true } },
    },
  });
}

export async function loadBranchSchedule(input: {
  tenantId: string;
  branchId: string;
  dateStr: string; // YYYY-MM-DD, business timezone
  now?: Date;
}): Promise<{
  intervals: ScheduleInterval[];
  issues: ScheduleIssue[];
  appointments: BranchScheduleAppointmentRow[];
  orders: BranchScheduleOrderRow[];
}> {
  const { start: rangeStart, end: rangeEnd } = bookingDayBounds(input.dateStr);
  const scope = { tenantId: input.tenantId, branchId: input.branchId };

  const [appointmentRows, rawOrderRows] = await Promise.all([
    fetchAppointmentRows(scope, rangeStart, rangeEnd),
    fetchOrderRows(scope, rangeEnd),
  ]);

  // Захиалгын бодит огноо энэ өдрийн цонхноос өмнө байвал "carried over" —
  // өөр өдрөөс тасралтгүй үргэлжилж буй хуучин ажил бөгөөд өдөр бүрт давтагдан
  // харагдахгүйн тулд (D-хугацааны шинэ шийдвэр — COWORK.md-г үз) өдрийн
  // жагсаалтад биш, харин branch-даяар "Анхаарал шаардлагатай" харагдацад
  // харуулна. buildBranchSchedule өөрөө үүнийг мэдэхгүй (clamp хийж тооцоолол
  // үргэлжлүүлнэ) — зөвхөн харуулах эсэхийг шийдэхэд ашиглана.
  const orderRows: BranchScheduleOrderRow[] = rawOrderRows.map((o) => {
    const effectiveDate = orderEffectiveDate(o);
    return {
      ...o,
      carriedOver: effectiveDate == null || effectiveDate.getTime() < rangeStart.getTime(),
    };
  });

  const { intervals, issues } = buildBranchSchedule({
    ...scope,
    appointments: appointmentRows,
    orders: orderRows,
    now: input.now ?? new Date(),
    rangeStart,
    rangeEnd,
  });

  return { intervals, issues, appointments: appointmentRows, orders: orderRows };
}

/**
 * All currently uncertain/overdue order occupancy for a branch, regardless of
 * date — the flip side of loadBranchSchedule's per-day view excluding
 * carried-over orders. A stuck order (no estimate, unknown occupancy,
 * overdue) would otherwise repeat identically on every single day paged
 * through from its stale start date onward; this gives it one dedicated,
 * date-independent place instead. Computed by running buildBranchSchedule
 * over a deliberately enormous window (so nothing gets clamped as if it were
 * "carried over" — every order's real date is used as-is) and keeping only
 * the intervals it marks `uncertain`. Orders-only: appointments are already
 * floored to their own day in loadBranchSchedule and have no equivalent
 * indefinite-carry-over failure mode.
 */
export async function loadBranchAttentionOrders(input: {
  tenantId: string;
  branchId: string;
  now?: Date;
}): Promise<{
  intervals: ScheduleInterval[];
  issues: ScheduleIssue[];
  orders: BranchScheduleOrderRow[];
}> {
  const now = input.now ?? new Date();
  const scope = { tenantId: input.tenantId, branchId: input.branchId };
  const rangeStart = new Date(0);
  const rangeEnd = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);

  const rawOrderRows = await fetchOrderRows(scope, rangeEnd);
  const orderRows: BranchScheduleOrderRow[] = rawOrderRows.map((o) => ({
    ...o,
    carriedOver: false, // энд утга алга — attention харагдац өөрөө date-агнаст
  }));

  const { intervals, issues } = buildBranchSchedule({
    ...scope,
    appointments: [],
    orders: orderRows,
    now,
    rangeStart,
    rangeEnd,
  });

  const uncertainIds = new Set(
    intervals.filter((i) => i.uncertain).map((i) => i.id),
  );
  return {
    intervals: intervals.filter((i) => i.uncertain),
    issues: issues.filter((issue) => uncertainIds.has(issue.id)),
    orders: orderRows.filter((o) => uncertainIds.has(o.id)),
  };
}
