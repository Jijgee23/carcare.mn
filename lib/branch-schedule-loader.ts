import { prisma } from "@/lib/prisma";
import { bookingDayBounds } from "@/lib/booking-time";
import {
  buildBranchSchedule,
  orderCanCountForCapacity,
  type ScheduleIssue,
  type ScheduleInterval,
} from "@/lib/branch-schedule";
import { splitScheduleInterval } from "@/lib/schedule-intervals";
import { resolveOrderEffectiveInterval } from "@/lib/schedule-order-interval";
import { isPendingAppointmentPaymentExpired } from "@/lib/appointment-payment-status";

/**
 * Loads one branch's real appointment/order rows for a single business-timezone
 * day (Asia/Ulaanbaatar, per lib/booking-time.ts — never the deployment host's
 * clock) and projects them through buildBranchSchedule. Kept in its own module,
 * separate from lib/branch-schedule.ts, because that module is deliberately
 * Prisma-free so its fixture tests (tests/scheduling.test.ts) can run without a
 * DATABASE_URL — importing @/lib/prisma at module scope there broke that.
 *
 * Only active-status rows are normally fetched: appointments still
 * PENDING/CONFIRMED and orders still SCHEDULED/IN_PROGRESS/WAITING_PARTS.
 * Terminal orders (COMPLETED/CANCELLED) are additionally fetched when an
 * active appointment points at them, solely to resolve the relationship and
 * avoid a false "missing order" warning. Terminal rows still carry no
 * capacity interval unless a legacy row explicitly says they occupy one.
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
>[number] & { carriedOver: boolean; continuesIntoDay: boolean };

export type AppointmentOrderRepairCandidate = {
  id: string;
  number: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "WAITING_PARTS";
  scheduledAt: Date | null;
  customerId: string;
  vehicleId: string;
  customer: { fullName: string | null; phone: string | null } | null;
  vehicle: { plate: string; make: string; model: string } | null;
};

export type BranchScheduleAttentionAppointment = {
  appointment: BranchScheduleAppointmentRow;
  reason: "missing-order" | "linked-order-not-occupying";
};

// Тухайн файлд зөвхөн carriedOver/continuesIntoDay тэмдэглэхэд ашиглана;
// buildBranchSchedule-д дамжуулах өгөгдлийг өөрчлөхгүй. Эх логик нь
// lib/schedule-order-interval.ts-д нэгтгэгдсэн (buildBranchSchedule ба
// category-duration.ts-тэй хуваалцана).
function orderEffectiveDate(o: {
  status: string;
  occupiesCapacity: boolean | null;
  scheduledAt: Date | null;
  startedAt: Date | null;
  estimatedDurationMinutes: number | null;
  expectedFinishAt: Date | null;
}): Date | null {
  return resolveOrderEffectiveInterval(o).start;
}

function orderEffectiveEnd(o: {
  status: string;
  occupiesCapacity: boolean | null;
  scheduledAt: Date | null;
  startedAt: Date | null;
  estimatedDurationMinutes: number | null;
  expectedFinishAt: Date | null;
}): Date | null {
  return resolveOrderEffectiveInterval(o).end;
}

const APPOINTMENT_ROW_SELECT = {
  id: true,
  tenantId: true,
  branchId: true,
  status: true,
  requestedAt: true,
  createdAt: true,
  estimatedDurationMinutes: true,
  serviceOrderId: true,
  arrivedAt: true,
  customerId: true,
  vehicleId: true,
  note: true,
  feeAmount: true,
  feeQpayInvoiceId: true,
  feeUnderpaidAmount: true,
  payment: { select: { status: true } },
  account: { select: { name: true, phone: true } },
  customer: { select: { fullName: true, phone: true } },
} as const;

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
    select: APPOINTMENT_ROW_SELECT,
  });
}

function fetchOrderRows(
  scope: { tenantId: string; branchId: string },
  rangeEnd: Date,
  linkedOrderIds: string[] = [],
) {
  return prisma.serviceOrder.findMany({
    where: {
      ...scope,
      OR: [
        {
          status: { in: ["SCHEDULED", "IN_PROGRESS", "WAITING_PARTS"] },
          OR: [{ scheduledAt: { lt: rangeEnd } }, { scheduledAt: null }],
        },
        ...(linkedOrderIds.length > 0 ? [{ id: { in: linkedOrderIds } }] : []),
      ],
    },
    select: {
      id: true,
      number: true,
      tenantId: true,
      branchId: true,
      status: true,
      scheduledAt: true,
      startedAt: true,
      estimatedDurationMinutes: true,
      expectedFinishAt: true,
      occupiesCapacity: true,
      customerId: true,
      vehicleId: true,
      customer: { select: { fullName: true, phone: true } },
      vehicle: { select: { plate: true, make: true, model: true } },
    },
  });
}

function fetchAppointmentOrderRepairCandidates(
  scope: { tenantId: string; branchId: string },
  appointments: Array<{ customerId: string | null; vehicleId: string | null; serviceOrderId: string | null }>,
) {
  const pairs = appointments
    .filter((a) => a.serviceOrderId && a.customerId && a.vehicleId)
    .map((a) => ({ customerId: a.customerId!, vehicleId: a.vehicleId! }));
  const uniquePairs = Array.from(
    new Map(pairs.map((pair) => [`${pair.customerId}:${pair.vehicleId}`, pair])).values(),
  );
  if (uniquePairs.length === 0) return Promise.resolve([] as AppointmentOrderRepairCandidate[]);

  return prisma.serviceOrder.findMany({
    where: {
      ...scope,
      status: { in: ["SCHEDULED", "IN_PROGRESS", "WAITING_PARTS"] },
      appointment: null,
      OR: uniquePairs,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      scheduledAt: true,
      customerId: true,
      vehicleId: true,
      customer: { select: { fullName: true, phone: true } },
      vehicle: { select: { plate: true, make: true, model: true } },
    },
  }).then((rows) =>
    rows.map((row) => ({
      ...row,
      status: row.status as AppointmentOrderRepairCandidate["status"],
    })),
  );
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
  repairCandidates: AppointmentOrderRepairCandidate[];
  rangeStart: Date;
  rangeEnd: Date;
}> {
  const { start: rangeStart, end: rangeEnd } = bookingDayBounds(input.dateStr);
  const scope = { tenantId: input.tenantId, branchId: input.branchId };

  const appointmentRows = await fetchAppointmentRows(scope, rangeStart, rangeEnd);
  const linkedOrderIds = appointmentRows
    .map((appointment) => appointment.serviceOrderId)
    .filter((id): id is string => Boolean(id));
  const rawOrderRows = await fetchOrderRows(scope, rangeEnd, linkedOrderIds);
  const repairCandidates = await fetchAppointmentOrderRepairCandidates(scope, appointmentRows);

  // Бодит эхлэл нь энэ өдрийн цонхноос өмнө бол carriedOver. Харин төгсгөл
  // энэ өдөрт орж ирж байгаа мэдэгдэж буй interval бол хүчинтэй continuation
  // бөгөөд тухайн өдрийн мөрөнд заавал харагдана.
  const orderRows: BranchScheduleOrderRow[] = rawOrderRows.map((o) => {
    const effectiveDate = orderEffectiveDate(o);
    const effectiveEnd = orderEffectiveEnd(o);
    const carriedOver = effectiveDate == null || effectiveDate.getTime() < rangeStart.getTime();
    const continuesIntoDay =
      carriedOver &&
      effectiveDate != null &&
      effectiveEnd != null &&
      splitScheduleInterval(effectiveDate, effectiveEnd).some(
        (segment) => segment.dateStr === input.dateStr && segment.startsBeforeDay,
      );
    return {
      ...o,
      carriedOver,
      continuesIntoDay,
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

  return {
    intervals,
    issues,
    appointments: appointmentRows,
    orders: orderRows,
    repairCandidates,
    rangeStart,
    rangeEnd,
  };
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
    continuesIntoDay: false,
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

/**
 * PENDING appointments whose booking fee has gone unpaid past
 * PENDING_APPOINTMENT_PAYMENT_TTL_MINUTES, plus active appointments whose
 * linked order is missing or no longer contributes capacity. These are kept
 * separate from uncertain/overdue order occupancy because they are appointment
 * or relationship housekeeping rather than a stuck order interval.
 */
