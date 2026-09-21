import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { DEFAULT_SLOT_MINUTES } from "@/lib/appointment-slots";
import { validateScheduledOrderHours } from "@/lib/order-schedule-validation";
import { openOrderTimeBooking } from "@/lib/order-time-booking";
import { nextOrderNumber } from "@/lib/order-number";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { enforceCountLimit } from "@/lib/plan-limits-server";
import { prisma, withBookingTransaction, type PrismaTransactionClient } from "@/lib/prisma";
import { ensureTenantVehicle } from "@/lib/vehicles";
import { validateOrderAssignee, OrderCommandError } from "@/lib/orders/order-commands";
import { validateOrderReferences } from "@/lib/orders/order-create-references";

export type CreateOrderCommandInput = {
  tenantId: string;
  actorId: string;
  branchId: string;
  customerId: string;
  vehicleId: string;
  assignedToId: string | null;
  scheduledAt: Date | null;
  notes: string | null;
  appointmentId?: string | null;
  estimatedDurationMinutes?: number | null;
  workingBranchId?: string | null;
};

export type CreateOrderCommandResult = {
  id: string;
  number: string;
};

function branchSlotMinutes(value: number | null | undefined): number {
  return value && value > 0 ? value : DEFAULT_SLOT_MINUTES;
}

