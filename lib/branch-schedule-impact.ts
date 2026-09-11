import { bookingDateKey, bookingDayBounds } from "@/lib/booking-time";
import type { EffectiveSchedule } from "@/lib/branch-effective-schedule";
import { timeToMinutes } from "@/lib/branches";
import { isPendingAppointmentPaymentExpired } from "@/lib/appointment-payment-status";

/** Discriminator so callers/applyScheduleClips know which model a clipped/erased row belongs to. */
export type ScheduleImpactKind = "APPOINTMENT" | "ORDER_TIME_BOOKING";

export type ScheduleImpact = {
  erased: Array<{ id: string; kind: ScheduleImpactKind; requestedAt: Date; originalDurationMinutes: number | null }>;
  clipped: Array<{
    id: string;
    kind: ScheduleImpactKind;
    requestedAt: Date;
    durationMinutes: number;
    originalDurationMinutes: number | null;
  }>;
};

type ScheduleAppointmentRow = {
  id: string;
  requestedAt: Date;
  estimatedDurationMinutes: number | null;
  originalEstimatedDurationMinutes: number | null;
  status: string;
  feeAmount: unknown;
  feeUnderpaidAmount: unknown;
  createdAt: Date;
  payment: { status: string } | null;
};

type ScheduleAppointmentClient = {
  findMany(args: Record<string, unknown>): Promise<ScheduleAppointmentRow[]>;
  update(args: Record<string, unknown>): Promise<unknown>;
};

type ScheduleOrderTimeBookingRow = {
  id: string;
  startAt: Date;
  endAt: Date | null;
  originalDurationMinutes: number | null;
};

type ScheduleOrderTimeBookingClient = {
  findMany(args: Record<string, unknown>): Promise<ScheduleOrderTimeBookingRow[]>;
  update(args: Record<string, unknown>): Promise<unknown>;
};

/**
 * Minimal transaction client shape needed to inspect/apply impact across both
 * models. Kept untyped (like the original single-model version) and cast
 * internally — every real caller passes some flavor of Prisma's generated
 * transaction client (`Prisma.TransactionClient`, the RLS-extended
 * `PrismaTransactionClient`, or bare `prisma` itself), whose generated method
 * signatures are narrower/richer than a hand-written structural interface
 * could match without fighting the type checker on every call site.
 */
export type ScheduleImpactTx = { appointment: unknown; orderTimeBooking: unknown };

// Fallback duration for an OrderTimeBooking row with no endAt (mirrors the
// appointment path's estimatedDurationMinutes ?? fallback below).
function bookingDurationMinutes(row: ScheduleOrderTimeBookingRow, fallbackDurationMinutes: number): number {
  if (!row.endAt) return fallbackDurationMinutes;
  const minutes = Math.round((row.endAt.getTime() - row.startAt.getTime()) / 60000);
  return minutes > 0 ? minutes : fallbackDurationMinutes;
}

/**
 * Inspect active appointments AND scheduled order-time bookings (plain
 * scheduled sessions and postpone-created return bookings — both are
 * `kind: "SCHEDULED"`, see lib/order-postpone.ts's postponeOrderCore) that
 * fall inside a changed schedule range. Expired-but-unpaid PENDING
 * appointment holds are excluded — see isPendingAppointmentPaymentExpired.
 */
export async function inspectScheduleImpact(
  tx: ScheduleImpactTx,
  input: {
    tenantId: string;
    branchId: string;
    from: Date;
    to: Date;
    resolve: (dateStr: string) => EffectiveSchedule;
    fallbackDurationMinutes: number;
  },
): Promise<ScheduleImpact> {
  const appointment = tx.appointment as ScheduleAppointmentClient;
  const orderTimeBooking = tx.orderTimeBooking as ScheduleOrderTimeBookingClient;
  const appointments = await appointment.findMany({
    where: {
      tenantId: input.tenantId,
      branchId: input.branchId,
      status: { in: ["PENDING", "CONFIRMED"] },
      requestedAt: { gte: input.from, lt: input.to },
    },
    select: {
      id: true,
      requestedAt: true,
      estimatedDurationMinutes: true,
      originalEstimatedDurationMinutes: true,
      status: true,
      feeAmount: true,
      feeUnderpaidAmount: true,
      createdAt: true,
      payment: { select: { status: true } },
    },
  });
  const bookings = await orderTimeBooking.findMany({
    where: {
      tenantId: input.tenantId,
      branchId: input.branchId,
      kind: "SCHEDULED",
      closedAt: null,
      startAt: { gte: input.from, lt: input.to },
    },
    select: { id: true, startAt: true, endAt: true, originalDurationMinutes: true },
  });

  const erased: ScheduleImpact["erased"] = [];
  const clipped: ScheduleImpact["clipped"] = [];

  const evaluate = (
    id: string,
    kind: ScheduleImpactKind,
    requestedAt: Date,
    duration: number,
    originalDurationMinutes: number | null,
  ) => {
    const dateStr = bookingDateKey(requestedAt);
    const effective = input.resolve(dateStr);
    const open = timeToMinutes(effective.openTime);
    const close = timeToMinutes(effective.closeTime);
    const dayStart = bookingDayBounds(dateStr).start.getTime();
    const start = Math.floor((requestedAt.getTime() - dayStart) / 60000);
    if (!effective.open || open == null || close == null || close <= open || start < open || start >= close) {
      erased.push({ id, kind, requestedAt, originalDurationMinutes });
      return;
    }
    const remaining = close - start;
    if (start + duration > close && remaining > 0) {
      clipped.push({ id, kind, requestedAt, durationMinutes: remaining, originalDurationMinutes });
    }
  };

  for (const appointment of appointments) {
    if (
      appointment.status === "PENDING" &&
      isPendingAppointmentPaymentExpired({
        feeAmount: appointment.feeAmount,
        feeUnderpaidAmount: appointment.feeUnderpaidAmount,
        payment: appointment.payment,
        createdAt: appointment.createdAt,
      })
    ) {
      continue;
    }
    const duration = appointment.estimatedDurationMinutes ?? input.fallbackDurationMinutes;
    evaluate(
      appointment.id,
      "APPOINTMENT",
      appointment.requestedAt,
      duration,
      appointment.originalEstimatedDurationMinutes,
    );
  }
  for (const booking of bookings) {
    const duration = bookingDurationMinutes(booking, input.fallbackDurationMinutes);
    evaluate(booking.id, "ORDER_TIME_BOOKING", booking.startAt, duration, booking.originalDurationMinutes);
  }

  return { erased, clipped };
}

export async function applyScheduleClips(
  tx: ScheduleImpactTx,
  impact: ScheduleImpact,
): Promise<void> {
  const appointment = tx.appointment as ScheduleAppointmentClient;
  const orderTimeBooking = tx.orderTimeBooking as ScheduleOrderTimeBookingClient;
  for (const item of impact.clipped) {
    if (item.kind === "APPOINTMENT") {
      await appointment.update({
        where: { id: item.id },
        data: { estimatedDurationMinutes: item.durationMinutes },
      });
    } else {
      const endAt = new Date(item.requestedAt.getTime() + item.durationMinutes * 60000);
      await orderTimeBooking.update({
        where: { id: item.id },
        data: { endAt },
      });
    }
  }
}
