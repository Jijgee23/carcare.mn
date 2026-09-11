/**
 * S14 (WEB_SCHEDULING_ASSESSMENT_2026-09-10.md): staff appointment reschedule
 * (app/_actions/appointments.ts, rescheduleAppointmentAction) and staff order
 * reschedule (app/_actions/orders.ts, rescheduleOrderAction) each wrote only
 * their own entity — an appointment linked to a still-SCHEDULED order could
 * drift into two different times, one shown on the appointment list/calendar
 * (`Appointment.requestedAt`), the other on the order and its day-capacity
 * projection (`ServiceOrder.scheduledAt` / `OrderTimeBooking`).
 *
 * This module holds the ONE command both entry points call whenever the
 * dangerous window applies — appointment still CONFIRMED, its linked order
 * still SCHEDULED (i.e. work has not started and the order hasn't been
 * postponed/cancelled/completed). Outside that window there is nothing to
 * keep in sync and each action keeps its own simple, single-entity path.
 *
 * Lock strategy: this reuses `withOrderTransaction` (lib/order-time-booking.ts),
 * which takes a `FOR UPDATE` lock on the ServiceOrder row and rereads it fresh
 * before handing control to the callback — the same lock `rescheduleOrderAction`
 * already used standalone. On top of that, this module ALSO takes a `FOR
 * UPDATE` lock on the linked Appointment row (mirroring
 * `moveAppointmentInTransaction` in lib/appointment-reservations.ts) and
 * rereads it fresh too, because the appointment can change independently of
 * the order (e.g. a customer-side cancel) through a path that never touches
 * the ServiceOrder row. Locking order-then-appointment is a FIXED order used
 * by both call sites (this is the only place that locks both), so there is no
 * deadlock risk from reversed lock ordering elsewhere.
 */
import type { AppointmentStatus, OrderStatus } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import {
  findScheduleConflict,
  getBranchSlotMinutes,
  validateScheduledOrderHours,
} from "@/lib/order-schedule-validation";
import { updateOpenOrderTimeBookingSchedule, withOrderTransaction } from "@/lib/order-time-booking";
import type { PrismaTransactionClient } from "@/lib/prisma";

export class LinkedRescheduleError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export type MoveLinkedAppointmentOrderInput = {
  tenantId: string;
  userId: string;
  /** The ServiceOrder id — the lock target; caller resolves this either directly (order-side) or via appt.serviceOrderId (appointment-side). */
  orderId: string;
  newTime: Date;
  /** Skip the soft schedule-conflict check (staff already confirmed once). */
  confirmed?: boolean;
};

export type MoveLinkedAppointmentOrderResult = {
  appointmentId: string;
  orderId: string;
  branchId: string;
  previousRequestedAt: Date;
  previousScheduledAt: Date | null;
  newTime: Date;
};

type LockedOrder = {
  id: string;
  branchId: string;
  status: OrderStatus;
  scheduledAt: Date | null;
  estimatedDurationMinutes: number | null;
  appointment: { id: string } | null;
};

type LockedAppointment = {
  id: string;
  status: AppointmentStatus;
  requestedAt: Date;
  estimatedDurationMinutes: number | null;
  serviceOrderId: string | null;
};

/**
 * Re-fetches the appointment AND its linked order fresh under lock, confirms
 * appointment is still CONFIRMED and order is still SCHEDULED (else rejects —
 * someone else changed state concurrently), validates the new time against
 * branch hours/closing and existing conflict-check logic, then writes
 * `Appointment.requestedAt`, `ServiceOrder.scheduledAt`, and the
 * `OrderTimeBooking` row together, with one audit entry per entity (kept
 * separate rather than merged into one so each entity's own audit history —
 * e.g. a future per-entity audit view — shows the change under its own id;
 * both entries carry the same summary/timestamps so they read as one event).
 *
 * Throws `LinkedRescheduleError` for any validation/state-conflict failure —
 * callers translate that into their own action-state shape.
 */