function todayStart(): Date {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

async function enforceCreateLimits(tenantId: string): Promise<void> {
  const daily = await enforceCountLimit(
    tenantId,
    PLAN_LIMIT_CODES.DAILY_ORDERS,
    () => prisma.serviceOrder.count({
      where: { tenantId, createdAt: { gte: todayStart() } },
    }),
  );
  if (!daily.allowed) {
    throw new OrderCommandError(daily.message ?? "Өдрийн захиалгын хязгаарт хүрсэн байна.", 422, "PLAN_LIMIT_REACHED");
  }

  const active = await enforceCountLimit(
    tenantId,
    PLAN_LIMIT_CODES.MAX_ACTIVE_ORDERS,
    () => prisma.serviceOrder.count({
      where: { tenantId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
    }),
  );
  if (!active.allowed) {
    throw new OrderCommandError(active.message ?? "Идэвхтэй захиалгын хязгаарт хүрсэн байна.", 422, "PLAN_LIMIT_REACHED");
  }
}

export async function createOrderCommand(
  input: CreateOrderCommandInput,
): Promise<CreateOrderCommandResult> {
  if (input.workingBranchId && input.workingBranchId !== "ALL" && input.branchId !== input.workingBranchId) {
    throw new OrderCommandError(
      "Зөвхөн өөрийн салбарт засварын хуудас үүсгэх боломжтой.",
      422,
      "ORDER_OUT_OF_SCOPE",
      { branchId: "Зөвхөн өөрийн салбарт засварын хуудас үүсгэх боломжтой." },
    );
  }

  await enforceCreateLimits(input.tenantId);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await withBookingTransaction(input.tenantId, async (tx) => {
        const [branch, customer, vehicle, appointment] = await Promise.all([
          tx.branch.findFirst({
            where: { id: input.branchId, tenantId: input.tenantId },
            select: { id: true, slotMinutes: true, isActive: true },
          }),
          tx.customer.findFirst({
            where: { id: input.customerId, tenantId: input.tenantId },
            select: { id: true },
          }),
          tx.tenantVehicle.findUnique({
            where: {
              tenantId_vehicleId: { tenantId: input.tenantId, vehicleId: input.vehicleId },
            },
            select: { vehicleId: true, customerId: true, isPostpaid: true },
          }),
          input.appointmentId
            ? tx.appointment.findFirst({
                where: { id: input.appointmentId, tenantId: input.tenantId },
                select: {
                  id: true,
                  customerId: true,
                  accountId: true,
                  vehicleId: true,
                  serviceOrderId: true,
                  branchId: true,
                  estimatedDurationMinutes: true,
                  arrivedAt: true,
                  categoryId: true,
                  category: { select: { name: true } },
                  categories: {
                    orderBy: { createdAt: "asc" },
                    select: { categoryId: true, category: { select: { name: true } } },
                  },
                },
              })
            : Promise.resolve(null),
        ]);

        if (input.assignedToId && branch) {
          // This runs after the order-number lock below; the authoritative
          // assignee and role rows are then locked before the order write.
        }

        let accountVehicleToLink = false;
        if (!vehicle && appointment?.accountId && appointment.customerId === input.customerId) {
          const accountVehicle = await tx.accountVehicle.findFirst({
            where: { accountId: appointment.accountId, vehicleId: input.vehicleId },
            select: { vehicleId: true },
          });
          accountVehicleToLink = Boolean(accountVehicle);
        }

        const fieldErrors = validateOrderReferences({
          branchId: input.branchId,
          customerId: input.customerId,
          vehicleId: input.vehicleId,
          appointmentId: input.appointmentId,
          branch,
          customer,
          vehicle,
          appointment,
          accountVehicleToLink,
        });
        if (Object.keys(fieldErrors).length > 0) {
          throw new OrderCommandError("Хүсэлт буруу.", 422, "ORDER_CREATE_INVALID", fieldErrors);
        }

        const scopedTx = tx as unknown as PrismaTransactionClient;
        const slotMinutes = branchSlotMinutes(branch?.slotMinutes);
        const durationMinutes = input.appointmentId
          ? appointment?.estimatedDurationMinutes ?? (input.scheduledAt ? slotMinutes : null)
          : input.estimatedDurationMinutes ?? (input.scheduledAt ? slotMinutes : null);
        const scheduledHoursError = await validateScheduledOrderHours(
          scopedTx,
          input.tenantId,
          input.branchId,
          input.scheduledAt,
          durationMinutes ?? slotMinutes,
        );
        if (scheduledHoursError) {
          throw new OrderCommandError(scheduledHoursError, 422, "SCHEDULED_OUTSIDE_BUSINESS_HOURS", {
            scheduledAt: scheduledHoursError,
          });
        }

        const number = await nextOrderNumber(tx, input.tenantId);
        if (input.assignedToId) {
          await validateOrderAssignee(scopedTx, {
            tenantId: input.tenantId,
            assigneeId: input.assignedToId,
            orderBranchId: input.branchId,
          });
        }
        if (accountVehicleToLink) {
          await ensureTenantVehicle(scopedTx, {
            tenantId: input.tenantId,
            vehicleId: input.vehicleId,
            customerId: input.customerId,
          });
        }

        const bookingStartAt = input.scheduledAt ?? new Date();
        const created = await tx.serviceOrder.create({
          data: {
            number,
            status: "SCHEDULED",
            tenantId: input.tenantId,
            branchId: input.branchId,
            customerId: input.customerId,
            vehicleId: input.vehicleId,
            assignedToId: input.assignedToId,
            scheduledAt: input.scheduledAt,
            notes: input.notes,
            isPostpaid: vehicle?.isPostpaid ?? false,
            estimatedDurationMinutes: durationMinutes,
            categories: appointment && (appointment.categories.length > 0 || (appointment.categoryId && appointment.category))
              ? {
                  create: (appointment.categories.length > 0
                    ? appointment.categories.map((entry) => ({ categoryId: entry.categoryId, name: entry.category.name }))
                    : [{ categoryId: appointment.categoryId as string, name: appointment.category?.name as string }]
                  ).map((category) => ({ tenantId: input.tenantId, ...category })),
                }
              : undefined,
          },
          select: { id: true, number: true },
        });

        await openOrderTimeBooking(scopedTx, {
          tenantId: input.tenantId,
          orderId: created.id,
          branchId: input.branchId,
          kind: "SCHEDULED",
          startAt: bookingStartAt,
          endAt: durationMinutes != null
            ? new Date(bookingStartAt.getTime() + durationMinutes * 60000)
            : null,
          createdById: input.actorId,
        });

        if (input.appointmentId) {
          const linked = await tx.appointment.updateMany({
            where: {
              id: input.appointmentId,
              tenantId: input.tenantId,
              branchId: input.branchId,
              customerId: input.customerId,
              ...(appointment?.accountId ? { accountId: appointment.accountId } : {}),
              serviceOrderId: null,
            },
            data: {
              serviceOrderId: created.id,
              status: "CONFIRMED",
              ...(accountVehicleToLink ? { vehicleId: input.vehicleId } : {}),
              ...(appointment && !appointment.arrivedAt ? { arrivedAt: new Date() } : {}),
            },
          });
          if (linked.count !== 1) {
            throw new OrderCommandError("Цаг захиалгыг засварын хуудастай холбож чадсангүй.", 422, "APPOINTMENT_LINK_FAILED");
          }
          await logAudit({
            tenantId: input.tenantId,
            userId: input.actorId,
            entity: "Appointment",
            entityId: input.appointmentId,
            action: "STATUS_CHANGE",
            summary: "Цаг захиалга засварын хуудастай холбогдов",
            after: { serviceOrderId: created.id, status: "CONFIRMED" },
          },
          scopedTx);
        }

        await logAudit({
          tenantId: input.tenantId,
          userId: input.actorId,
          entity: "ServiceOrder",
          entityId: created.id,
          action: "CREATE",
          summary: "Засварын хуудас үүсгэсэн",
          after: {
            branchId: input.branchId,
            customerId: input.customerId,
            vehicleId: input.vehicleId,
            assignedToId: input.assignedToId,
            scheduledAt: input.scheduledAt?.toISOString() ?? null,
          },
        }, scopedTx);

        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  throw new OrderCommandError("Засварын хуудасны дугаар үүсгэж чадсангүй. Дахин оролдоно уу.", 500, "ORDER_NUMBER_UNAVAILABLE");
}
