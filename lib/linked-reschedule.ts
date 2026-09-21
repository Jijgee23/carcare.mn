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
 * cancelled/completed). Outside that window there is nothing to keep in
 * sync and each action keeps its own simple, single-entity path.
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
import { DEFAULT_SLOT_MINUTES } from "@/lib/appointment-slots";
import { bookingDateKey, bookingDayBounds } from "@/lib/booking-time";
import { resolveEffectiveSchedule } from "@/lib/branch-effective-schedule";
import { branchScheduleForDateSelect } from "@/lib/branch-effective-schedule-server";
import { timeToMinutes } from "@/lib/branches";
import { canEditOrder } from "@/lib/auth/order-access";
import { updateOpenOrderTimeBookingSchedule, withOrderTransaction } from "@/lib/order-time-booking";
import type { PrismaTransactionClient } from "@/lib/prisma";
import type { OrderCommandActor, OrderCommandScope } from "@/lib/orders/order-commands";

export class LinkedRescheduleError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
    public readonly status = 422,
    public readonly code = "LINKED_RESCHEDULE_REJECTED",
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
  /** Order-side callers provide these so authorization is checked after the order lock. */
  actor?: OrderCommandActor;
  scope?: OrderCommandScope;
  /** Order-side rescheduling preserves legacy order-only behavior if a linked appointment is no longer confirmed. */
  allowUnconfirmedOrderMove?: boolean;
};

export type MoveLinkedAppointmentOrderResult = {
  appointmentId: string | null;
  appointmentAccountId: string | null;
  appointmentStatus: AppointmentStatus | null;
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
  assignedToId: string | null;
  scheduledAt: Date | null;
  estimatedDurationMinutes: number | null;
  appointment: { id: string } | null;
};

async function scheduleHoursError(
  tx: PrismaTransactionClient,
  tenantId: string,
  branchId: string,
  scheduledAt: Date,
  durationMinutes: number,
): Promise<string | null> {
  const dateStr = bookingDateKey(scheduledAt);
  const branch = await tx.branch.findFirst({
    where: { id: branchId, tenantId, isActive: true },
    select: { slotMinutes: true, ...branchScheduleForDateSelect(dateStr) },
  });
  if (!branch) return "Салбар олдсонгүй.";
  const schedule = resolveEffectiveSchedule({ dateStr, branch });
  const open = timeToMinutes(schedule.openTime);
  const close = timeToMinutes(schedule.closeTime);
  const startMinutes = Math.floor((scheduledAt.getTime() - bookingDayBounds(dateStr).start.getTime()) / 60000);
  if (!schedule.open || open == null || close == null || startMinutes < open || startMinutes + durationMinutes > close) {
    return "Товлосон ажиллах цагийн гадуур байна.";
  }
  return null;
}

