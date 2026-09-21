import type { PrismaTransactionClient } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { canEditOrder } from "@/lib/auth/order-access";
import { bookingDateKey, bookingDayBounds } from "@/lib/booking-time";
import { resolveEffectiveSchedule } from "@/lib/branch-effective-schedule";
import { branchScheduleForDateSelect } from "@/lib/branch-effective-schedule-server";
import { timeToMinutes } from "@/lib/branches";
import {
  getOpenOrderTimeBookings,
  updateOpenOrderTimeBookingForecast,
  withOrderTransaction,
} from "@/lib/order-time-booking";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { isOrderLocked, type OrderStatus } from "@/lib/orders";
import type { OrderCommandActor, OrderCommandScope } from "@/lib/orders/order-commands";
import { LinkedRescheduleError, moveLinkedAppointmentOrder } from "@/lib/linked-reschedule";

export class OrderScheduleCommandError extends Error {
  constructor(
    message: string,
    public readonly status = 422,
    public readonly code = "ORDER_SCHEDULE_REJECTED",
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "OrderScheduleCommandError";
  }
}

export function isExpectedFinishAfterStart(finish: Date, start: Date): boolean {
  return finish.getTime() > start.getTime();
}

export function isScheduleTimeInPast(value: Date, now = Date.now()): boolean {
  return value.getTime() < now;
}

type LockedOrder = {
  id: string;
  branchId: string;
  status: OrderStatus;
  assignedToId: string | null;
  startedAt: Date | null;
  expectedFinishAt: Date | null;
  scheduledAt: Date | null;
  estimatedDurationMinutes: number | null;
  appointment: {
    id: string;
    accountId: string | null;
    status: string;
    requestedAt?: Date;
    estimatedDurationMinutes?: number | null;
    serviceOrderId?: string | null;
  } | null;
};

function assertOrderAccess(
  actor: OrderCommandActor,
  order: Pick<LockedOrder, "branchId" | "assignedToId">,
  scope: OrderCommandScope,
) {
  if (scope != null && order.branchId !== scope) {
    throw new OrderScheduleCommandError("Зөвхөн өөрийн ажиллах салбарын захиалгыг удирдана.", 404, "ORDER_OUT_OF_SCOPE");
  }
  if (!canEditOrder(actor, order)) {
    throw new OrderScheduleCommandError("Танд энэ засварын хуудсыг засах эрх байхгүй.", 403, "ORDER_EDIT_FORBIDDEN");
  }
}

async function expectedFinishNeedsWarning(
  tx: PrismaTransactionClient,
  tenantId: string,
  branchId: string,
  start: Date,
  end: Date,
): Promise<boolean> {
  const startDate = bookingDateKey(start);
  const endDate = bookingDateKey(new Date(end.getTime() - 1));
  if (startDate !== endDate) return true;
  const branch = await tx.branch.findFirst({
    where: { id: branchId, tenantId },
    select: branchScheduleForDateSelect(startDate),
  });
  if (!branch) return true;
  const schedule = resolveEffectiveSchedule({ dateStr: startDate, branch });
  const open = timeToMinutes(schedule.openTime);
  const close = timeToMinutes(schedule.closeTime);
  if (!schedule.open || open == null || close == null || close <= open) return true;
  const dayStart = bookingDayBounds(startDate).start.getTime();
  const startMinutes = (start.getTime() - dayStart) / 60000;
  const endMinutes = (end.getTime() - dayStart) / 60000;
  return startMinutes < open || endMinutes > close;
}

async function notifyExpectedFinishChange(
  result: { appointment: LockedOrder["appointment"]; previous: Date | null; next: Date | null },
) {
  if (
    !result.previous ||
    !result.next ||
    Math.abs(result.next.getTime() - result.previous.getTime()) < 15 * 60 * 1000 ||
    !result.appointment?.accountId ||
    !["PENDING", "CONFIRMED"].includes(result.appointment.status)
  ) return;
  try {
    await createNotification({
      type: "expected_finish_revised",
      recipient: { accountId: result.appointment.accountId },
      input: {
        appointmentId: result.appointment.id,
        body: result.next.getTime() > result.previous.getTime()
          ? "Таны засварын хуудасны дуусах хугацаа хойшлогдлоо."
          : "Таны засварын хуудасны дуусах хугацаа өөрчлөгдлөө.",
      },
    });
  } catch (error) {
    console.warn("[notify] expected_finish_revised:", error instanceof Error ? error.name : "UnknownError");
  }
}

async function notifyRescheduleChange(
  result: { appointment: LockedOrder["appointment"]; previous: Date | null; next: Date },
) {
  if (
    !result.previous ||
    result.previous.getTime() === result.next.getTime() ||
    !result.appointment?.accountId ||
    !["PENDING", "CONFIRMED"].includes(result.appointment.status)
  ) return;
  try {
    await createNotification({
      type: "order_rescheduled",
      recipient: { accountId: result.appointment.accountId },
      input: { appointmentId: result.appointment.id },
    });
  } catch (error) {
    console.warn("[notify] order_rescheduled:", error instanceof Error ? error.name : "UnknownError");
  }
}

export type ReviseExpectedFinishInput = {
  actor: OrderCommandActor;
  orderId: string;
  expectedFinishAt: Date | null;
  confirmed?: boolean;
  scope?: OrderCommandScope;
};

