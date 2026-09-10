import type { CapacityInterval } from "@/lib/schedule-capacity";
import { isValidScheduleInterval } from "@/lib/schedule-intervals";
import { resolveOrderIntervals, type OrderTimeBookingLike } from "@/lib/schedule-order-interval";
import { isPendingAppointmentPaymentExpired } from "@/lib/appointment-payment-status";
import { DEFAULT_SLOT_MINUTES } from "@/lib/appointment-slots";

type Scope = { tenantId: string; branchId: string };
export type ScheduleAppointment = Scope & {
  id: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "NO_SHOW";
  requestedAt: Date;
  estimatedDurationMinutes: number | null;
  serviceOrderId: string | null;
  // Optional: only present once the loader selects them. Missing fields are
  // treated as "no fee required" — never expired — so older fixtures/tests
  // that omit these keep their existing behavior.
  feeAmount?: unknown;
  feeUnderpaidAmount?: unknown;
  payment?: { status: string } | null;
  createdAt?: Date;
};
export type ScheduleOrder = Scope & {
  id: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "POSTPONED" | "COMPLETED" | "CANCELLED";
  scheduledAt: Date | null;
  startedAt: Date | null;
  estimatedDurationMinutes: number | null;
  expectedFinishAt: Date | null;
  occupiesCapacity: boolean | null;
};
export type ScheduleIssue = {
  source: "appointment" | "order";
  id: string;
  reason:
    | "missing-estimate"
    | "unknown-occupancy"
    | "overdue"
    | "missing-order"
    | "linked-order-not-occupying"
    | "missing-start"
    | "invalid-interval"
    | "payment-expired";
};
export type ScheduleInterval = CapacityInterval & {
  source: "appointment" | "order";
  id: string;
  uncertain: boolean;
  // D-076: "upcoming" marks a follow-up reservation — a second, independent
  // interval for the same order, alongside (not instead of) its "primary"
  // current occupancy/reservation. Always "primary" for appointments, which
  // have no multi-booking concept.
  role: "primary" | "upcoming";
};

function minutes(value: number | null): number | null {
  return value != null && Number.isInteger(value) && value > 0 ? value : null;
}

/** Whether an order's status/occupancy state is eligible to reserve capacity. */
export function orderCanCountForCapacity(
  order: Pick<ScheduleOrder, "status" | "occupiesCapacity">,
): boolean {
  const terminal = order.status === "COMPLETED" || order.status === "CANCELLED";
  if (terminal && order.occupiesCapacity !== true) return false;
  if (order.status !== "SCHEDULED" && order.occupiesCapacity === false) return false;
  return true;
}

/**
 * Pure projection for a single branch. The future DB loader must supply ALL
 * active/occupied orders, including carry-over jobs, plus linked terminal orders.
 * No Prisma dependency: safe to develop/test before the shared DB migration.
 * Unknown active forecasts conservatively occupy the rest of the requested
 * horizon. Scheduled rows with a real start use the branch slot as a bounded
 * estimate while still carrying an uncertainty issue.
 */
