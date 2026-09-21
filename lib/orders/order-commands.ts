import { Prisma } from "@/app/generated/prisma/client";
import { createNotification } from "@/lib/notifications";
import { canAssignOrders, canEditOrder, type OrderAccessUser } from "@/lib/auth/order-access";
import { ORDER_ASSIGNABLE_WHERE } from "@/lib/auth/roles";
import { parseDurationInput, MIN_CATEGORY_DURATION_MINUTES, MAX_CATEGORY_DURATION_MINUTES } from "@/lib/category-duration";
import { calculateServiceItemDurationMinutes, type ServiceDurationItem } from "@/lib/service-duration";
import { closeOpenOrderTimeBooking, openOrderTimeBooking, withOrderTransaction } from "@/lib/order-time-booking";
import { logAudit } from "@/lib/audit";
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import { recomputeOrderTotal } from "@/lib/orders/order-item-commands";
import {
  ORDER_STATUS_TRANSITIONS,
  isOrderLocked,
  type OrderStatus,
} from "@/lib/orders";

export type OrderCommandActor = OrderAccessUser & {
  tenantId: string;
  branchId?: string | null;
  assignableBranchIds?: string[];
  workingBranchId?: string | null;
};

export type OrderCommandScope = string | null | undefined;

export class OrderCommandError extends Error {
  constructor(
    message: string,
    public readonly status = 422,
    public readonly code = "ORDER_COMMAND_REJECTED",
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "OrderCommandError";
  }
}

export type StatusCommandResult = {
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  statusChanged: boolean;
  previousAssignedToId?: string | null;
};

export type AssignmentCommandResult = {
  orderId: string;
  previousAssignedToId: string | null;
  assignedToId: string | null;
};

function effectiveScope(actor: OrderCommandActor, scope: OrderCommandScope): string | null {
  if (scope !== undefined) return scope;
  return actor.workingBranchId && actor.workingBranchId !== "ALL" ? actor.workingBranchId : null;
}

export function isOrderBranchInScope(
  actor: OrderCommandActor,
  branchId: string,
  scope?: OrderCommandScope,
): boolean {
  const resolved = effectiveScope(actor, scope);
  return resolved == null || resolved === branchId;
}

export function isAllowedOrderStatusTransition(
  current: OrderStatus,
  next: OrderStatus,
): boolean {
  return Boolean(ORDER_STATUS_TRANSITIONS[current]?.includes(next));
}

export function hasRequestedStatusChange(nextStatus: OrderStatus | null | undefined): boolean {
  return nextStatus != null;
}

export function isActiveOrderNotificationAppointmentStatus(status: string | null | undefined): boolean {
  return status === "PENDING" || status === "CONFIRMED";
}

export function isStockBackedOrderItem(kind: string, serviceId: string | null | undefined): boolean {
  return kind === "PART" && Boolean(serviceId);
}

export function parseCommandDuration(
  durationMinutes: unknown,
): { ok: true; minutes: number | null } | { ok: false; error: string } {
  if (durationMinutes == null) return { ok: true, minutes: null };
  if (
    typeof durationMinutes !== "number" ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < MIN_CATEGORY_DURATION_MINUTES ||
    durationMinutes > MAX_CATEGORY_DURATION_MINUTES
  ) {
    return {
      ok: false,
      error: `Ажлыг эхлүүлэхийн өмнө хугацааг ${MIN_CATEGORY_DURATION_MINUTES}–${MAX_CATEGORY_DURATION_MINUTES} минутын бүхэл тоогоор оруулна уу.`,
    };
  }
  return { ok: true, minutes: durationMinutes };
}

export type AssigneeEligibilityInput = {
  isActive: boolean;
  tenantId: string;
  isOwner: boolean;
  branchId: string | null;
  assignableBranchIds: string[];
  firstName?: string | null;
  lastName?: string | null;
  role?: { permissions: string[]; isActive?: boolean } | null;
};

