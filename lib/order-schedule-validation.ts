// Extracted from app/_actions/orders.ts (S12 follow-up) so the dedicated
// postpone API endpoint (lib/order-postpone.ts) can share the exact same
// business-hours and schedule-conflict checks used by the existing
// create/update/postpone/resume flows in that file, instead of duplicating
// them. Pure validation helpers — no writes, no "use server" boundary.

import { customerLabel } from "@/lib/customers";
import { isPendingAppointmentPaymentExpired } from "@/lib/appointment-payment-status";
import { MAX_CATEGORY_DURATION_MINUTES } from "@/lib/category-duration";
import { DEFAULT_SLOT_MINUTES } from "@/lib/appointment-slots";
import { bookingDateKey, bookingDayBounds } from "@/lib/booking-time";
import { resolveEffectiveSchedule } from "@/lib/branch-effective-schedule";
import { branchScheduleForDateSelect } from "@/lib/branch-effective-schedule-server";
import { timeToMinutes } from "@/lib/branches";
import { prisma } from "@/lib/prisma";
import { resolveOrderIntervals, type OrderTimeBookingLike } from "@/lib/schedule-order-interval";

export type ScheduleConflict = {
  label: string;
  certainty: "definite" | "possible";
};

export async function validateScheduledOrderHours(
  tenantId: string,
  branchId: string,
  scheduledAt: Date | null,
  durationMinutes: number,
): Promise<string | null> {
  if (!scheduledAt) return null;
  if (!Number.isFinite(scheduledAt.getTime())) return "Товлосон огноо буруу.";
  const dateStr = bookingDateKey(scheduledAt);
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId, isActive: true },
    select: { ...branchScheduleForDateSelect(dateStr) },
  });
  if (!branch) return "Салбар олдсонгүй.";
  const schedule = resolveEffectiveSchedule({ dateStr, branch });
  const start = timeToMinutes(schedule.openTime);
  const end = timeToMinutes(schedule.closeTime);
  const dayStart = bookingDayBounds(dateStr).start.getTime();
  const minutes = Math.floor((scheduledAt.getTime() - dayStart) / 60000);
  if (!schedule.open || start == null || end == null || minutes < start || minutes + durationMinutes > end) {
    return "Товлосон ажиллах цагийн гадуур байна.";
  }
  return null;
}

export async function getBranchSlotMinutes(tenantId: string, branchId: string): Promise<number> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
    select: { slotMinutes: true },
  });
  return branch?.slotMinutes && branch.slotMinutes > 0
    ? branch.slotMinutes
    : DEFAULT_SLOT_MINUTES;
}

