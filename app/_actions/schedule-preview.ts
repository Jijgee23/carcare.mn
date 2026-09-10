"use server";

import { requireUser } from "@/lib/auth";
import { canView, workingBranchScopeId } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { timeToMinutes } from "@/lib/branches";
import { bookingDayBounds } from "@/lib/booking-time";
import { branchScheduleDisplaySelect } from "@/lib/branch-effective-schedule-server";
import { resolveEffectiveSchedule } from "@/lib/branch-effective-schedule";
import { loadBranchSchedule } from "@/lib/branch-schedule-loader";
import {
  appointmentDisplayName,
  orderDisplayName,
} from "@/app/dashboard/appointments/calendar/day-rows";
import { APPOINTMENT_STATUS_BADGE, APPOINTMENT_STATUS_LABEL } from "@/lib/appointments";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/lib/orders";
import {
  APPOINTMENT_BOOKING_PAYMENT_BADGE,
  APPOINTMENT_BOOKING_PAYMENT_LABEL,
  appointmentBookingPaymentStatus,
} from "@/lib/appointment-payment-status";
import type { SchedulePreviewRow } from "@/app/_components/schedule-preview-grid";

// Хуваарийн жинхэнэ хуудас (grid-schedule.tsx) ашигладаг `08:00`–`20:00`
// анхны цонхтой адил — цагийн хуваарь тодорхойгүй үед ямар ч утгагүй тэнхлэг
// үзүүлэхгүйн тулд.
const DEFAULT_AXIS_OPEN_MINUTES = 8 * 60;
const DEFAULT_AXIS_CLOSE_MINUTES = 20 * 60;

export type BranchDaySchedulePreview = {
  rows: SchedulePreviewRow[];
  axisStartMs: number;
  axisEndMs: number;
};

/**
 * Staff-only, read-only day-schedule projection for the appointment/order
 * creation forms — lets a worker see what's actually booked before picking a
 * time, instead of guessing from a bare slot-availability grid. Deliberately
 * NOT the public getBranchDaySlots action (app/_actions/appointments.ts):
 * that one runs under setBypassContext() for anonymous customers and is
 * gated on the tenant's online-booking plan feature, which must never block
 * a staff member from seeing their own branch's schedule while creating a
 * walk-in order or phone-in appointment.
 *
 * Returns null on any authorization/scope failure rather than throwing —
 * this is a supplementary visual aid, not a required step, so a caller can
 * simply render nothing instead of surfacing an error to a worker who is
 * mid-flow filling in an unrelated field.
 */
export async function getBranchDaySchedulePreview(
  branchId: string,
  dateStr: string,
): Promise<BranchDaySchedulePreview | null> {
  const user = await requireUser();
  if (!canView(user, "appointments")) return null;
  const scope = workingBranchScopeId(user);
  if (scope && scope !== branchId) return null;
  if (!branchId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId: user.tenantId },
    select: { id: true, ...branchScheduleDisplaySelect() },
  });
  if (!branch) return null;

  let dayStart: Date;
  try {
    dayStart = bookingDayBounds(dateStr).start;
  } catch {
    return null;
  }

  const schedule = await loadBranchSchedule({
    tenantId: user.tenantId,
    branchId,
    dateStr,
  });

  const appointmentById = new Map(schedule.appointments.map((a) => [a.id, a]));
  const orderById = new Map(schedule.orders.map((o) => [o.id, o]));
  const isHiddenCarryOverOrder = (id: string) => {
    const order = orderById.get(id);
    return order?.carriedOver === true && order.continuesIntoDay !== true;
  };

  const rows: SchedulePreviewRow[] = schedule.intervals
    .filter((row) => row.source !== "order" || !isHiddenCarryOverOrder(row.id))
    .sort((a, b) => a.startMs - b.startMs)
    .map((row) => {
      const appt = row.source === "appointment" ? appointmentById.get(row.id) : null;
      const order = row.source === "order" ? orderById.get(row.id) : null;
      const paymentStatus = appt ? appointmentBookingPaymentStatus(appt) : null;
      return {
        key: `${row.source}-${row.id}`,
        startMs: row.startMs,
        endMs: row.endMs,
        uncertain: row.uncertain,
        name: appt
          ? appointmentDisplayName(appt)
          : order
            ? orderDisplayName(order)
            : "—",
        statusLabel: appt
          ? APPOINTMENT_STATUS_LABEL[appt.status]
          : order
            ? ORDER_STATUS_LABEL[order.status]
            : "",
        statusClass: appt
          ? APPOINTMENT_STATUS_BADGE[appt.status]
          : order
            ? ORDER_STATUS_BADGE[order.status]
            : "",
        paymentStatusLabel:
          paymentStatus && paymentStatus !== "NOT_REQUIRED"
            ? APPOINTMENT_BOOKING_PAYMENT_LABEL[paymentStatus]
            : null,
        paymentStatusClass:
          paymentStatus && paymentStatus !== "NOT_REQUIRED"
            ? APPOINTMENT_BOOKING_PAYMENT_BADGE[paymentStatus]
            : null,
        continuesFromPreviousDay: order?.continuesIntoDay === true,
        endsAtDayBoundary: row.endMs === schedule.rangeEnd.getTime(),
      };
    });

  const effective = resolveEffectiveSchedule({ dateStr, branch });
  const openMin =
    (effective.open ? timeToMinutes(effective.openTime) : null) ?? DEFAULT_AXIS_OPEN_MINUTES;
  const closeMin =
    (effective.open ? timeToMinutes(effective.closeTime) : null) ?? DEFAULT_AXIS_CLOSE_MINUTES;
  const dayStartMs = dayStart.getTime();

  return {
    rows,
    axisStartMs: dayStartMs + openMin * 60000,
    axisEndMs: dayStartMs + Math.max(openMin + 60, closeMin) * 60000,
  };
}