export async function reviseExpectedFinishCommand(input: ReviseExpectedFinishInput) {
  if (input.expectedFinishAt && !Number.isFinite(input.expectedFinishAt.getTime())) {
    throw new OrderScheduleCommandError("Огноо буруу.", 400, "INVALID_DATE", { expectedFinishAt: "Огноо буруу." });
  }
  const result = await withOrderTransaction(
    input.actor.tenantId,
    input.orderId,
    {
      id: true,
      branchId: true,
      status: true,
      assignedToId: true,
      startedAt: true,
      expectedFinishAt: true,
      scheduledAt: true,
      estimatedDurationMinutes: true,
      appointment: { select: { id: true, accountId: true, status: true } },
    },
    async (tx, raw) => {
      const order = raw as LockedOrder | null;
      if (!order) throw new OrderScheduleCommandError("Засварын хуудас олдсонгүй.", 404, "ORDER_NOT_FOUND");
      assertOrderAccess(input.actor, order, input.scope);
      if (isOrderLocked(order.status)) {
        throw new OrderScheduleCommandError("Дууссан / цуцлагдсан захиалгын мэдээлэл засах боломжгүй.", 422, "ORDER_LOCKED");
      }
      if (order.status !== "IN_PROGRESS") {
        throw new OrderScheduleCommandError("Дуусах хугацааг зөвхөн ажиллаж буй захиалгад тохируулна.", 422, "ORDER_STATUS_INVALID");
      }

      const openBookings = await getOpenOrderTimeBookings(tx, order.id);
      const activeStartAt = openBookings.find((booking) => booking.kind === "ACTIVE")?.startAt ?? order.startedAt;
      if (input.expectedFinishAt) {
        if (!activeStartAt) {
          throw new OrderScheduleCommandError("Дуусах хугацаа тохируулахын өмнө ажлын эхэлсэн цагийг тэмдэглэнэ.", 422, "START_TIME_REQUIRED");
        }
        if (input.expectedFinishAt.getTime() <= activeStartAt.getTime()) {
          throw new OrderScheduleCommandError("Дуусах хугацаа эхэлсэн хугацаанаас хойш байх ёстой.", 422, "INVALID_FINISH_TIME", { expectedFinishAt: "Дуусах хугацаа эхэлсэн хугацаанаас хойш байх ёстой." });
        }
        if (!input.confirmed && await expectedFinishNeedsWarning(tx, input.actor.tenantId, order.branchId, activeStartAt, input.expectedFinishAt)) {
          throw new OrderScheduleCommandError("Шинэ дуусах хугацаа салбарын ажиллах цагаас хэтэрч байна. Үргэлжлүүлэхийн тулд дахин хадгална уу.", 409, "CONFIRMATION_REQUIRED", { confirmNeeded: "true" });
        }
      }

      const previous = order.expectedFinishAt;
      await tx.serviceOrder.update({ where: { id: order.id }, data: { expectedFinishAt: input.expectedFinishAt } });
      await updateOpenOrderTimeBookingForecast(tx, order.id, input.expectedFinishAt);
      await logAudit({
        tenantId: input.actor.tenantId,
        userId: input.actor.id,
        entity: "ServiceOrder",
        entityId: order.id,
        action: "UPDATE",
        summary: "Дуусах хугацааг гар аргаар шинэчлэв",
        before: { expectedFinishAt: previous?.toISOString() ?? null },
        after: { expectedFinishAt: input.expectedFinishAt?.toISOString() ?? null },
      }, tx);
      return { orderId: order.id, expectedFinishAt: input.expectedFinishAt, previous, appointment: order.appointment };
    },
  );
  let currentAppointment: LockedOrder["appointment"] = null;
  if (result.appointment?.id) {
    try {
      currentAppointment = await prisma.appointment.findFirst({
        where: {
          id: result.appointment.id,
          tenantId: input.actor.tenantId,
          status: { in: ["PENDING", "CONFIRMED"] },
          accountId: { not: null },
        },
        select: { id: true, accountId: true, status: true },
      });
    } catch (error) {
      console.warn("[notify] expected_finish_revised lookup:", error instanceof Error ? error.name : "UnknownError");
    }
  }
  await notifyExpectedFinishChange({ appointment: currentAppointment, previous: result.previous, next: result.expectedFinishAt });
  return result;
}

export type RescheduleOrderInput = {
  actor: OrderCommandActor;
  orderId: string;
  scheduledAt: Date;
  confirmed?: boolean;
  scope?: OrderCommandScope;
};

export async function rescheduleOrderCommand(input: RescheduleOrderInput) {
  if (!Number.isFinite(input.scheduledAt.getTime())) {
    throw new OrderScheduleCommandError("Огноо буруу.", 400, "INVALID_DATE", { scheduledAt: "Огноо буруу." });
  }
  if (input.scheduledAt.getTime() < Date.now()) {
    throw new OrderScheduleCommandError("Өнгөрсөн цаг сонгох боломжгүй.", 422, "PAST_TIME", { scheduledAt: "Өнгөрсөн цаг сонгох боломжгүй." });
  }

  try {
    const result = await moveLinkedAppointmentOrder({
      tenantId: input.actor.tenantId,
      userId: input.actor.id,
      orderId: input.orderId,
      newTime: input.scheduledAt,
      confirmed: input.confirmed,
      actor: input.actor,
      scope: input.scope,
      allowUnconfirmedOrderMove: true,
    });
    const mapped = {
      orderId: result.orderId,
      branchId: result.branchId,
      previous: result.previousScheduledAt,
      scheduledAt: result.newTime,
      appointment: result.appointmentId
        ? { id: result.appointmentId, accountId: result.appointmentAccountId, status: result.appointmentStatus ?? "CONFIRMED" }
        : null,
    };
    await notifyRescheduleChange({ appointment: mapped.appointment, previous: mapped.previous, next: mapped.scheduledAt });
    return mapped;
  } catch (error) {
    if (error instanceof LinkedRescheduleError) {
      throw new OrderScheduleCommandError(error.message, error.status, error.code, error.fieldErrors);
    }
    throw error;
  }
}