export async function moveLinkedAppointmentOrder(
  input: MoveLinkedAppointmentOrderInput,
): Promise<MoveLinkedAppointmentOrderResult> {
  if (!Number.isFinite(input.newTime.getTime())) {
    throw new LinkedRescheduleError("Огноо буруу.", { scheduledAt: "Огноо буруу." });
  }
  if (input.newTime.getTime() < Date.now()) {
    throw new LinkedRescheduleError("Өнгөрсөн цаг сонгох боломжгүй.", {
      scheduledAt: "Өнгөрсөн цаг сонгох боломжгүй.",
    });
  }

  return withOrderTransaction(
    input.tenantId,
    input.orderId,
    {
      id: true,
      branchId: true,
      status: true,
      scheduledAt: true,
      estimatedDurationMinutes: true,
      appointment: { select: { id: true } },
    },
    async (tx, orderRaw) => {
      const order = orderRaw as LockedOrder | null;
      if (!order) throw new LinkedRescheduleError("Захиалга олдсонгүй.");
      if (order.status !== "SCHEDULED") {
        throw new LinkedRescheduleError(
          "Зөвхөн эхлээгүй (товлогдсон) захиалгын огноог энд шилжүүлнэ.",
        );
      }
      if (!order.appointment) {
        throw new LinkedRescheduleError("Холбогдсон цаг захиалга алга.");
      }

      // Second lock: the Appointment row itself, so a concurrent change to it
      // that never touches the ServiceOrder row (e.g. a customer-side cancel)
      // is also serialized against this write. Fixed order (ServiceOrder,
      // then Appointment) — see module doc comment.
      const rawTx = tx as unknown as {
        $queryRaw: <R = unknown>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<R>;
      };
      const lockedAppt = await rawTx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Appointment" WHERE id = ${order.appointment.id} AND "tenantId" = ${input.tenantId} FOR UPDATE
      `;
      if (!lockedAppt.length) throw new LinkedRescheduleError("Цаг захиалга олдсонгүй.");

      const apptRaw = await tx.appointment.findFirst({
        where: { id: order.appointment.id, tenantId: input.tenantId },
        select: {
          id: true,
          status: true,
          requestedAt: true,
          estimatedDurationMinutes: true,
          serviceOrderId: true,
        },
      });
      const appt = apptRaw as LockedAppointment | null;
      if (!appt) throw new LinkedRescheduleError("Цаг захиалга олдсонгүй.");
      if (appt.serviceOrderId !== order.id) {
        // Link changed underneath us — treat as a stale-state conflict.
        throw new LinkedRescheduleError("Холбоос өөрчлөгдсөн байна. Дахин оролдоно уу.");
      }
      if (appt.status !== "CONFIRMED") {
        throw new LinkedRescheduleError("Зөвхөн баталгаажсан цагийг энд шилжүүлнэ.");
      }

      const durationMinutes =
        order.estimatedDurationMinutes ??
        appt.estimatedDurationMinutes ??
        (await getBranchSlotMinutes(input.tenantId, order.branchId));

      const hoursError = await validateScheduledOrderHours(
        input.tenantId,
        order.branchId,
        input.newTime,
        durationMinutes,
      );
      if (hoursError) throw new LinkedRescheduleError(hoursError, { scheduledAt: hoursError });

      const endAt = new Date(input.newTime.getTime() + durationMinutes * 60000);
      if (!input.confirmed) {
        const conflict = await findScheduleConflict(
          input.tenantId,
          order.branchId,
          order.id,
          input.newTime,
          endAt,
        );
        if (conflict) {
          throw new LinkedRescheduleError(
            conflict.certainty === "possible"
              ? `Шинэ товлосон огноо ${conflict.label}-тай давхцах магадлалтай. Үргэлжлүүлэхийн тулд дахин "Хадгалах" дарна уу.`
              : `Шинэ товлосон огноо ${conflict.label}-тай давхцаж байна. Үргэлжлүүлэхийн тулд дахин "Хадгалах" дарна уу.`,
            { confirmNeeded: "true" },
          );
        }
      }

      const previousRequestedAt = appt.requestedAt;
      const previousScheduledAt = order.scheduledAt;

      await tx.appointment.update({
        where: { id: appt.id },
        // S17 Phase B: reset reminderSentAt so the appointment-reminders cron
        // picks this appointment back up for its new time (same fix as
        // moveAppointmentInTransaction in lib/appointment-reservations.ts).
        data: { requestedAt: input.newTime, reminderSentAt: null },
      });
      await tx.serviceOrder.update({
        where: { id: order.id },
        data: { scheduledAt: input.newTime },
      });
      await updateOpenOrderTimeBookingSchedule(tx as PrismaTransactionClient, order.id, {
        startAt: input.newTime,
        endAt,
      });

      await logAudit(
        {
          tenantId: input.tenantId,
          userId: input.userId,
          branchId: order.branchId,
          entity: "ServiceOrder",
          entityId: order.id,
          action: "UPDATE",
          summary: "Товлосон огноог холбогдсон цаг захиалгын хамт шилжүүлэв",
          before: { scheduledAt: previousScheduledAt?.toISOString() ?? null },
          after: { scheduledAt: input.newTime.toISOString() },
        },
        tx,
      );
      await logAudit(
        {
          tenantId: input.tenantId,
          userId: input.userId,
          branchId: order.branchId,
          entity: "Appointment",
          entityId: appt.id,
          action: "UPDATE",
          summary: "Цагийг холбогдсон захиалгын хамт шилжүүлэв",
          before: { requestedAt: previousRequestedAt.toISOString() },
          after: { requestedAt: input.newTime.toISOString() },
        },
        tx,
      );

      return {
        appointmentId: appt.id,
        orderId: order.id,
        branchId: order.branchId,
        previousRequestedAt,
        previousScheduledAt,
        newTime: input.newTime,
      };
    },
  );
}