export function isAssigneeEligible(
  assignee: AssigneeEligibilityInput,
  tenantId: string,
  orderBranchId: string,
): boolean {
  if (!assignee.isActive || assignee.tenantId !== tenantId) return false;
  if (assignee.role?.isActive === false) return false;
  const assignableByRole =
    assignee.isOwner || Boolean(assignee.role?.permissions.includes("orders.assignable"));
  if (!assignableByRole) return false;
  return (
    assignee.branchId == null ||
    assignee.branchId === orderBranchId ||
    assignee.assignableBranchIds.includes(orderBranchId)
  );
}

export async function validateOrderAssignee(
  tx: PrismaTransactionClient,
  input: { tenantId: string; assigneeId: string; orderBranchId: string },
): Promise<AssigneeEligibilityInput & { id: string; firstName: string | null; lastName: string | null }> {
  const lockedAssignee = await tx.$queryRaw<{ id: string; roleId: string | null }[]>`
    SELECT id, "roleId" FROM "User"
    WHERE id = ${input.assigneeId} AND "tenantId" = ${input.tenantId}
    FOR UPDATE
  `;
  if (lockedAssignee.length === 0) {
    throw new OrderCommandError("Сонгосон ажилтан олдсонгүй.", 422, "ASSIGNEE_INELIGIBLE");
  }
  const roleId = lockedAssignee[0].roleId;
  if (roleId) {
    const lockedRole = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Role"
      WHERE id = ${roleId} AND "tenantId" = ${input.tenantId}
      FOR UPDATE
    `;
    if (lockedRole.length === 0) {
      throw new OrderCommandError("Сонгосон ажилтан энэ салбарт хариуцагч болж болохгүй.", 422, "ASSIGNEE_INELIGIBLE");
    }
  }
  const assignee = await tx.user.findFirst({
    where: { id: input.assigneeId, tenantId: input.tenantId, isActive: true, ...ORDER_ASSIGNABLE_WHERE },
    select: {
      id: true,
      tenantId: true,
      isActive: true,
      isOwner: true,
      branchId: true,
      assignableBranchIds: true,
      firstName: true,
      lastName: true,
      role: { select: { permissions: true, isActive: true } },
    },
  }) as (AssigneeEligibilityInput & { id: string; firstName: string | null; lastName: string | null }) | null;
  if (!assignee || !isAssigneeEligible(assignee, input.tenantId, input.orderBranchId)) {
    throw new OrderCommandError("Сонгосон ажилтан энэ салбарт хариуцагч болж болохгүй.", 422, "ASSIGNEE_INELIGIBLE");
  }
  return assignee;
}

function assertOrderScope(
  actor: OrderCommandActor,
  branchId: string,
  scope: OrderCommandScope,
): void {
  if (!isOrderBranchInScope(actor, branchId, scope)) {
    throw new OrderCommandError(
      "Зөвхөн өөрийн салбарын засварын хуудсыг удирдана.",
      404,
      "ORDER_OUT_OF_SCOPE",
    );
  }
}

function assertCanEdit(
  actor: OrderCommandActor,
  order: { assignedToId: string | null },
): void {
  if (!canEditOrder(actor, order)) {
    throw new OrderCommandError(
      "Танд энэ засварын хуудсыг засах эрх байхгүй.",
      403,
      "ORDER_EDIT_FORBIDDEN",
    );
  }
}

async function notifyOrderStatusChange(
  orderId: string,
  type: "order_completed" | "order_cancelled" | "order_in_progress",
): Promise<void> {
  try {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: { appointment: { select: { id: true, accountId: true, status: true } } },
    });
    if (!order?.appointment?.accountId || !isActiveOrderNotificationAppointmentStatus(order.appointment.status)) return;
    await createNotification({
      type,
      recipient: { accountId: order.appointment.accountId },
      input: { orderId, appointmentId: order.appointment.id },
    });
  } catch (error) {
    console.warn(`[notify] ${type}:`, error);
  }
}

export async function applyOrderPatchCommand(input: {
  actor: OrderCommandActor;
  orderId: string;
  nextStatus?: OrderStatus | null;
  durationMinutes?: number | null;
  duration?: { hours: string; minutes: string };
  assignedToId?: string | null;
  notes?: string | null;
  scope?: OrderCommandScope;
}): Promise<StatusCommandResult> {
  const { actor, orderId, nextStatus, scope } = input;
  const result = await withOrderTransaction(
    actor.tenantId,
    orderId,
    {
      id: true,
      branchId: true,
      status: true,
      assignedToId: true,
      startedAt: true,
      estimatedDurationMinutes: true,
      items: {
        where: { status: { not: "CANCELLED" } },
        select: {
          kind: true,
          status: true,
          quantity: true,
          serviceId: true,
          service: {
            select: {
              durationValue: true,
              durationUnit: { select: { name: true, code: true } },
            },
          },
          diagnosticTemplate: { select: { durationMin: true } },
        },
      },
    },
    async (tx, raw) => {
      const order = raw as {
        id: string;
        branchId: string;
        status: OrderStatus;
        assignedToId: string | null;
        startedAt: Date | null;
        estimatedDurationMinutes: number | null;
        items: Array<ServiceDurationItem & { serviceId: string | null }>;
      } | null;
      if (!order) throw new OrderCommandError("Засварын хуудас олдсонгүй.", 404, "ORDER_NOT_FOUND");
      assertOrderScope(actor, order.branchId, scope);
      const editsOrderFields = nextStatus != null || input.notes !== undefined;
      if (editsOrderFields) assertCanEdit(actor, order);
      if (input.assignedToId !== undefined && !canAssignOrders(actor)) {
        throw new OrderCommandError("Зөвхөн orders.assign эрхтэй хэрэглэгч хариуцагч өөрчилж болно.", 403, "ORDER_ASSIGN_FORBIDDEN");
      }
      if (isOrderLocked(order.status) && nextStatus == null) {
        throw new OrderCommandError(
          "Дууссан / цуцлагдсан засварын хуудсанд мэдээлэл засах боломжгүй.",
          422,
          "ORDER_LOCKED",
        );
      }
      if (nextStatus != null && !isAllowedOrderStatusTransition(order.status, nextStatus)) {
        throw new OrderCommandError("Энэ статус руу шилжих боломжгүй.", 422, "INVALID_STATUS_TRANSITION");
      }

      if (nextStatus === "COMPLETED") {
        const pending = await tx.serviceItem.count({
          where: {
            orderId,
            kind: "DIAGNOSTIC",
            status: { not: "CANCELLED" },
            diagnosticReportId: null,
          },
        });
        if (pending > 0) {
          throw new OrderCommandError(
            "Бөглөгдөөгүй оношилгоо байна. Бүх оношилгоог бөглөсний дараа засварын хуудсыг дуусгана уу.",
            422,
            "DIAGNOSTIC_REPORT_REQUIRED",
          );
        }
      }

      const enteringInProgress = nextStatus === "IN_PROGRESS";
      const startingFresh = enteringInProgress && order.status === "SCHEDULED";
      let effectiveDurationMinutes = order.estimatedDurationMinutes;
      const itemDuration = enteringInProgress
        ? calculateServiceItemDurationMinutes(order.items)
        : null;
      if (effectiveDurationMinutes == null && itemDuration != null) {
        effectiveDurationMinutes = itemDuration;
      }
      if (enteringInProgress && effectiveDurationMinutes == null) {
        const parsed = input.duration
          ? parseActionDuration(input.duration.hours, input.duration.minutes)
          : parseCommandDuration(input.durationMinutes);
        if (!parsed.ok || parsed.minutes == null) {
          throw new OrderCommandError(
            parsed.ok ? "Ажлыг эхлүүлэхийн өмнө ойролцоо үргэлжлэх хугацааг оруулна уу." : parsed.error,
            422,
            "DURATION_REQUIRED",
            { duration: parsed.ok ? "Ажлыг эхлүүлэхийн өмнө ойролцоо үргэлжлэх хугацааг оруулна уу." : parsed.error },
          );
        }
        effectiveDurationMinutes = parsed.minutes;
      }

      const now = new Date();
      const startedAt = startingFresh ? now : order.startedAt;
      const completedAt = nextStatus === "COMPLETED" ? new Date() : undefined;
      const updates: Prisma.ServiceOrderUpdateInput = {
        ...(nextStatus != null ? { status: nextStatus } : {}),
        ...(startingFresh ? { startedAt } : {}),
        ...(startingFresh && effectiveDurationMinutes !== order.estimatedDurationMinutes
          ? { estimatedDurationMinutes: effectiveDurationMinutes }
          : {}),
        ...(completedAt ? { completedAt } : {}),
        ...(nextStatus != null
          ? { occupiesCapacity: nextStatus === "COMPLETED" || nextStatus === "CANCELLED" ? false : true }
          : {}),
        ...(enteringInProgress && effectiveDurationMinutes != null && startedAt
          ? { expectedFinishAt: new Date(startedAt.getTime() + effectiveDurationMinutes * 60000) }
          : {}),
      };
      let assigneeDisplayName: string | null = null;
      if (nextStatus != null || input.notes !== undefined || input.assignedToId !== undefined) {
        if (input.assignedToId !== undefined) {
          if (input.assignedToId) {
            const assignee = await validateOrderAssignee(tx, {
              tenantId: actor.tenantId,
              assigneeId: input.assignedToId,
              orderBranchId: order.branchId,
            });
            assigneeDisplayName = [assignee.lastName, assignee.firstName].filter(Boolean).join(" ").trim() || null;
          }
          updates.assignedTo = input.assignedToId
            ? { connect: { id: input.assignedToId } }
            : { disconnect: true };
        }
        if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;
        await tx.serviceOrder.update({ where: { id: orderId }, data: updates });
      }

      if (enteringInProgress) {
        await closeOpenOrderTimeBooking(tx, orderId, now, "all");
        await openOrderTimeBooking(tx, {
          tenantId: actor.tenantId,
          orderId,
          branchId: order.branchId,
          kind: "ACTIVE",
          startAt: now,
          endAt: (updates.expectedFinishAt as Date | undefined) ?? null,
          createdById: actor.id,
        });
      } else if (nextStatus === "COMPLETED") {
        await closeOpenOrderTimeBooking(tx, orderId, completedAt as Date, "ACTIVE");
      } else if (nextStatus === "CANCELLED") {
        await closeOpenOrderTimeBooking(tx, orderId, now, "all");
        for (const item of order.items) {
          if (!isStockBackedOrderItem(item.kind, item.serviceId)) continue;
          await tx.service.update({
            where: { id: item.serviceId as string },
            data: { stock: { increment: new Prisma.Decimal(item.quantity.toString()) } },
          });
          await logAudit({
            tenantId: actor.tenantId,
            userId: actor.id,
            entity: "Service",
            entityId: item.serviceId as string,
            action: "STOCK_CHANGE",
            summary: `+${item.quantity.toString()} (захиалга цуцлагдсан)`,
            after: { delta: `+${item.quantity.toString()}`, reason: "ORDER_CANCEL" },
          }, tx);
        }
        await tx.serviceItem.updateMany({
          where: { orderId, status: { not: "CANCELLED" } },
          data: { status: "CANCELLED", cancelledAt: now, cancelledById: actor.id },
        });
        await recomputeOrderTotal(tx, orderId);
      }

      if (nextStatus != null) await logAudit(
        {
          tenantId: actor.tenantId,
          userId: actor.id,
          entity: "ServiceOrder",
          entityId: orderId,
          action: "STATUS_CHANGE",
          summary: `${order.status} → ${nextStatus}`,
          before: { status: order.status },
          after: { status: nextStatus },
        },
        tx,
      );
      if (input.assignedToId !== undefined && input.assignedToId !== order.assignedToId) {
        await logAudit({ tenantId: actor.tenantId, userId: actor.id, entity: "ServiceOrder", entityId: orderId, action: "UPDATE", summary: input.assignedToId ? `Хариуцагч: ${assigneeDisplayName ?? input.assignedToId}` : "Хариуцагчийг арилгав", before: { assignedToId: order.assignedToId }, after: { assignedToId: input.assignedToId } }, tx);
      }
      return {
        orderId,
        fromStatus: order.status,
        toStatus: nextStatus ?? order.status,
        statusChanged: nextStatus != null,
        previousAssignedToId: order.assignedToId,
      };
    },
  );

  if (result.statusChanged && result.toStatus === "COMPLETED") await notifyOrderStatusChange(orderId, "order_completed");
  else if (result.statusChanged && result.toStatus === "CANCELLED") await notifyOrderStatusChange(orderId, "order_cancelled");
  else if (result.statusChanged && result.toStatus === "IN_PROGRESS") await notifyOrderStatusChange(orderId, "order_in_progress");
  return result;
}

export async function changeOrderStatusCommand(input: {
  actor: OrderCommandActor;
  orderId: string;
  nextStatus: OrderStatus;
  durationMinutes?: number | null;
  duration?: { hours: string; minutes: string };
  scope?: OrderCommandScope;
}): Promise<StatusCommandResult> {
  return applyOrderPatchCommand(input);
}

export async function assignOrderCommand(input: {
  actor: OrderCommandActor;
  orderId: string;
  assignedToId: string | null;
  scope?: OrderCommandScope;
}): Promise<AssignmentCommandResult> {
  const { actor, orderId, assignedToId, scope } = input;
  const patched = await applyOrderPatchCommand({ actor, orderId, assignedToId, scope });
  return {
    orderId,
    previousAssignedToId: patched.previousAssignedToId ?? null,
    assignedToId,
  };
}

export async function deleteOrderCommand(input: {
  actor: OrderCommandActor;
  orderId: string;
  scope?: OrderCommandScope;
}): Promise<{ orderId: string; number: string | null }> {
  const { actor, orderId, scope } = input;
  return withOrderTransaction(
    actor.tenantId,
    orderId,
    { id: true, number: true, branchId: true, assignedToId: true },
    async (tx, raw) => {
      const order = raw as { id: string; number: string; branchId: string; assignedToId: string | null } | null;
      if (!order) throw new OrderCommandError("Засварын хуудас олдсонгүй.", 404, "ORDER_NOT_FOUND");
      assertOrderScope(actor, order.branchId, scope);
      const paid = await tx.orderPayment.findFirst({
        where: { orderId, tenantId: actor.tenantId, status: "PAID" },
        select: { id: true },
      });
      if (paid) {
        throw new OrderCommandError(
          "Энэ засварын хуудсанд төлбөр төлөгдсөн тул устгах боломжгүй.",
          422,
          "PAID_PAYMENT_EXISTS",
        );
      }
      await tx.orderPayment.deleteMany({
        where: { orderId, tenantId: actor.tenantId, status: { not: "PAID" } },
      });
      await tx.serviceOrder.delete({ where: { id: orderId, tenantId: actor.tenantId } });
      await logAudit(
        {
          tenantId: actor.tenantId,
          userId: actor.id,
          entity: "ServiceOrder",
          entityId: orderId,
          action: "DELETE",
          summary: `#${order.number}`,
        },
        tx,
      );
      return { orderId, number: order.number };
    },
  );
}

/** Adapter helper for the FormData action's hours/minutes inputs. */
export function parseActionDuration(hours: string, minutes: string):
  | { ok: true; minutes: number | null }
  | { ok: false; error: string } {
  return parseDurationInput(hours, minutes);
}