export async function findScheduleConflict(
  tenantId: string,
  branchId: string,
  excludeOrderId: string,
  start: Date,
  end: Date,
): Promise<ScheduleConflict | null> {
  // An appointment or scheduled order with no saved duration uses the branch
  // slot as a bounded estimate but remains a "possible" conflict. Never read
  // a stale PENDING/CONFIRMED appointment from months back as active: floor at
  // MAX_CATEGORY_DURATION_MINUTES before `start`, matching the day-view guard.
  const conflictFloor = new Date(start.getTime() - MAX_CATEGORY_DURATION_MINUTES * 60000);

  const [branch, appts, orderIdsWithOpenBookingResult] = await Promise.all([
    prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { slotMinutes: true },
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        branchId,
        status: { in: ["PENDING", "CONFIRMED"] },
        OR: [{ serviceOrderId: null }, { serviceOrderId: { not: excludeOrderId } }],
        requestedAt: { gte: conflictFloor, lt: end },
      },
      select: {
        requestedAt: true,
        estimatedDurationMinutes: true,
        status: true,
        createdAt: true,
        feeAmount: true,
        feeUnderpaidAmount: true,
        payment: { select: { status: true } },
        account: { select: { name: true, phone: true } },
        customer: { select: { fullName: true, phone: true } },
      },
    }),
    // D-076: also fetch orders otherwise out of scope (e.g. COMPLETED) that
    // still have an open OrderTimeBooking row — a follow-up that survived
    // the order's own completion (closeOpenOrderTimeBooking's "ACTIVE"-only
    // scoping on that transition). Without this, such a follow-up would
    // never be checked here at all, defeating the point of D-076.
    prisma.orderTimeBooking
      .findMany({ where: { tenantId, branchId, closedAt: null }, select: { orderId: true }, distinct: ["orderId"] })
      .then((rows) => rows.map((r) => r.orderId)),
  ]);
  const followUpOrderIds = orderIdsWithOpenBookingResult.filter((id) => id !== excludeOrderId);
  const orders = await prisma.serviceOrder.findMany({
    where: {
      tenantId,
      branchId,
      id: { not: excludeOrderId },
      OR: [
        { status: { in: ["SCHEDULED", "IN_PROGRESS", "POSTPONED"] } },
        ...(followUpOrderIds.length > 0 ? [{ id: { in: followUpOrderIds } }] : []),
      ],
    },
    select: {
      id: true,
      number: true,
      status: true,
      scheduledAt: true,
      startedAt: true,
      estimatedDurationMinutes: true,
      expectedFinishAt: true,
      occupiesCapacity: true,
      customer: { select: { fullName: true, phone: true } },
    },
  });
  const fallbackDurationMinutes =
    branch?.slotMinutes && branch.slotMinutes > 0
      ? branch.slotMinutes
      : DEFAULT_SLOT_MINUTES;
  // D-068 read-path swap: resolve each order's interval from its
  // OrderTimeBooking rows (falling back to scalars when it has none) instead
  // of hand-rolling the scheduled/started/estimate logic here — this used to
  // duplicate lib/schedule-order-interval.ts with its own subtly different
  // guards (see D-068 in COWORK.md).
  const orderBookingRows = orders.length > 0
    ? await prisma.orderTimeBooking.findMany({
        where: { orderId: { in: orders.map((o) => o.id) } },
        select: { orderId: true, kind: true, startAt: true, endAt: true, closedAt: true },
      })
    : [];
  const orderBookings = new Map<string, OrderTimeBookingLike[]>();
  for (const row of orderBookingRows) {
    const entry: OrderTimeBookingLike = { kind: row.kind, startAt: row.startAt, endAt: row.endAt, closedAt: row.closedAt };
    const arr = orderBookings.get(row.orderId);
    if (arr) arr.push(entry); else orderBookings.set(row.orderId, [entry]);
  }

  const startMs = start.getTime();
  const endMs = end.getTime();

  for (const a of appts) {
    if (a.status === "PENDING" && isPendingAppointmentPaymentExpired(a)) continue;
    const s0 = a.requestedAt.getTime();
    const hasEstimate =
      a.estimatedDurationMinutes != null &&
      Number.isInteger(a.estimatedDurationMinutes) &&
      a.estimatedDurationMinutes > 0;
    const e0 = s0 + (hasEstimate ? a.estimatedDurationMinutes! : fallbackDurationMinutes) * 60000;
    if (s0 < endMs && e0 > startMs) {
      return {
        label: `цаг захиалга (${customerLabel({ fullName: a.account?.name ?? a.customer?.fullName, phone: a.account?.phone ?? a.customer?.phone })})`,
        certainty: hasEstimate ? "definite" : "possible",
      };
    }
  }

  for (const o of orders) {
    const { current, upcoming } = resolveOrderIntervals(o, orderBookings.get(o.id));

    // D-076: the order's own current interval only counts when its
    // status/occupancy says so (same gate as orderCanCountForCapacity's
    // second condition — the first, terminal-status one is redundant here
    // since a terminal order only reaches this loop via followUpOrderIds,
    // whose current interval never counts anyway). A follow-up is checked
    // unconditionally below, regardless of this gate.
    if (!(o.status !== "SCHEDULED" && o.occupiesCapacity === false)) {
      if (!current.invalid && current.start != null) {
        const s0 = current.start.getTime();
        const hasEstimate =
          o.estimatedDurationMinutes != null &&
          Number.isInteger(o.estimatedDurationMinutes) &&
          o.estimatedDurationMinutes > 0;
        const e0 =
          current.end?.getTime() ??
          (current.scheduled && current.start != null
            ? s0 + fallbackDurationMinutes * 60000
            : Number.POSITIVE_INFINITY);
        if (s0 < endMs && e0 > startMs) {
          return {
            label: `захиалга #${o.number} (${customerLabel(o.customer)})`,
            certainty: e0 === Number.POSITIVE_INFINITY || !hasEstimate ? "possible" : "definite",
          };
        }
      }
    }

    for (const up of upcoming) {
      if (up.invalid || up.start == null) continue;
      const s0 = up.start.getTime();
      const hasEstimate = up.end != null;
      const e0 = up.end?.getTime() ?? s0 + fallbackDurationMinutes * 60000;
      if (s0 < endMs && e0 > startMs) {
        return {
          label: `захиалга #${o.number} (${customerLabel(o.customer)}) — дараагийн цаг захиалга`,
          certainty: hasEstimate ? "definite" : "possible",
        };
      }
    }
  }

  return null;
}
