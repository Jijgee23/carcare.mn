import type { CapacityInterval } from "@/lib/schedule-capacity";
import { isValidScheduleInterval } from "@/lib/schedule-intervals";
import { resolveOrderEffectiveInterval } from "@/lib/schedule-order-interval";
import { isPendingAppointmentPaymentExpired } from "@/lib/appointment-payment-status";

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
  status: "SCHEDULED" | "IN_PROGRESS" | "WAITING_PARTS" | "COMPLETED" | "CANCELLED";
  scheduledAt: Date | null;
  startedAt: Date | null;
  estimatedDurationMinutes: number | null;
  expectedFinishAt: Date | null;
  occupiesCapacity: boolean | null;
};
export type ScheduleIssue = {
  source: "appointment" | "order";
  id: string;
  reason: "missing-estimate" | "unknown-occupancy" | "overdue" | "missing-order" | "missing-start" | "invalid-interval" | "payment-expired";
};
export type ScheduleInterval = CapacityInterval & {
  source: "appointment" | "order";
  id: string;
  uncertain: boolean;
};

function minutes(value: number | null): number | null {
  return value != null && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Pure projection for a single branch. The future DB loader must supply ALL
 * active/occupied orders, including carry-over jobs, plus linked terminal orders.
 * No Prisma dependency: safe to develop/test before the shared DB migration.
 * Unknown/expired forecasts conservatively occupy the rest of the requested
 * horizon; callers must display issues and obtain a staff estimate to release it.
 */
export function buildBranchSchedule(input: Scope & {
  appointments: readonly ScheduleAppointment[];
  orders: readonly ScheduleOrder[];
  now: Date;
  rangeStart: Date;
  rangeEnd: Date;
}): { intervals: ScheduleInterval[]; issues: ScheduleIssue[] } {
  const now = input.now.getTime();
  const lower = input.rangeStart.getTime();
  const upper = input.rangeEnd.getTime();
  if (![now, lower, upper].every(Number.isFinite) || upper <= lower) {
    throw new RangeError("Invalid schedule horizon");
  }
  const inScope = (row: Scope) => row.tenantId === input.tenantId && row.branchId === input.branchId;
  const orders = new Map(input.orders.filter(inScope).map((order) => [order.id, order]));
  const intervals: ScheduleInterval[] = [];
  const issues: ScheduleIssue[] = [];
  const issue = (source: ScheduleIssue["source"], id: string, reason: ScheduleIssue["reason"]) => {
    issues.push({ source, id, reason });
  };
  const add = (source: ScheduleIssue["source"], id: string, start: number, end: number, uncertain: boolean) => {
    const startMs = Math.max(lower, start);
    const endMs = Math.min(upper, end);
    if (startMs < endMs) intervals.push({ source, id, startMs, endMs, uncertain });
  };

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
    if (a.serviceOrderId && orders.has(a.serviceOrderId)) continue;
    if (a.serviceOrderId) issue("appointment", a.id, "missing-order");
    const duration = minutes(a.estimatedDurationMinutes);
    const start = a.requestedAt.getTime();
    if (!Number.isFinite(start)) throw new RangeError("Invalid appointment start");
    if (start >= upper) continue;
    if (duration == null) issue("appointment", a.id, "missing-estimate");
    const end = duration == null ? null : new Date(start + duration * 60000);
    if (end && !isValidScheduleInterval(new Date(start), end)) {
      issue("appointment", a.id, "invalid-interval");
      continue;
    }
    add("appointment", a.id, start, duration == null ? upper : end!.getTime(), duration == null);
  }

  for (const order of orders.values()) {
    const terminal = order.status === "COMPLETED" || order.status === "CANCELLED";
    // Terminal legacy orders have no positive evidence of remaining occupancy.
    if (terminal && order.occupiesCapacity !== true) continue;
    if (order.status !== "SCHEDULED" && order.occupiesCapacity === false) continue;
    const resolved = resolveOrderEffectiveInterval(order);
    const scheduled = resolved.scheduled;
    const date = resolved.start;
    const start = date?.getTime() ?? now;
    if (!Number.isFinite(start)) throw new RangeError("Invalid order start");
    if (start >= upper) continue;
    if (!date) issue("order", order.id, "missing-start");
    if (resolved.invalid) {
      issue("order", order.id, "invalid-interval");
      continue;
    }
    let end = resolved.end?.getTime() ?? null;
    if (end != null && !Number.isFinite(end)) throw new RangeError("Invalid finish estimate");
    const unknownOccupancy = !scheduled && order.occupiesCapacity == null;
    if (unknownOccupancy) issue("order", order.id, "unknown-occupancy");
    if (end == null) issue("order", order.id, "missing-estimate");
    const overdue = end != null && end <= now && !scheduled;
    if (overdue) issue("order", order.id, "overdue");
    const uncertain = !date || unknownOccupancy || end == null || overdue;
    if (uncertain) end = upper;
    add("order", order.id, start, end!, uncertain);
  }
  return { intervals, issues };
}