type LockedAppointment = {
  id: string;
  branchId: string;
  status: AppointmentStatus;
  accountId: string | null;
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
      assignedToId: true,
      appointment: { select: { id: true } },
    },
    async (tx, orderRaw) => {
      const order = orderRaw as LockedOrder | null;
      if (!order) throw new LinkedRescheduleError("Захиалга олдсонгүй.", undefined, 404, "ORDER_NOT_FOUND");
      if (input.actor) {
        if (input.scope != null && order.branchId !== input.scope) {
          throw new LinkedRescheduleError("Зөвшөөрөгдсөн салбарын захиалга биш.", undefined, 404, "ORDER_OUT_OF_SCOPE");
        }
        if (!canEditOrder(input.actor, order)) {
          throw new LinkedRescheduleError("Танд энэ захиалгыг засах эрх байхгүй.", undefined, 403, "ORDER_EDIT_FORBIDDEN");
        }
      }
      if (order.status !== "SCHEDULED") {
        throw new LinkedRescheduleError(
          "Зөвхөн эхлээгүй (товлогдсон) захиалгын огноог энд шилжүүлнэ.",
          undefined,
          422,
          "ORDER_STATUS_INVALID",
        );
      }

      // Second lock: the Appointment row itself, so a concurrent change to it
      // that never touches the ServiceOrder row (e.g. a customer-side cancel)
      // is also serialized against this write. Fixed order (ServiceOrder,
      // then Appointment) — see module doc comment.
      const rawTx = tx as unknown as {
        $queryRaw: <R = unknown>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<R>;
      };
      if (input.newTime.getTime() < Date.now()) {
        throw new LinkedRescheduleError("Өнгөрсөн цаг сонгох боломжгүй.", { scheduledAt: "Өнгөрсөн цаг сонгох боломжгүй." }, 422, "PAST_TIME");
      }
      // Always discover and lock the current linked appointment by its fresh
      // serviceOrderId relation. The initial nested relation can be stale (or
      // null while another writer links an appointment), so it must not decide
      // whether the appointment row is locked or whether it is CONFIRMED.
      const lockedAppt = await rawTx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Appointment"
        WHERE "tenantId" = ${input.tenantId} AND "serviceOrderId" = ${order.id}
        FOR UPDATE
      `;
      const appointmentId = lockedAppt[0]?.id ?? null;
      if (order.appointment && !appointmentId && !input.allowUnconfirmedOrderMove) {
        throw new LinkedRescheduleError("Цаг захиалга олдсонгүй.", undefined, 404, "APPOINTMENT_NOT_FOUND");
      }

      const apptRaw = appointmentId ? await tx.appointment.findFirst({
        where: { id: appointmentId, tenantId: input.tenantId },
        select: {
          id: true,
          branchId: true,
          status: true,
          accountId: true,
          requestedAt: true,
          estimatedDurationMinutes: true,
          serviceOrderId: true,
        },
      }) : null;
      const appt = apptRaw as LockedAppointment | null;
      if (appointmentId && !appt) throw new LinkedRescheduleError("Цаг захиалга олдсонгүй.", undefined, 404, "APPOINTMENT_NOT_FOUND");
      if (appt && appt.serviceOrderId !== order.id) {
        // Link changed underneath us — treat as a stale-state conflict.
        throw new LinkedRescheduleError("Холбоос өөрчлөгдсөн байна. Дахин оролдоно уу.", undefined, 409, "STALE_LINK");
      }
      if (appt && appt.status !== "CONFIRMED" && !input.allowUnconfirmedOrderMove) {
        throw new LinkedRescheduleError("Зөвхөн баталгаажсан цагийг энд шилжүүлнэ.", undefined, 422, "APPOINTMENT_STATUS_INVALID");
      }
      if (appt && appt.branchId !== order.branchId) {
        throw new LinkedRescheduleError("Холбоосын салбар өөрчлөгдсөн байна. Дахин оролдоно уу.", undefined, 409, "STALE_LINK");
      }
      if (appt && input.scope != null && appt.branchId !== input.scope) {
        throw new LinkedRescheduleError("Зөвшөөрөгдсөн салбарын цаг захиалга биш.", undefined, 404, "ORDER_OUT_OF_SCOPE");
      }

      const durationMinutes =
        order.estimatedDurationMinutes ??
        (appt?.status === "CONFIRMED" ? appt.estimatedDurationMinutes : null) ??
        (await tx.branch.findFirst({
          where: { id: order.branchId, tenantId: input.tenantId },
          select: { slotMinutes: true },
        }))?.slotMinutes ?? DEFAULT_SLOT_MINUTES;

      // D-111 removed the schedule-overlap check that used to follow this one,
      // so working hours is now the only confirmable warning on this path.
      const hoursError = await scheduleHoursError(
        tx as PrismaTransactionClient,
        input.tenantId,
        order.branchId,
        input.newTime,
        durationMinutes,
      );
      // D-087 superseded: an hours violation is a confirmable warning, not a
      // hard block.
      if (hoursError && !input.confirmed) {
        throw new LinkedRescheduleError(
          `${hoursError} Үргэлжлүүлэхийн тулд дахин "Хадгалах" дарна уу.`,
          { confirmNeeded: "true" },
          409,
          "CONFIRMATION_REQUIRED",
        );
      }

      const endAt = new Date(input.newTime.getTime() + durationMinutes * 60000);

      const previousScheduledAt = order.scheduledAt;
      const previousRequestedAt = appt?.requestedAt ?? previousScheduledAt ?? input.newTime;

      if (appt?.status === "CONFIRMED") await tx.appointment.update({
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
      if (appt?.status === "CONFIRMED") await logAudit(
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
        appointmentId: appt?.id ?? null,
        appointmentAccountId: appt?.accountId ?? null,
        appointmentStatus: appt?.status ?? null,
        orderId: order.id,
        branchId: order.branchId,
        previousRequestedAt: appt?.requestedAt ?? previousScheduledAt ?? input.newTime,
        previousScheduledAt,
        newTime: input.newTime,
      };
    },
  );
}