export function buildBranchSchedule(input: Scope & {
  appointments: readonly ScheduleAppointment[];
  orders: readonly ScheduleOrder[];
  now: Date;
  rangeStart: Date;
  rangeEnd: Date;
  fallbackDurationMinutes?: number;
  // D-068 read-path swap, additive: when the caller has fetched OrderTimeBooking
  // rows, pass them keyed by orderId to resolve intervals from the booking
  // table instead of the ServiceOrder scalars. Omit to keep today's behavior.
  orderBookings?: ReadonlyMap<string, OrderTimeBookingLike[]>;
}): { intervals: ScheduleInterval[]; issues: ScheduleIssue[] } {
  const now = input.now.getTime();
  const lower = input.rangeStart.getTime();
  const upper = input.rangeEnd.getTime();
  if (![now, lower, upper].every(Number.isFinite) || upper <= lower) {
    throw new RangeError("Invalid schedule horizon");
  }
  const inScope = (row: Scope) => row.tenantId === input.tenantId && row.branchId === input.branchId;
  const fallbackDurationMinutes =
    input.fallbackDurationMinutes != null &&
    Number.isInteger(input.fallbackDurationMinutes) &&
    input.fallbackDurationMinutes > 0
      ? input.fallbackDurationMinutes
      : DEFAULT_SLOT_MINUTES;
  const orders = new Map(input.orders.filter(inScope).map((order) => [order.id, order]));
  const intervals: ScheduleInterval[] = [];
  const issues: ScheduleIssue[] = [];
  const issue = (source: ScheduleIssue["source"], id: string, reason: ScheduleIssue["reason"]) => {
    issues.push({ source, id, reason });
  };
  const add = (
    source: ScheduleIssue["source"],
    id: string,
    start: number,
    end: number,
    uncertain: boolean,
    role: "primary" | "upcoming" = "primary",
  ) => {
    const startMs = Math.max(lower, start);
    const endMs = Math.min(upper, end);
    if (startMs < endMs) intervals.push({ source, id, startMs, endMs, uncertain, role });
  };

  // Project orders first so a linked appointment is suppressed only when the
  // linked order actually contributes a visible capacity interval. A terminal
  // or explicitly released linked order must not make its still-active
  // appointment disappear from both the calendar and the conflict context.
  const orderIntervalIds = new Set<string>();
  for (const order of orders.values()) {
    const { current: resolved, upcoming } = resolveOrderIntervals(order, input.orderBookings?.get(order.id));

    // Terminal legacy orders have no positive evidence of remaining
    // occupancy — but that only disqualifies the order's CURRENT interval.
    // A follow-up reservation (D-076) is independent: completing, cancelling,
    // or releasing an order's current phase must not silently hide a still-
    // open follow-up booking, so `upcoming` is projected below regardless of
    // this check.
    if (orderCanCountForCapacity(order)) {
      const scheduled = resolved.scheduled;
      const date = resolved.start;
      const start = date?.getTime() ?? now;
      if (!Number.isFinite(start)) throw new RangeError("Invalid order start");
      if (start < upper) {
        if (!date) issue("order", order.id, "missing-start");
        if (resolved.invalid) {
          issue("order", order.id, "invalid-interval");
        } else {
          let end = resolved.end?.getTime() ?? null;
          if (end != null && !Number.isFinite(end)) throw new RangeError("Invalid finish estimate");
          const unknownOccupancy = !scheduled && order.occupiesCapacity == null;
          if (unknownOccupancy) issue("order", order.id, "unknown-occupancy");
          const missingEstimate = end == null;
          if (missingEstimate) issue("order", order.id, "missing-estimate");
          // A scheduled walk-in has a real start but no reliable duration. Bound
          // its visual/capacity interval to one branch slot while retaining the
          // warning; an order with no scheduled time remains indefinite until
          // staff resolves it.
          if (end == null && scheduled && date) {
            end = start + fallbackDurationMinutes * 60000;
          }
          const overdue = end != null && end <= now && !scheduled;
          if (overdue) issue("order", order.id, "overdue");
          const uncertain = !date || unknownOccupancy || missingEstimate || overdue;
          // Preserve a known finish even after it has passed. Overdue rows stay
          // striped/flagged but must not grow through the end of the day.
          if (uncertain && (end == null || unknownOccupancy)) end = upper;
          const intervalCount = intervals.length;
          add("order", order.id, start, end!, uncertain, "primary");
          if (intervals.length > intervalCount) orderIntervalIds.add(order.id);
        }
      }
    }

    // D-076: project every open follow-up reservation as its own interval,
    // independent of whether the order's current phase counts above. Never
    // "uncertain" in the overdue/unknown-occupancy sense — a future
    // reservation can't be overdue and its occupancy isn't in question, only
    // its duration might be (missing-estimate, bounded the same way a plain
    // scheduled order is).
    for (const up of upcoming) {
      if (up.invalid || !up.start) continue;
      const upStart = up.start.getTime();
      if (!Number.isFinite(upStart) || upStart >= upper) continue;
      let upEnd = up.end?.getTime() ?? null;
      if (upEnd == null) {
        issue("order", order.id, "missing-estimate");
        upEnd = upStart + fallbackDurationMinutes * 60000;
      } else if (!Number.isFinite(upEnd)) {
        continue;
      }
      const intervalCount = intervals.length;
      add("order", order.id, upStart, upEnd, up.end == null, "upcoming");
      if (intervals.length > intervalCount) orderIntervalIds.add(order.id);
    }
  }

  for (const a of input.appointments.filter(inScope)) {
    if (a.status !== "PENDING" && a.status !== "CONFIRMED") continue;
    if (
      a.status === "PENDING" &&
      a.createdAt &&
      isPendingAppointmentPaymentExpired(
        { feeAmount: a.feeAmount, feeUnderpaidAmount: a.feeUnderpaidAmount, payment: a.payment ?? null, createdAt: a.createdAt },
        input.now,
      )
    ) {
      // A dead payment hold is low-priority, stale housekeeping — it belongs
      // in the Attention view (lib/branch-schedule-loader.ts's
      // loadBranchAttentionAppointments), not in the day calendar at all, not
      // even faded. No interval, no "missing-estimate" issue for it either.
      issue("appointment", a.id, "payment-expired");
      continue;
    }
    if (a.serviceOrderId && orderIntervalIds.has(a.serviceOrderId)) continue;
    if (a.serviceOrderId) {
      const linkedOrder = orders.get(a.serviceOrderId);
      // A COMPLETED order, or a POSTPONED order whose bay was explicitly
      // released (setOrderCapacityAction), is an intentional, normal state —
      // not an issue. Appointment status has no terminal "done" state of its
      // own (see AppointmentStatus), so without this the ordinary same-day
      // book → convert → finish path, or the everyday "free the bay while
      // waiting on a part" action, would flag the appointment as if its link
      // were broken. Neither order disappears from the app: both remain
      // fully visible (and filterable) on /dashboard/orders. A CANCELLED
      // (or missing) linked order still needs staff attention, so keep
      // flagging those.
      if (
        linkedOrder?.status === "COMPLETED" ||
        (linkedOrder?.status === "POSTPONED" && linkedOrder.occupiesCapacity === false)
      ) {
        continue;
      }
      issue(
        "appointment",
        a.id,
        linkedOrder ? "linked-order-not-occupying" : "missing-order",
      );
    }
    const duration = minutes(a.estimatedDurationMinutes);
    const start = a.requestedAt.getTime();
    if (!Number.isFinite(start)) throw new RangeError("Invalid appointment start");
    if (start >= upper) continue;
    if (duration == null) issue("appointment", a.id, "missing-estimate");
    const effectiveDuration = duration ?? fallbackDurationMinutes;
    const end = new Date(start + effectiveDuration * 60000);
    if (!isValidScheduleInterval(new Date(start), end)) {
      issue("appointment", a.id, "invalid-interval");
      continue;
    }
    add("appointment", a.id, start, end.getTime(), duration == null);
  }
  return { intervals, issues };
}