export async function loadBranchAttentionAppointments(input: {
  tenantId: string;
  branchId: string;
  now?: Date;
}): Promise<{
  appointments: BranchScheduleAppointmentRow[];
  inconsistentAppointments: BranchScheduleAttentionAppointment[];
}> {
  const now = input.now ?? new Date();
  const [expiredRows, linkedRows] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        status: "PENDING",
        feeAmount: { not: null },
      },
      select: APPOINTMENT_ROW_SELECT,
    }),
    prisma.appointment.findMany({
      where: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        status: { in: ["PENDING", "CONFIRMED"] },
        serviceOrderId: { not: null },
      },
      select: {
        ...APPOINTMENT_ROW_SELECT,
        serviceOrder: {
          select: {
            tenantId: true,
            branchId: true,
            status: true,
            occupiesCapacity: true,
          },
        },
      },
    }),
  ]);
  const appointments = expiredRows.filter((a) => isPendingAppointmentPaymentExpired(a, now));
  const expiredIds = new Set(appointments.map((a) => a.id));
  const linkedOrderContributesCapacity = (order: {
    tenantId: string;
    branchId: string;
    status: string;
    occupiesCapacity: boolean | null;
  } | null) => {
    if (!order) return false;
    return (
      order.tenantId === input.tenantId &&
      order.branchId === input.branchId &&
      orderCanCountForCapacity(order as Parameters<typeof orderCanCountForCapacity>[0])
    );
  };
  const linkedOrderMatchesScope = (order: {
    tenantId: string;
    branchId: string;
  } | null) =>
    Boolean(
      order &&
      order.tenantId === input.tenantId &&
      order.branchId === input.branchId,
    );
  const inconsistentAppointments = linkedRows
    .filter(
      (row) =>
        !expiredIds.has(row.id) &&
        !linkedOrderContributesCapacity(row.serviceOrder),
    )
    .map((row) => ({
      appointment: row,
      reason: row.serviceOrder && linkedOrderMatchesScope(row.serviceOrder)
        ? ("linked-order-not-occupying" as const)
        : ("missing-order" as const),
    }));
  return { appointments, inconsistentAppointments };
}
