import { bookingDateKey, bookingDayBounds } from "@/lib/booking-time";
import type { EffectiveSchedule } from "@/lib/branch-effective-schedule";
import { timeToMinutes } from "@/lib/branches";

export type ScheduleImpact = {
  erased: Array<{ id: string; requestedAt: Date }>;
  clipped: Array<{ id: string; requestedAt: Date; durationMinutes: number }>;
};

type ScheduleAppointmentRow = {
  id: string;
  requestedAt: Date;
  estimatedDurationMinutes: number | null;
};

type ScheduleAppointmentClient = {
  findMany(args: Record<string, unknown>): Promise<ScheduleAppointmentRow[]>;
  update(args: Record<string, unknown>): Promise<unknown>;
};

/** Inspect active appointments that fall inside a changed schedule range. */
export async function inspectScheduleImpact(
  tx: { appointment: unknown },
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
  const appointments = await appointment.findMany({
    where: {
      tenantId: input.tenantId,
      branchId: input.branchId,
      status: { in: ["PENDING", "CONFIRMED"] },
      requestedAt: { gte: input.from, lt: input.to },
    },
    select: { id: true, requestedAt: true, estimatedDurationMinutes: true },
  });
  const erased: ScheduleImpact["erased"] = [];
  const clipped: ScheduleImpact["clipped"] = [];
  for (const appointment of appointments) {
    const dateStr = bookingDateKey(appointment.requestedAt);
    const effective = input.resolve(dateStr);
    const open = timeToMinutes(effective.openTime);
    const close = timeToMinutes(effective.closeTime);
    const dayStart = bookingDayBounds(dateStr).start.getTime();
    const start = Math.floor((appointment.requestedAt.getTime() - dayStart) / 60000);
    const duration = appointment.estimatedDurationMinutes ?? input.fallbackDurationMinutes;
    if (!effective.open || open == null || close == null || close <= open || start < open || start >= close) {
      erased.push({ id: appointment.id, requestedAt: appointment.requestedAt });
      continue;
    }
    const remaining = close - start;
    if (start + duration > close && remaining > 0) {
      clipped.push({ id: appointment.id, requestedAt: appointment.requestedAt, durationMinutes: remaining });
    }
  }
  return { erased, clipped };
}

export async function applyScheduleClips(
  tx: { appointment: unknown },
  impact: ScheduleImpact,
): Promise<void> {
  const appointment = tx.appointment as ScheduleAppointmentClient;
  for (const item of impact.clipped) {
    await appointment.update({
      where: { id: item.id },
      data: { estimatedDurationMinutes: item.durationMinutes },
    });
  }
}
