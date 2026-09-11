"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import {
  canCreate,
  canDelete,
  canEdit,
  canView,
  hasPermission,
  workingBranchScopeId,
} from "@/lib/auth/roles";
import { assertActiveSubscription } from "@/lib/subscription-server";
import { parseDurationInput } from "@/lib/category-duration";
import { calculateServiceItemDurationMinutes, type ServiceDurationItem } from "@/lib/service-duration";
import {
  closeOpenOrderTimeBooking,
  openOrderTimeBooking,
  updateOpenOrderTimeBookingForecast,
  updateOpenOrderTimeBookingSchedule,
  getOpenOrderTimeBookings,
  withOrderTransaction,
} from "@/lib/order-time-booking";
import {
  findScheduleConflict,
  getBranchSlotMinutes,
  validateScheduledOrderHours,
} from "@/lib/order-schedule-validation";
import { postponeOrderCore } from "@/lib/order-postpone";
import { moveLinkedAppointmentOrder, LinkedRescheduleError } from "@/lib/linked-reschedule";
import {
  ITEM_KINDS,
  ORDER_STATUS_TRANSITIONS,
  SERVICE_ITEM_STATUSES,
  canChangeServiceItemStatus,
  isOrderLocked,
  isServiceItemCancellable,
  type ItemKind,
  type OrderPostponeReasonTag,
  type OrderStatus,
  type ServiceItemStatus,
} from "@/lib/orders";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { enforceCountLimit } from "@/lib/plan-limits-server";
import { prisma, withBookingTransaction, type PrismaTransactionClient } from "@/lib/prisma";
import { bookingDateKey, bookingDayBounds, parseBusinessLocalDateTime } from "@/lib/booking-time";
import { resolveEffectiveSchedule } from "@/lib/branch-effective-schedule";
import { branchScheduleForDateSelect } from "@/lib/branch-effective-schedule-server";
import { timeToMinutes } from "@/lib/branches";
import { DEFAULT_SLOT_MINUTES } from "@/lib/appointment-slots";
import { safeNext } from "@/lib/safe-redirect";
import { ensureTenantVehicle } from "@/lib/vehicles";
import { nextOrderNumber } from "@/lib/order-number";
import { canEditOrder, canAssignOrders, canChangeOrderItemStatus } from "@/lib/auth/order-access";

export type OrderActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

// S06 fix: validation that happens INSIDE a withOrderTransaction lock (i.e.
// against the freshly re-read row, not any earlier pre-lock read) throws this
// instead of returning early, so it can carry fieldErrors back out through
// the transaction boundary. Plain Error still works for messages alone.
class OrderActionValidationError extends Error {
  fieldErrors?: Record<string, string>;
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

function orderActionErrorResult(e: unknown): OrderActionState {
  if (e instanceof OrderActionValidationError) {
    return { ok: false, message: e.message || undefined, fieldErrors: e.fieldErrors };
  }
  return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
}

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function parseDecimal(v: string): Prisma.Decimal | null {
  if (!v) return null;
  const cleaned = v.replace(/[,\s]/g, "");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return new Prisma.Decimal(cleaned);
}

async function authorize(action: "create" | "edit" | "delete") {
  const user = await requireUser();
  const ok =
    action === "create"
      ? canCreate(user, "orders")
      : action === "edit"
        ? canEdit(user, "orders")
        : canDelete(user, "orders");
  if (!ok) {
    throw new Error("Танд засварын хуудсанд энэ үйлдэл хийх эрх байхгүй.");
  }
  await assertActiveSubscription(user.tenantId);
  return user;
}

// Салбараар хязгаарлагдсан ажилтан зөвхөн өөрийн салбарын захиалгыг
// удирдана — createOrderAction/updateOrderAction-д аль хэдийн байсан адил
// шалгалт, бусад бүх захиалгын action-д мөн адилхан хэрэглэнэ (өмнө нь зөвхөн
// tenantId шалгадаг байсан тул өөр салбарын захиалгын ID мэдвэл салбарын
// хязгаарлалтыг тойрч болдог байсан цоорхой — appointments.ts-ийн
// assertStaffScope-той адил зарчим).
function assertOrderBranchScope(
  user: Awaited<ReturnType<typeof requireUser>>,
  branchId: string,
) {
  const scope = workingBranchScopeId(user);
  if (scope && branchId !== scope) {
    throw new Error("Зөвхөн өөрийн салбарын засварын хуудсыг удирдана.");
  }
}

async function assertOrderEditAccess(user: Awaited<ReturnType<typeof requireUser>>, id: string) {
  const order = await prisma.serviceOrder.findFirst({
    where: { id, tenantId: user.tenantId }, select: { assignedToId: true, branchId: true },
  });
  if (!order) throw new Error("Засварын хуудас олдсонгүй.");
  assertOrderBranchScope(user, order.branchId);
  if (!canEditOrder(user, order)) throw new Error("Танд энэ засварын хуудсыг засах эрх байхгүй.");
}

// Захиалгын товлосон огноо шилжсэнийг холбогдох цаг захиалгын account-д
// мэдэгдэнэ — reviseExpectedFinishAction-ийн expected_finish_revised-тэй адил
// зарчим: анхны товлолт (previous == null) мэдэгдэхгүй, зөвхөн цуцлагдаагүй/
// ирээгүй биш (PENDING/CONFIRMED) идэвхтэй цаг захиалгын account-д л илгээнэ
// (харах: reviseExpectedFinishAction-д олдсон "цуцалсан цагт мэдэгдэх" алдаа).
async function notifyOrderRescheduled(
  appointment: { id: string; accountId: string | null; status: string } | null,
  previous: Date | null,
  next: Date,
): Promise<void> {
  if (!previous || previous.getTime() === next.getTime()) return;
  if (!appointment?.accountId) return;
  const isActive = appointment.status === "PENDING" || appointment.status === "CONFIRMED";
  if (!isActive) return;
  try {
    await createNotification({
      type: "order_rescheduled",
      recipient: { accountId: appointment.accountId },
      input: { appointmentId: appointment.id },
    });
  } catch (e) {
    console.warn("[notify] order_rescheduled:", e);
  }
}

// Мөрийн явц өөрчлөх нь орлогын хуудсанд ерөнхий засах эрхээс тусдаа,
// `orders.itemStatus` тусгай эрхээр хамгаалагдана (харах: lib/auth/permissions.ts).
async function authorizeItemStatus() {
  const user = await requireUser();
  if (!hasPermission(user, "orders.itemStatus")) {
    throw new Error("Танд үйлчилгээний мөрийн явц өөрчлөх эрх байхгүй.");
  }
  await assertActiveSubscription(user.tenantId);
  return user;
}

// `client` заавал биш — өгөгдөөгүй бол суурь prisma ашиглана. Мөр
// нэмэх/цуцлах $transaction-ы дотроос `tx`-ээ дамжуулж дуудна, ингэснээр
// нийт дүнг дахин тооцох нь мөрийн бичилттэй ижил транзакцад орж, зэрэгцээ
// мөр өөрчлөлт хоорондоо уралдаж (race) хуучин снапшот дээр бичихээс сэргийлнэ.
async function recomputeTotal(
  orderId: string,
  client: PrismaTransactionClient | typeof prisma = prisma,
): Promise<void> {
  // Цуцлагдсан (CANCELLED) мөрийг нийт дүнд оруулахгүй.
  const items = await client.serviceItem.findMany({
    where: { orderId, status: { not: "CANCELLED" } },
    select: { total: true },
  });
  const total = items.reduce(
    (acc, it) => acc.plus(it.total),
    new Prisma.Decimal(0),
  );
  await client.serviceOrder.update({
    where: { id: orderId },
    data: { totalAmount: total },
  });
}

// --- CREATE ---------------------------------------------------------------

type OrderInput = {
  branchId: string;
  customerId: string;
  vehicleId: string;
  assignedToId: string | null;
  scheduledAt: Date | null;
  notes: string | null;
};

function parseOrderInput(fd: FormData): {
  data: OrderInput;
  errors: Record<string, string>;
} {
  const branchId = s(fd, "branchId");
  const customerId = s(fd, "customerId");
  const vehicleId = s(fd, "vehicleId");
  const assignedToId = s(fd, "assignedToId");
  const scheduledRaw = s(fd, "scheduledAt");
  const notes = s(fd, "notes");

  const errors: Record<string, string> = {};
  if (!branchId) errors.branchId = "Салбар сонгоно уу.";
  if (!customerId) errors.customerId = "Үйлчлүүлэгчээ сонгоно уу.";
  if (!vehicleId) errors.vehicleId = "Машинаа сонгоно уу.";

  let scheduledAt: Date | null = null;
  if (scheduledRaw) {
    const d = parseBusinessLocalDateTime(scheduledRaw);
    if (!Number.isFinite(d.getTime())) {
      errors.scheduledAt = "Огноо буруу.";
    } else {
      scheduledAt = d;
    }
  }

  return {
    data: {
      branchId,
      customerId,
      vehicleId,
      assignedToId: assignedToId || null,
      scheduledAt,
      notes: notes || null,
    },
    errors,
  };
}

async function validateRefs(
  tenantId: string,
  data: OrderInput,
  appointmentId: string | null,
) {
  const errors: Record<string, string> = {};
  const [branch, customer, vehicle, assignee, appointment] = await Promise.all([
    data.branchId
      ? prisma.branch.findFirst({
          where: { id: data.branchId, tenantId },
          select: { id: true, slotMinutes: true },
        })
      : null,
    data.customerId
      ? prisma.customer.findFirst({
          where: { id: data.customerId, tenantId },
          select: { id: true },
        })
      : null,
    data.vehicleId
      ? prisma.tenantVehicle.findUnique({
          where: {
            tenantId_vehicleId: { tenantId, vehicleId: data.vehicleId },
          },
          select: { vehicleId: true, customerId: true, isPostpaid: true },
        })
      : null,
    data.assignedToId
      ? prisma.user.findFirst({
          where: { id: data.assignedToId, tenantId },
          select: { id: true },
        })
      : Promise.resolve(null),
    appointmentId
      ? prisma.appointment.findFirst({
          where: { id: appointmentId, tenantId },
          select: {
            id: true,
            customerId: true,
            accountId: true,
            vehicleId: true,
            serviceOrderId: true,
            estimatedDurationMinutes: true,
            arrivedAt: true,
            categoryId: true,
            category: { select: { name: true } },
            categories: {
              orderBy: { createdAt: "asc" },
              select: {
                categoryId: true,
                category: { select: { name: true } },
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  if (data.branchId && !branch) errors.branchId = "Салбар олдсонгүй.";
  if (data.customerId && !customer) errors.customerId = "Үйлчлүүлэгч олдсонгүй.";
  if (data.assignedToId && !assignee) errors.assignedToId = "Ажилтан олдсонгүй.";

  if (appointmentId && !appointment) {
    errors.appointmentId = "Цаг захиалга олдсонгүй.";
  } else if (appointmentId && appointment?.serviceOrderId) {
    errors.appointmentId = "Энэ цаг захиалгад засварын хуудас аль хэдийн үүссэн байна.";
  } else if (appointmentId && appointment?.customerId !== data.customerId) {
    errors.customerId = "Цаг захиалгын үйлчлүүлэгчтэй таарахгүй байна.";
  }

  if (
    appointmentId &&
    appointment?.vehicleId &&
    appointment.vehicleId !== data.vehicleId
  ) {
    errors.vehicleId = "Энэ цаг захиалгад өөр машин холбогдсон байна.";
  }

  // The customer may add a car after the appointment was confirmed. That car
  // exists as an AccountVehicle, but the tenant order form only knows about
  // TenantVehicle rows. Permit this path only for the appointment's account
  // and customer; the link is created together with the order below.
  let accountVehicleToLink = false;
  if (!vehicle && appointment?.accountId && appointment.customerId === data.customerId) {
    const accountVehicle = await prisma.accountVehicle.findFirst({
      where: {
        accountId: appointment.accountId,
        vehicleId: data.vehicleId,
      },
      select: { vehicleId: true },
    });
    if (accountVehicle) accountVehicleToLink = true;
  }

  if (vehicle && data.customerId && vehicle.customerId !== data.customerId) {
    errors.vehicleId = "Энэ машин сонгосон үйлчлүүлэгчийнх биш.";
  }

  if (!vehicle && !accountVehicleToLink && data.vehicleId) {
    errors.vehicleId = "Машин олдсонгүй.";
  }

  // Машины дараа төлбөрт төлөв — захиалга руу snapshot хийхэд ашиглана.
  return {
    errors,
    vehicleIsPostpaid: vehicle?.isPostpaid ?? false,
    accountVehicleToLink,
    branchSlotMinutes: branch?.slotMinutes && branch.slotMinutes > 0
      ? branch.slotMinutes
      : DEFAULT_SLOT_MINUTES,
    appointmentAccountId: appointment?.accountId ?? null,
    appointmentEstimatedDurationMinutes: appointment?.estimatedDurationMinutes ?? null,
    appointmentNeedsArrival: Boolean(appointment) && !appointment?.arrivedAt,
    appointmentCategorySnapshots:
      appointment?.categories.length
        ? appointment.categories.map((entry) => ({
            categoryId: entry.categoryId,
            name: entry.category.name,
          }))
        : appointment?.categoryId && appointment.category
          ? [{ categoryId: appointment.categoryId, name: appointment.category.name }]
          : [],
  };
}

export async function createOrderAction(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  let user;
  try {
    user = await authorize("create");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = parseOrderInput(formData);
  if (!canAssignOrders(user)) {
    if (data.assignedToId && data.assignedToId !== user.id) {
      return { ok: false, message: "Зөвхөн өөрийгөө хариуцагчаар оноож болно." };
    }
    data.assignedToId = user.id;
  }
  const appointmentId = s(formData, "appointmentId") || null;
  // Walk-in (цаг захиалгагүй) захиалгад л гараар ойролцоо хугацаа авна —
  // цаг захиалгаас үүссэн бол хугацаа автоматаар удамшина (доор), тул энд
  // давхар асуухгүй.
  let walkInEstimatedDurationMinutes: number | null = null;
  if (!appointmentId) {
    const durationParse = parseDurationInput(
      s(formData, "durationHours"),
      s(formData, "durationMinutes"),
    );
    if (durationParse.ok) {
      walkInEstimatedDurationMinutes = durationParse.minutes;
    } else {
      errors.durationMinutes = durationParse.error;
    }
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  const {
    errors: refErrors,
    vehicleIsPostpaid,
    accountVehicleToLink,
    appointmentAccountId,
    appointmentEstimatedDurationMinutes,
    appointmentNeedsArrival,
    appointmentCategorySnapshots,
    branchSlotMinutes,
  } = await validateRefs(
    user.tenantId,
    data,
    appointmentId,
  );
  if (Object.keys(refErrors).length > 0) {
    return { ok: false, fieldErrors: refErrors };
  }

  // Салбараар хязгаарлагдсан ажилтан зөвхөн өөрийн салбарт захиалга үүсгэнэ.
  const scope = workingBranchScopeId(user);
  if (scope && data.branchId !== scope) {
    return {
      ok: false,
      fieldErrors: { branchId: "Зөвхөн өөрийн салбарт засварын хуудас үүсгэх боломжтой." },
    };
  }

  const scheduledHoursError = await validateScheduledOrderHours(
    user.tenantId,
    data.branchId,
    data.scheduledAt,
    appointmentId
      ? appointmentEstimatedDurationMinutes ?? branchSlotMinutes
      : walkInEstimatedDurationMinutes ?? branchSlotMinutes,
  );
  if (scheduledHoursError) {
    return { ok: false, fieldErrors: { scheduledAt: scheduledHoursError } };
  }

  // Товлосон цаг өөр ажилтай давхцаж болзошгүй — updateOrderAction-той адил
  // зөвхөн анхааруулга, хатуу хориглол биш (D-хугацааны шийдвэр,
  // COWORK.md-г үз). Шинэ захиалга тул хасах ID алга ("", хэзээ ч бодит
  // захиалгын ID-тай тэнцэхгүй).
  const confirmed = s(formData, "confirmed") === "true";
  if (data.scheduledAt && !confirmed) {
    const durationMinutes = appointmentId
      ? appointmentEstimatedDurationMinutes ?? branchSlotMinutes
      : walkInEstimatedDurationMinutes ?? branchSlotMinutes;
    const conflictEnd = new Date(data.scheduledAt.getTime() + durationMinutes * 60000);
    const conflict = await findScheduleConflict(
      user.tenantId,
      data.branchId,
      "",
      data.scheduledAt,
      conflictEnd,
    );
    if (conflict) {
      return {
        ok: false,
        message:
          conflict.certainty === "possible"
            ? `Товлосон огноо ${conflict.label}-тай давхцах магадлалтай. Үргэлжлүүлэхийн тулд дахин "Захиалга үүсгэх" дарна уу.`
            : `Товлосон огноо ${conflict.label}-тай давхцаж байна. Үргэлжлүүлэхийн тулд дахин "Захиалга үүсгэх" дарна уу.`,
        fieldErrors: { confirmNeeded: "true" },
      };
    }
  }

  // Багцын хязгаар: daily_orders + max_active_orders
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dailyLimit = await enforceCountLimit(
    user.tenantId,
    PLAN_LIMIT_CODES.DAILY_ORDERS,
    () =>
      prisma.serviceOrder.count({
        where: { tenantId: user.tenantId, createdAt: { gte: todayStart } },
      }),
  );
  if (!dailyLimit.allowed) {
    return { ok: false, message: dailyLimit.message };
  }
  const activeLimit = await enforceCountLimit(
    user.tenantId,
    PLAN_LIMIT_CODES.MAX_ACTIVE_ORDERS,
    () =>
      prisma.serviceOrder.count({
        where: {
          tenantId: user.tenantId,
          status: { in: ["SCHEDULED", "IN_PROGRESS", "POSTPONED"] },
        },
      }),
  );
  if (!activeLimit.allowed) {
    return { ok: false, message: activeLimit.message };
  }

  // Дугаар үүсгэх — давхардвал 3 удаа дахин оролдоно
  let createdId: string | null = null;
  for (let i = 0; i < 3 && !createdId; i++) {
    try {
      const created = await withBookingTransaction(user.tenantId, async (tx) => {
        const number = await nextOrderNumber(tx, user.tenantId);
        // withBookingTransaction intentionally uses the base Prisma client so
        // raw locking and writes stay on one connection. Existing helpers use
        // the extended-client alias; the underlying transaction API is the
        // same, so bridge the type at this boundary.
        const scopedTx = tx as unknown as PrismaTransactionClient;
        if (accountVehicleToLink) {
          await ensureTenantVehicle(scopedTx, {
            tenantId: user.tenantId,
            vehicleId: data.vehicleId,
            customerId: data.customerId,
          });
        }

        const order = await tx.serviceOrder.create({
          data: {
            number,
            status: "SCHEDULED",
            tenantId: user.tenantId,
            branchId: data.branchId,
            customerId: data.customerId,
            vehicleId: data.vehicleId,
            assignedToId: data.assignedToId,
            scheduledAt: data.scheduledAt,
            notes: data.notes,
            isPostpaid: vehicleIsPostpaid,
            // Цаг захиалгаас удамшуулсан анхны тооцоолол (D-041 маягийн зарчим) —
            // категори өөрчлөгдвөл энэ хуучин захиалгад нөлөөлөхгүй. Walk-in
            // захиалгад ажилтны гараар оруулсан ойролцоо хугацааг хадгална.
            estimatedDurationMinutes: appointmentId
              ? appointmentEstimatedDurationMinutes ?? (data.scheduledAt ? branchSlotMinutes : null)
              : walkInEstimatedDurationMinutes ?? (data.scheduledAt ? branchSlotMinutes : null),
            categories: appointmentCategorySnapshots.length
              ? {
                  create: appointmentCategorySnapshots.map((category) => ({
                    tenantId: user.tenantId,
                    categoryId: category.categoryId,
                    name: category.name,
                  })),
                }
              : undefined,
          },
          select: { id: true },
        });

        // D-068 dual-write: every order starts life as an open SCHEDULED
        // booking — changeOrderStatusAction closes/reopens it as work
        // actually starts, pauses, resumes, or finishes.
        await openOrderTimeBooking(scopedTx, {
          tenantId: user.tenantId,
          orderId: order.id,
          branchId: data.branchId,
          kind: "SCHEDULED",
          startAt: data.scheduledAt ?? new Date(),
          endAt: null,
          createdById: user.id,
        });

        if (appointmentId) {
          const linked = await tx.appointment.updateMany({
            where: {
              id: appointmentId,
              tenantId: user.tenantId,
              customerId: data.customerId,
              ...(appointmentAccountId ? { accountId: appointmentAccountId } : {}),
              serviceOrderId: null,
            },
            data: {
              serviceOrderId: order.id,
              status: "CONFIRMED",
              ...(accountVehicleToLink ? { vehicleId: data.vehicleId } : {}),
              // Захиалга үүсгэсэн гэдэг нь машин ирсэн гэсэн үг — тусад нь
              // "Ирсэн" товч дарах шаардлагагүй, харин аль хэдийн тэмдэглэсэн
              // бол (жинхэнэ ирсэн цагийг хадгалахын тулд) дарж бичихгүй.
              ...(appointmentNeedsArrival ? { arrivedAt: new Date() } : {}),
            },
          });
          if (linked.count !== 1) {
            throw new Error("Цаг захиалгыг засварын хуудастай холбож чадсангүй.");
          }

          await logAudit(
            {
              tenantId: user.tenantId,
              userId: user.id,
              entity: "Appointment",
              entityId: appointmentId,
              action: "STATUS_CHANGE",
              summary: "Цаг захиалга засварын хуудастай холбогдов",
              after: { serviceOrderId: order.id, status: "CONFIRMED" },
            },
            scopedTx,
          );
        }

        return order;
      });
      createdId = created.id;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        // дугаар давхардсан тул дахин оролдоно
        continue;
      }
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Үүсгэх явцад алдаа гарлаа.",
      };
    }
  }

  if (!createdId) {
    return { ok: false, message: "Засварын хуудасны дугаар үүсгэж чадсангүй. Дахин оролдоно уу." };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "ServiceOrder",
    entityId: createdId,
    action: "CREATE",
    summary: "Засварын хуудас үүсгэсэн",
    after: {
      branchId: data.branchId,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      assignedToId: data.assignedToId,
      scheduledAt: data.scheduledAt?.toISOString() ?? null,
    },
  });

  if (appointmentId) {
    revalidatePath("/dashboard/appointments");
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  // Хуваарийн (calendar) хуудаснаас "next"-тэй ирсэн бол тэр рүү буцна —
  // ирээгүй бол өмнөх адил шинээр үүссэн захиалга руугаа шууд орно.
  redirect(safeNext(s(formData, "next"), `/dashboard/orders/${createdId}`));
}

// --- UPDATE (info only — status өөр action-аар солино) -------------------

export async function updateOrderAction(
  id: string,
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = parseOrderInput(formData);
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  const { errors: refErrors, vehicleIsPostpaid, branchSlotMinutes } = await validateRefs(
    user.tenantId,
    data,
    null,
  );
  if (Object.keys(refErrors).length > 0) {
    return { ok: false, fieldErrors: refErrors };
  }

  // Салбараар хязгаарлагдсан ажилтан өөр салбарын захиалгыг засах / өөр
  // салбар руу шилжүүлэх боломжгүй.
  const scope = workingBranchScopeId(user);
  if (scope && data.branchId !== scope) {
    return {
      ok: false,
      fieldErrors: { branchId: "Зөвхөн өөрийн салбарын засварын хуудсыг засах боломжтой." },
    };
  }
  const scopedOrderWhere = {
    id,
    tenantId: user.tenantId,
    ...(scope ? { branchId: scope } : {}),
  };

  const existing = await prisma.serviceOrder.findFirst({
    where: scopedOrderWhere,
    select: {
      status: true,
      scheduledAt: true,
      estimatedDurationMinutes: true,
      assignedToId: true,
      appointment: { select: { id: true, accountId: true, status: true } },
    },
  });
  if (!existing) {
    return { ok: false, message: "Засварын хуудас олдсонгүй." };
  }
  if (!canAssignOrders(user) && data.assignedToId !== existing.assignedToId) {
    return { ok: false, message: "Зөвхөн orders.assign эрхтэй хэрэглэгч хариуцагч өөрчилж болно." };
  }
  if (isOrderLocked(existing.status as OrderStatus)) {
    return {
      ok: false,
      message: "Дууссан / цуцлагдсан засварын хуудасны мэдээллийг засаж болохгүй.",
    };
  }

  const scheduledHoursError = await validateScheduledOrderHours(
    user.tenantId,
    data.branchId,
    data.scheduledAt,
    existing.estimatedDurationMinutes ?? branchSlotMinutes,
  );
  if (scheduledHoursError) {
    return { ok: false, fieldErrors: { scheduledAt: scheduledHoursError } };
  }

  // Товлосон огноог өөрчилж байгаа бөгөөд захиалга хараахан эхлээгүй (эсвэл
  // хойшлогдсон ч товлосон огноогоороо тооцогддог) үед л давхцлыг шалгана —
  // reviseExpectedFinishAction-той адил, зөвхөн анхааруулга, хатуу хориглол
  // биш (D-хугацааны шийдвэр, COWORK.md-г үз).
  const scheduledChanged =
    data.scheduledAt != null &&
    (existing.scheduledAt == null ||
      data.scheduledAt.getTime() !== existing.scheduledAt.getTime());
  const confirmed = s(formData, "confirmed") === "true";
  if (existing.status === "SCHEDULED" && scheduledChanged && !confirmed) {
    // Хугацаа тодорхойгүй бол (тооцоолол алга) 1 цагийн ойролцоо цонхоор
    // шалгана — зөвхөн анхааруулгын зорилготой энгийн таамаг, хадгалагдахгүй.
    const durationMinutes = existing.estimatedDurationMinutes ?? branchSlotMinutes;
    const conflictEnd = new Date(
      data.scheduledAt!.getTime() + durationMinutes * 60000,
    );
    const conflict = await findScheduleConflict(
      user.tenantId,
      data.branchId,
      id,
      data.scheduledAt!,
      conflictEnd,
    );
    if (conflict) {
      return {
        ok: false,
        message:
          conflict.certainty === "possible"
            ? `Шинэ товлосон огноо ${conflict.label}-тай давхцах магадлалтай. Үргэлжлүүлэхийн тулд дахин "Хадгалах" дарна уу.`
            : `Шинэ товлосон огноо ${conflict.label}-тай давхцаж байна. Үргэлжлүүлэхийн тулд дахин "Хадгалах" дарна уу.`,
        fieldErrors: { confirmNeeded: "true" },
      };
    }
  }

  try {
    // S06 fix: lock the row, re-read it fresh, re-validate against THAT
    // state (not the pre-lock `existing` above), then write — all under one
    // lock so a concurrent status change/cancel can't land between our
    // validation and our write. Машин солигдож болзошгүй тул дараа төлбөрт
    // snapshot-ыг дахин тооцно.
    const updated = await withOrderTransaction(
      user.tenantId,
      id,
      { status: true, scheduledAt: true, estimatedDurationMinutes: true, branchId: true },
      async (tx, freshRaw) => {
        const fresh = freshRaw as {
          status: OrderStatus;
          scheduledAt: Date | null;
          estimatedDurationMinutes: number | null;
          branchId: string;
        } | null;
        if (!fresh || (scope && fresh.branchId !== scope)) {
          throw new OrderActionValidationError("Засварын хуудас олдсонгүй.");
        }
        if (isOrderLocked(fresh.status as OrderStatus)) {
          throw new OrderActionValidationError(
            "Дууссан / цуцлагдсан засварын хуудасны мэдээллийг засаж болохгүй.",
          );
        }
        const freshScheduledChanged =
          data.scheduledAt != null &&
          (fresh.scheduledAt == null ||
            data.scheduledAt.getTime() !== fresh.scheduledAt.getTime());
        const result = await tx.serviceOrder.updateMany({
          where: scopedOrderWhere,
          data: { ...data, isPostpaid: vehicleIsPostpaid },
        });
        // D-068 dual-write: scheduledAt only actually drives the SCHEDULED-phase
        // booking (resolveOrderEffectiveInterval ignores it once work has
        // started, using startedAt instead) — only update the open booking here
        // when it's still that phase, in place, not a phase transition.
        if (result.count > 0 && fresh.status === "SCHEDULED" && freshScheduledChanged) {
          const durationMinutes = fresh.estimatedDurationMinutes ?? branchSlotMinutes;
          await updateOpenOrderTimeBookingSchedule(tx, id, {
            startAt: data.scheduledAt!,
            endAt: new Date(data.scheduledAt!.getTime() + durationMinutes * 60000),
          });
        }
        return result;
      },
    );
    if (updated.count === 0) {
      return { ok: false, message: "Засварын хуудас олдсонгүй." };
    }
  } catch (e) {
    return orderActionErrorResult(e);
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "ServiceOrder",
    entityId: id,
    action: "UPDATE",
    summary: "Засварын хуудасны мэдээлэл шинэчлэв",
    after: {
      branchId: data.branchId,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      assignedToId: data.assignedToId,
      scheduledAt: data.scheduledAt?.toISOString() ?? null,
    },
  });

  if (scheduledChanged) {
    await notifyOrderRescheduled(existing.appointment, existing.scheduledAt, data.scheduledAt!);
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  return { ok: true, message: "Засварын хуудас шинэчлэгдлээ." };
}

// --- STATUS CHANGE --------------------------------------------------------

export async function changeOrderStatusAction(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  const id = s(formData, "id");
  const next = s(formData, "status") as OrderStatus;
  if (!id || !next) return { ok: false, message: "Буруу хүсэлт." };
  try { await assertOrderEditAccess(user, id); } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "Алдаа" }; }

  // S06 fix: everything that validates and everything that writes now
  // happens under ONE row lock on this order — re-read fresh inside
  // withOrderTransaction, validated against THAT state, never against a
  // pre-lock read — so a concurrent status change/cancel/expiry can't slot
  // in between validation and write.
  try {
    await withOrderTransaction(
      user.tenantId,
      id,
      {
        id: true,
        branchId: true,
        status: true,
        startedAt: true,
        estimatedDurationMinutes: true,
        items: {
          where: { status: { not: "CANCELLED" } },
          select: {
            kind: true,
            status: true,
            quantity: true,
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
      async (tx, orderRaw) => {
        const order = orderRaw as {
          id: string;
          branchId: string;
          status: OrderStatus;
          startedAt: Date | null;
          estimatedDurationMinutes: number | null;
          items: ServiceDurationItem[];
        } | null;
        if (!order) throw new OrderActionValidationError("Засварын хуудас олдсонгүй.");
        assertOrderBranchScope(user, order.branchId);

        const allowed = ORDER_STATUS_TRANSITIONS[order.status as OrderStatus];
        if (!allowed?.includes(next)) {
          throw new OrderActionValidationError("Энэ статус руу шилжих боломжгүй.");
        }
        // S12: POSTPONED needs a mandatory reason/return-time and a structured
        // OrderStatusChange row — route it exclusively through the dedicated
        // postponeOrderAction (dashboard) / POST /api/v1/orders/[id]/postpone
        // (API), which share lib/order-postpone.ts's postponeOrderCore. This
        // generic action used to also accept POSTPONED with none of that
        // validation (WEB_SCHEDULING_ASSESSMENT S11-S12).
        if (next === "POSTPONED") {
          throw new OrderActionValidationError(
            "Хойшлуулахын тулд тусгай хойшлуулах цэсийг ашиглана уу.",
          );
        }

        // Дуусгахаас өмнө нэмэгдсэн оношилгооны мөр бүгд тайлантай (бөглөгдсөн) байх ёстой.
        if (next === "COMPLETED") {
          const pending = await tx.serviceItem.count({
            where: {
              orderId: order.id,
              kind: "DIAGNOSTIC",
              status: { not: "CANCELLED" },
              diagnosticReportId: null,
            },
          });
          if (pending > 0) {
            throw new OrderActionValidationError(
              "Бөглөгдөөгүй оношилгоо байна. Бүх оношилгоог бөглөсний дараа засварын хуудсыг дуусгана уу.",
            );
          }
        }

        const now = new Date();
        const enteringInProgress = next === "IN_PROGRESS";
        const startingFresh = enteringInProgress && order.status === "SCHEDULED";
        const resuming = enteringInProgress && order.status === "POSTPONED";

        // Ажил эхлэхэд (эсвэл сэлбэгээс сэргэхэд) үргэлжлэх хугацааны тооцоолол
        // байх ёстой — эс бөгөөс энэ захиалга хугацаагүй, тодорхойгүй хугацаагаар
        // ажлын байрыг эзэлж, cap=1 мэт бага багтаамжтай салбарт БҮХ цаг захиалгыг
        // бүрмөсөн хаадаг байсан (D-хугацааны шийдвэр). Аль хэдийн тооцоолол байвал
        // (жишээ нь холбогдсон цаг захиалгаас өвлөгдсөн) дахин асуухгүй.
        let effectiveDurationMinutes = order.estimatedDurationMinutes;
        const serviceItemDurationMinutes = enteringInProgress
          ? calculateServiceItemDurationMinutes(order.items)
          : null;
        if (effectiveDurationMinutes == null && serviceItemDurationMinutes != null) {
          effectiveDurationMinutes = serviceItemDurationMinutes;
        }
        if (enteringInProgress && effectiveDurationMinutes == null) {
          const parsed = parseDurationInput(
            s(formData, "durationHours"),
            s(formData, "durationMinutes"),
          );
          if (!parsed.ok) {
            throw new OrderActionValidationError("", { duration: parsed.error });
          }
          if (parsed.minutes == null) {
            throw new OrderActionValidationError("", {
              duration: "Ажлыг эхлүүлэхийн өмнө ойролцоо үргэлжлэх хугацааг оруулна уу.",
            });
          }
          effectiveDurationMinutes = parsed.minutes;
        }

        const updates: Prisma.ServiceOrderUpdateInput = { status: next };
        const startedAt = startingFresh ? now : order.startedAt;
        if (startingFresh) {
          updates.startedAt = startedAt;
        }
        if (startingFresh && effectiveDurationMinutes !== order.estimatedDurationMinutes) {
          updates.estimatedDurationMinutes = effectiveDurationMinutes;
        }
        if (next === "COMPLETED") {
          updates.completedAt = new Date();
        }
        // Хүчин чадлын эзэмшил: идэвхтэй ажил хүчин чадал эзэлнэ; дууссан/цуцлагдсан
        // ажил тэр даруй суллана. (POSTPONED-ийг S12-оор дээр нь хасав — тусгай
        // postponeOrderCore л энэ шилжилтийг хийнэ.)
        if (next === "COMPLETED" || next === "CANCELLED") {
          updates.occupiesCapacity = false;
        } else {
          updates.occupiesCapacity = true;
        }
        if (enteringInProgress && effectiveDurationMinutes != null) {
          // Хойшлуулснаас сэргэхэд анхны эхэлсэн цагаас биш, ОДООгоос тоолж
          // дуусах хугацааг дахин тооцоолно — эс бөгөөс хойшлуулсан хугацаа
          // тооцогдохгүй, дуусах хугацаа хуучирсан хэвээр үлдэнэ.
          const anchor = resuming ? now : startedAt;
          if (anchor) {
            updates.expectedFinishAt = new Date(
              anchor.getTime() + effectiveDurationMinutes * 60000,
            );
          }
        }

        await tx.serviceOrder.update({
          where: { id: order.id },
          data: updates,
        });
        // D-068/D-076 dual-write: close() is a no-op when nothing matching is
        // open, so this stays correct regardless of the order's prior booking
        // state. Starting/resuming active work ("all") consumes whatever was
        // next in line for this order — a prior SCHEDULED booking that's now
        // actually starting, a still-open ACTIVE one (resuming without ever
        // releasing the bay), or an independent follow-up reservation, since
        // only one SCHEDULED slot can exist at a time and the car is back now.
        // COMPLETED closes only ACTIVE — a pending follow-up (D-076) is a
        // separate future commitment and must survive the current work ending.
        // CANCELLED closes "all": the whole order is void, so nothing about it
        // — including any pending follow-up — should remain open, matching the
        // service-item cancellation just below.
        if (enteringInProgress) {
          await closeOpenOrderTimeBooking(tx, order.id, now, "all");
          await openOrderTimeBooking(tx, {
            tenantId: user.tenantId,
            orderId: order.id,
            branchId: order.branchId,
            kind: "ACTIVE",
            startAt: now,
            endAt: (updates.expectedFinishAt as Date | undefined) ?? null,
            createdById: user.id,
          });
        } else if (next === "COMPLETED") {
          await closeOpenOrderTimeBooking(tx, order.id, updates.completedAt as Date, "ACTIVE");
        } else if (next === "CANCELLED") {
          await closeOpenOrderTimeBooking(tx, order.id, now, "all");
        }
    // Захиалгыг бүхэлд нь цуцлахад дотор нь бөглөгдсөн (COMPLETED) байсан
    // мөр — тэр дундаа бөглөгдсөн оношилгооны хуудас — идэвхтэй хэвээр
    // үлдэж, дуусаагүй мэт харагдахаас сэргийлж бүх мөрийг мөн цуцална.
        if (next === "CANCELLED") {
          await tx.serviceItem.updateMany({
            where: { orderId: order.id, status: { not: "CANCELLED" } },
            data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: user.id },
          });
        }
        // S12: every transition writes a structured OrderStatusChange row in
        // the same transaction, not just postpone (WEB_SCHEDULING_ASSESSMENT
        // S11-S12) — no reason/reasonTag for these ordinary transitions.
        await tx.orderStatusChange.create({
          data: {
            tenantId: user.tenantId,
            orderId: order.id,
            fromStatus: order.status,
            toStatus: next,
            changedById: user.id,
          },
        });
        await logAudit(
          {
            tenantId: user.tenantId,
            userId: user.id,
            entity: "ServiceOrder",
            entityId: order.id,
            action: "STATUS_CHANGE",
            summary: `${order.status} → ${next}`,
            before: { status: order.status },
            after: { status: next },
          },
          tx,
        );
      },
    );
  } catch (e) {
    return orderActionErrorResult(e);
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Статус шинэчлэгдлээ." };
}

// --- POSTPONE (D-078: merges the status transition with reason/tag capture
// and an optional return-time booking, in one modal/one submit) -----------

// Хойшлуулах нь ердийн статус шилжилт биш — яагаад хойшилж байгааг (шалгаж
// шалгаагаад, гар бичсэн reason + сонгосон reasonTag хосоор) OrderStatusChange
// мөрөнд заавал тэмдэглэнэ, мөн хүсвэл (заавал биш) буцах цагийг нэг дор
// товлож болно. changeOrderStatusAction-ийн POSTPONED-той адил dual-write
// зарчим ашиглана (ACTIVE-г л хаана, follow-up SCHEDULED мөрийг хөндөхгүй).
export async function postponeOrderAction(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  const id = s(formData, "id");
  if (!id) return { ok: false, message: "Буруу хүсэлт." };
  try { await assertOrderEditAccess(user, id); } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "Алдаа" }; }

  // S12: all validation and writes now live in postponeOrderCore
  // (lib/order-postpone.ts), shared with POST /api/v1/orders/[id]/postpone —
  // this action only adapts FormData in and OrderActionState out.
  const result = await postponeOrderCore({
    tenantId: user.tenantId,
    orderId: id,
    branchScope: workingBranchScopeId(user),
    reasonRaw: s(formData, "reason"),
    reasonTagRaw: s(formData, "reasonTag"),
    returnAtRaw: s(formData, "returnAt"),
    confirmed: s(formData, "confirmed") === "true",
    actorId: user.id,
  });
  if (!result.ok) {
    return { ok: false, message: result.error.message, fieldErrors: result.error.fieldErrors };
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard/appointments/calendar");
  revalidatePath("/dashboard");
  return { ok: true, message: "Хойшлууллаа." };
}

// --- STATUS HISTORY (D-078: read OrderStatusChange for display) ----------

export type OrderStatusHistoryEntry = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string | null;
  reasonTag: OrderPostponeReasonTag | null;
  changedByName: string | null;
  createdAt: Date;
};

// Зөвхөн харах эрх шаардлагатай (засах биш) — тухайн захиалгын статус
// шилжилтийн түүхийг цагийн дарааллаар (сүүлийнхээс) буцаана. Алдаа/эрхгүй
// үед `null` буцаана (throw биш) — modal-ийг "олдсонгүй" гэж энгийн харуулна.
export async function getOrderStatusHistoryAction(
  orderId: string,
): Promise<OrderStatusHistoryEntry[] | null> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return null;
  }
  if (!canView(user, "orders")) return null;
  if (!orderId) return null;

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, tenantId: user.tenantId },
    select: { id: true, branchId: true },
  });
  if (!order) return null;
  try {
    assertOrderBranchScope(user, order.branchId);
  } catch {
    return null;
  }

  const rows = await prisma.orderStatusChange.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      reasonTag: true,
      createdAt: true,
      changedBy: { select: { firstName: true, lastName: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    reason: row.reason,
    reasonTag: row.reasonTag,
    changedByName: row.changedBy
      ? `${row.changedBy.firstName} ${row.changedBy.lastName}`.trim() || null
      : null,
    createdAt: row.createdAt,
  }));
}

// --- SCHEDULE A RETURN TIME (D-068: a SCHEDULED-kind OrderTimeBooking while
// still POSTPONED, without touching occupiesCapacity) ------------------

// D-076: POSTPONED is now always released (occupiesCapacity: false, no
// toggle — see COWORK.md) — this schedules the car's return time. A
// separate "resume now" happens via changeOrderStatusAction transitioning
// straight to IN_PROGRESS, which itself handles closing this booking. Bay
// occupancy is never independently toggled while POSTPONED any more.
// Аль хэдийн товлосон буцах цаг байвал (нээлттэй SCHEDULED мөр) шинээр
// нээхгүй, байгааг нь л шинэчилнэ (rescheduleOrderAction-той адил зарчим).
export async function scheduleOrderReturnAction(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  const id = s(formData, "id");
  const returnRaw = s(formData, "returnAt");
  const confirmed = s(formData, "confirmed") === "true";
  if (!id || !returnRaw) return { ok: false, message: "Буруу хүсэлт." };

  const returnAt = parseBusinessLocalDateTime(returnRaw);
  if (!Number.isFinite(returnAt.getTime())) {
    return { ok: false, fieldErrors: { returnAt: "Огноо буруу." } };
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id, tenantId: user.tenantId },
    select: {
      id: true,
      branchId: true,
      status: true,
      occupiesCapacity: true,
      estimatedDurationMinutes: true,
    },
  });
  if (!order) return { ok: false, message: "Засварын хуудас олдсонгүй." };
  try {
    assertOrderBranchScope(user, order.branchId);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  // D-076: two cases. A POSTPONED order (always released, see D-076) books
  // a return time — the single reservation representing when the car comes
  // back, replacing any prior one. An IN_PROGRESS order books an
  // independent follow-up — additive, alongside the still-open ACTIVE
  // booking for today's work, never touching it.
  const isReturnTime = order.status === "POSTPONED";
  const isFollowUp = order.status === "IN_PROGRESS";
  if (!isReturnTime && !isFollowUp) {
    return {
      ok: false,
      message: "Зөвхөн хойшлуулсан, эсвэл идэвхтэй ажиллаж буй захиалгад л дараагийн цаг товлоно.",
    };
  }

  const durationMinutes = order.estimatedDurationMinutes ?? await getBranchSlotMinutes(
    user.tenantId,
    order.branchId,
  );
  const conflictEnd = new Date(returnAt.getTime() + durationMinutes * 60000);
  if (!confirmed) {
    const conflict = await findScheduleConflict(
      user.tenantId,
      order.branchId,
      order.id,
      returnAt,
      conflictEnd,
    );
    if (conflict) {
      const actionLabel = isFollowUp ? "Дараагийн цаг товлох" : "Товлох";
      return {
        ok: false,
        message:
          conflict.certainty === "possible"
            ? `Товлосон цаг ${conflict.label}-тай давхцах магадлалтай. Үргэлжлүүлэхийн тулд дахин "${actionLabel}" дарна уу.`
            : `Товлосон цаг ${conflict.label}-тай давхцаж байна. Үргэлжлүүлэхийн тулд дахин "${actionLabel}" дарна уу.`,
        fieldErrors: { confirmNeeded: "true" },
      };
    }
  }

  // S06 fix — the worst race in this batch: two concurrent calls could each
  // read "no open SCHEDULED row" (unlocked) and each insert one. Take the
  // order lock, re-read status fresh, and do the "does an open SCHEDULED
  // row already exist?" check AND the resulting update-in-place-or-insert
  // under that SAME lock so only one of two concurrent callers can win the
  // insert branch.
  try {
    await withOrderTransaction(
      user.tenantId,
      id,
      { id: true, branchId: true, status: true },
      async (tx, freshRaw) => {
        const fresh = freshRaw as { id: string; branchId: string; status: OrderStatus } | null;
        if (!fresh) throw new OrderActionValidationError("Засварын хуудас олдсонгүй.");
        assertOrderBranchScope(user, fresh.branchId);
        const freshIsReturnTime = fresh.status === "POSTPONED";
        const freshIsFollowUp = fresh.status === "IN_PROGRESS";
        if (!freshIsReturnTime && !freshIsFollowUp) {
          throw new OrderActionValidationError(
            "Зөвхөн хойшлуулсан, эсвэл идэвхтэй ажиллаж буй захиалгад л дараагийн цаг товлоно.",
          );
        }

        const open = await getOpenOrderTimeBookings(tx, fresh.id);
        const openScheduled = open.find((b) => b.kind === "SCHEDULED");
        if (openScheduled) {
          // Аль хэдийн товлосон цаг байгааг л шинэчилнэ — шинэ мөр нээхгүй
          // (rescheduleOrderAction-той адил "засварлах", шатлал шилжилт биш).
          await updateOpenOrderTimeBookingSchedule(tx, fresh.id, {
            startAt: returnAt,
            endAt: conflictEnd,
          });
        } else if (freshIsReturnTime) {
          // occupiesCapacity === false байх ёстой тул энд ямар нэгэн ACTIVE
          // нээлттэй мөр байх ёсгүй, гэвч бай хамгаалалтын үүднээс ямар ч
          // нээлттэй мөрийг хаагаад шинээр SCHEDULED нээнэ.
          await closeOpenOrderTimeBooking(tx, fresh.id, new Date(), "all");
          await openOrderTimeBooking(tx, {
            tenantId: user.tenantId,
            orderId: fresh.id,
            branchId: fresh.branchId,
            kind: "SCHEDULED",
            startAt: returnAt,
            endAt: conflictEnd,
            createdById: user.id,
          });
        } else {
          // D-076 follow-up (freshIsFollowUp, IN_PROGRESS): additive only — the
          // open ACTIVE booking for today's work must NEVER be closed here.
          await openOrderTimeBooking(tx, {
            tenantId: user.tenantId,
            orderId: fresh.id,
            branchId: fresh.branchId,
            kind: "SCHEDULED",
            startAt: returnAt,
            endAt: conflictEnd,
            createdById: user.id,
          });
        }
        await logAudit(
          {
            tenantId: user.tenantId,
            userId: user.id,
            entity: "ServiceOrder",
            entityId: fresh.id,
            action: "UPDATE",
            summary: freshIsFollowUp ? "Дараагийн цаг товлов" : "Машины буцах цаг товлов",
            after: { returnAt: returnAt.toISOString() },
          },
          tx,
        );
      },
    );
  } catch (e) {
    return orderActionErrorResult(e);
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard/appointments/calendar");
  return { ok: true, message: isFollowUp ? "Дараагийн цаг товлолоо." : "Буцах цаг товлолоо." };
}

// --- EXPECTED FINISH TIME (manual revision) --------------------------------

// Дуусах хугацааг тооцоолсноос хойш ажилтан гар аргаар засаж чадна (сэлбэг
// хүлээх, гэнэтийн ажил зэргээс шалтгаалан хойшлох тохиолдол) — анхны
// автомат тооцооллоос ялгаатай, дурын үедээ дуудагдана. Анхны утга анх
// тавигдахад (өмнө нь байгаагүй үед) мэдэгдэл илгээхгүй — зөвхөн ЗАСВАРЛАСАН
// (өөрчилсөн) үед л, ба ялгаа 15 минутаас бага бол чимээгүй алгасна (эргэлзээт
// бага зөрүүгээр үйлчлүүлэгчийг дэмий цочроохгүйн тулд).
const MEANINGFUL_FINISH_CHANGE_MS = 15 * 60 * 1000;

/**
 * Orders may run past closing or onto the next business date, but that is an
 * operational exception rather than normal branch availability. Keep it a
 * confirmable warning so staff can intentionally record the real finish time.
 */
async function expectedFinishNeedsScheduleWarning(
  tenantId: string,
  branchId: string,
  start: Date,
  end: Date,
): Promise<boolean> {
  const startDate = bookingDateKey(start);
  const endDate = bookingDateKey(new Date(end.getTime() - 1));
  if (startDate !== endDate) return true;

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
    select: branchScheduleForDateSelect(startDate),
  });
  if (!branch) return true;
  const schedule = resolveEffectiveSchedule({ dateStr: startDate, branch });
  const openMin = schedule.openTime ? timeToMinutes(schedule.openTime) : null;
  const closeMin = schedule.closeTime ? timeToMinutes(schedule.closeTime) : null;
  if (!schedule.open || openMin == null || closeMin == null || closeMin <= openMin) {
    return true;
  }

  const dayStart = bookingDayBounds(startDate).start.getTime();
  const startMin = (start.getTime() - dayStart) / 60000;
  const endMin = (end.getTime() - dayStart) / 60000;
  return startMin < openMin || endMin > closeMin;
}

export async function reviseExpectedFinishAction(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  const id = s(formData, "id");
  const expectedFinishRaw = s(formData, "expectedFinishAt");
  const confirmed = s(formData, "confirmed") === "true";
  if (!id) return { ok: false, message: "Буруу хүсэлт." };
  try { await assertOrderEditAccess(user, id); } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "Алдаа" }; }

  let expectedFinishAt: Date | null = null;
  if (expectedFinishRaw) {
    const d = parseBusinessLocalDateTime(expectedFinishRaw);
    if (!Number.isFinite(d.getTime())) {
      return { ok: false, fieldErrors: { expectedFinishAt: "Огноо буруу." } };
    }
    expectedFinishAt = d;
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id, tenantId: user.tenantId },
    select: {
      id: true,
      status: true,
      branchId: true,
      startedAt: true,
      expectedFinishAt: true,
      appointment: { select: { id: true, accountId: true, status: true } },
    },
  });
  if (!order) return { ok: false, message: "Засварын хуудас олдсонгүй." };
  try {
    assertOrderBranchScope(user, order.branchId);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  if (isOrderLocked(order.status as OrderStatus)) {
    return {
      ok: false,
      message:
        order.status === "COMPLETED"
          ? "Энэ засварын хуудас аль хэдийн дууссан тул хугацааг засах боломжгүй. Хуудсыг дахин ачаална уу."
          : "Энэ засварын хуудас цуцлагдсан тул хугацааг засах боломжгүй. Хуудсыг дахин ачаална уу.",
    };
  }

  if (order.status === "POSTPONED") {
    return {
      ok: false,
      message:
        "Хойшлуулсан ажлын дуусах хугацааг засах боломжгүй — ажлыг үргэлжлүүлсний дараа л засварлана уу.",
    };
  }

  if (order.status !== "IN_PROGRESS") {
    return {
      ok: false,
      message: "Дуусах хугацааг зөвхөн ажиллаж буй засварын хуудсанд тохируулна.",
    };
  }

  // S10 fix (WEB_SCHEDULING_ASSESSMENT_2026-09-10.md): validate against the
  // currently open ACTIVE booking's startAt, not the stale ServiceOrder.startedAt
  // scalar — resume (POSTPONED -> IN_PROGRESS) opens a fresh ACTIVE row anchored
  // to "now" but deliberately leaves startedAt untouched (see changeOrderStatusAction
  // above), so after a pause/resume cycle startedAt still points at the original
  // (possibly days-old) start rather than the real current session's start.
  const openBookings = await getOpenOrderTimeBookings(prisma, order.id);
  const activeBooking = openBookings.find((b) => b.kind === "ACTIVE");
  const activeStartAt = activeBooking?.startAt ?? order.startedAt;

  if (expectedFinishAt) {
    if (!activeStartAt) {
      return {
        ok: false,
        message: "Дуусах хугацаа тохируулахын өмнө ажлын эхэлсэн цагийг тэмдэглэнэ үү.",
      };
    }
    if (expectedFinishAt.getTime() <= activeStartAt.getTime()) {
      return {
        ok: false,
        fieldErrors: {
          expectedFinishAt: "Дуусах хугацаа эхэлсэн хугацаанаас хойш байх ёстой.",
        },
      };
    }
    // D-087 superseded: closing-time overrun used to be a hard block here.
    // Staff work legitimately runs past closing; that is now a confirmable
    // warning via expectedFinishNeedsScheduleWarning below (called when
    // !confirmed), not an unconditional rejection.
  }

  if (expectedFinishAt && !confirmed) {
    const conflictStart = activeStartAt!;
    const conflict = await findScheduleConflict(
      user.tenantId,
      order.branchId,
      order.id,
      conflictStart,
      expectedFinishAt,
    );
    if (conflict) {
      return {
        ok: false,
        message:
          conflict.certainty === "possible"
            ? `Шинэ дуусах хугацаа ${conflict.label}-тай давхцах магадлалтай. Түүний дуусах хугацаа тодорхойгүй байна. Үргэлжлүүлэхийн тулд дахин "Хадгалах" дарна уу.`
            : `Шинэ дуусах хугацаа ${conflict.label}-тай давхцаж байна. Үргэлжлүүлэхийн тулд дахин "Хадгалах" дарна уу.`,
        fieldErrors: {
          confirmNeeded: "true",
          conflictKind: conflict.certainty,
        },
      };
    }

    if (
      await expectedFinishNeedsScheduleWarning(
        user.tenantId,
        order.branchId,
        conflictStart,
        expectedFinishAt,
      )
    ) {
      return {
        ok: false,
        message:
          "Шинэ дуусах хугацаа салбарын ажиллах цагаас хэтэрч байна. Үргэлжлүүлэхийн тулд дахин \"Хадгалах\" дарна уу.",
        fieldErrors: { confirmNeeded: "true" },
      };
    }
  }

  const previous = order.expectedFinishAt;
  const isMeaningfulChange =
    previous != null &&
    expectedFinishAt != null &&
    Math.abs(expectedFinishAt.getTime() - previous.getTime()) >=
      MEANINGFUL_FINISH_CHANGE_MS;

  // S06 fix: re-validate the order's phase/startedAt against a fresh, locked
  // read before writing — the pre-checks above (hours/conflict) ran against
  // the earlier unlocked read and are only advisory warnings, but "is this
  // order still IN_PROGRESS/POSTPONED with the same startedAt" is the actual
  // correctness gate and must be re-checked under the lock.
  try {
    await withOrderTransaction(
      user.tenantId,
      id,
      { id: true, status: true, branchId: true, startedAt: true, expectedFinishAt: true },
      async (tx, freshRaw) => {
        const fresh = freshRaw as {
          id: string;
          status: OrderStatus;
          branchId: string;
          startedAt: Date | null;
          expectedFinishAt: Date | null;
        } | null;
        if (!fresh) throw new OrderActionValidationError("Засварын хуудас олдсонгүй.");
        assertOrderBranchScope(user, fresh.branchId);
        if (isOrderLocked(fresh.status as OrderStatus)) {
          throw new OrderActionValidationError(
            fresh.status === "COMPLETED"
              ? "Энэ засварын хуудас аль хэдийн дууссан тул хугацааг засах боломжгүй. Хуудсыг дахин ачаална уу."
              : "Энэ засварын хуудас цуцлагдсан тул хугацааг засах боломжгүй. Хуудсыг дахин ачаална уу.",
          );
        }
        if (fresh.status === "POSTPONED") {
          throw new OrderActionValidationError(
            "Хойшлуулсан ажлын дуусах хугацааг засах боломжгүй — ажлыг үргэлжлүүлсний дараа л засварлана уу.",
          );
        }
        if (fresh.status !== "IN_PROGRESS") {
          throw new OrderActionValidationError(
            "Дуусах хугацааг зөвхөн ажиллаж буй засварын хуудсанд тохируулна.",
          );
        }
        // S10 fix: re-check against the fresh, locked open ACTIVE booking's
        // startAt (not the stale startedAt scalar) — same reasoning as the
        // pre-check above, but under the lock this time.
        const freshOpen = await getOpenOrderTimeBookings(tx, fresh.id);
        const freshActiveStartAt =
          freshOpen.find((b) => b.kind === "ACTIVE")?.startAt ?? fresh.startedAt;
        if (expectedFinishAt) {
          if (!freshActiveStartAt) {
            throw new OrderActionValidationError(
              "Дуусах хугацаа тохируулахын өмнө ажлын эхэлсэн цагийг тэмдэглэнэ үү.",
            );
          }
          if (expectedFinishAt.getTime() <= freshActiveStartAt.getTime()) {
            throw new OrderActionValidationError("", {
              expectedFinishAt: "Дуусах хугацаа эхэлсэн хугацаанаас хойш байх ёстой.",
            });
          }
        }
        await tx.serviceOrder.update({
          where: { id: fresh.id },
          data: { expectedFinishAt },
        });
        // D-068 dual-write: a forecast revision, not a pause/resume — update
        // the currently open booking's endAt in place, leave it open.
        await updateOpenOrderTimeBookingForecast(tx, fresh.id, expectedFinishAt);
        await logAudit(
          {
            tenantId: user.tenantId,
            userId: user.id,
            entity: "ServiceOrder",
            entityId: fresh.id,
            action: "UPDATE",
            summary: "Дуусах хугацааг гар аргаар шинэчлэв",
            before: { expectedFinishAt: (fresh.expectedFinishAt ?? previous)?.toISOString() ?? null },
            after: { expectedFinishAt: expectedFinishAt?.toISOString() ?? null },
          },
          tx,
        );
      },
    );
  } catch (e) {
    return orderActionErrorResult(e);
  }

  // Цуцлагдсан/ирээгүй цаг захиалга ч захиалгатайгаа холбоотой хэвээр байдаг
  // (serviceOrderId салгагддаггүй) — тул тухайн үйлчлүүлэгч аль хэдийн
  // цуцалсан/ирээгүй цагтаа "хугацаа өөрчлөгдлөө" гэсэн мэдэгдэл авахгүйн
  // тулд идэвхтэй (PENDING/CONFIRMED) статустай үед л мэдэгдэнэ.
  const appointmentIsActive =
    order.appointment?.status === "PENDING" || order.appointment?.status === "CONFIRMED";
  if (isMeaningfulChange && appointmentIsActive && order.appointment?.accountId) {
    try {
      await createNotification({
        type: "expected_finish_revised",
        recipient: { accountId: order.appointment.accountId },
        input: {
          appointmentId: order.appointment.id,
          body:
            expectedFinishAt!.getTime() > previous!.getTime()
              ? "Таны засварын хуудасны дуусах хугацаа хойшлолоо."
              : "Таны засварын хуудасны дуусах хугацаа өөрчлөгдлөө.",
        },
      });
    } catch (e) {
      console.warn("[notify] expected_finish_revised:", e);
    }
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  return { ok: true, message: "Дуусах хугацаа шинэчлэгдлээ." };
}

// --- RESCHEDULE (SCHEDULED захиалгын товлосон огноог гар аргаар шилжүүлэх) -

// Хуваарийн (schedule) харагдацаас шууд ашиглах хөнгөн үйлдэл — бүтэн
// засах маягт руу орохгүйгээр товлосон огноог л шилжүүлнэ. Зөвхөн SCHEDULED
// (хараахан эхлээгүй) захиалгад хамаатай — эхэлсэн ажлыг StatusControls-ийн
// "Дуусах хугацаа" (reviseExpectedFinishAction) удирддаг, энэ өөр зорилготой.
export async function rescheduleOrderAction(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  const id = s(formData, "id");
  const scheduledRaw = s(formData, "scheduledAt");
  const confirmed = s(formData, "confirmed") === "true";
  if (!id || !scheduledRaw) return { ok: false, message: "Буруу хүсэлт." };
  try { await assertOrderEditAccess(user, id); } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "Алдаа" }; }

  const scheduledAt = parseBusinessLocalDateTime(scheduledRaw);
  if (!Number.isFinite(scheduledAt.getTime())) {
    return { ok: false, fieldErrors: { scheduledAt: "Огноо буруу." } };
  }
  // S09: general order create/update reject a past time; direct reschedule did not.
  if (scheduledAt.getTime() < Date.now()) {
    return { ok: false, fieldErrors: { scheduledAt: "Өнгөрсөн цаг сонгох боломжгүй." } };
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id, tenantId: user.tenantId },
    select: {
      id: true,
      branchId: true,
      status: true,
      scheduledAt: true,
      estimatedDurationMinutes: true,
      appointment: { select: { id: true, accountId: true, status: true } },
    },
  });
  if (!order) return { ok: false, message: "Засварын хуудас олдсонгүй." };
  try {
    assertOrderBranchScope(user, order.branchId);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  if (order.status !== "SCHEDULED") {
    return {
      ok: false,
      message: "Зөвхөн эхлээгүй (товлогдсон) захиалгын огноог энд шилжүүлнэ.",
    };
  }

  const previous = order.scheduledAt;

  // S14: an order still linked to a CONFIRMED appointment shares its slot
  // with that appointment's own requestedAt — writing only `scheduledAt`
  // here would let the two drift apart. Route this window through the same
  // shared linked-move command rescheduleAppointmentAction now also uses, so
  // both staff entry points converge on one command instead of two
  // independently-branching writes. A cancelled/expired/no-appointment
  // (walk-in) order keeps the existing standalone single-entity path below.
  if (order.appointment && order.appointment.status === "CONFIRMED") {
    try {
      await moveLinkedAppointmentOrder({
        tenantId: user.tenantId,
        userId: user.id,
        orderId: order.id,
        newTime: scheduledAt,
        confirmed,
      });
      await notifyOrderRescheduled(order.appointment, previous, scheduledAt);
      revalidatePath("/dashboard/orders");
      revalidatePath(`/dashboard/orders/${id}`);
      revalidatePath("/dashboard/appointments");
      revalidatePath("/dashboard/appointments/calendar");
      revalidatePath("/account");
      return { ok: true, message: "Товлосон огноо болон холбогдсон цаг захиалга шилжлээ." };
    } catch (e) {
      if (e instanceof LinkedRescheduleError) {
        return { ok: false, message: e.message, fieldErrors: e.fieldErrors };
      }
      return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
    }
  }

  const durationMinutes = order.estimatedDurationMinutes ?? await getBranchSlotMinutes(
    user.tenantId,
    order.branchId,
  );
  // S09: apply the same effective-hours validator general create/update use
  // (validateScheduledOrderHours) — direct reschedule previously only
  // checked overlaps, letting a new time land outside opening hours.
  // D-087 superseded: an hours violation on staff-initiated reschedule is now
  // a confirmable warning, not a hard block — matches the schedule-conflict
  // check immediately below.
  const hoursError = await validateScheduledOrderHours(
    user.tenantId,
    order.branchId,
    scheduledAt,
    durationMinutes,
  );
  if (hoursError && !confirmed) {
    return {
      ok: false,
      message: `${hoursError} Үргэлжлүүлэхийн тулд дахин "Хадгалах" дарна уу.`,
      fieldErrors: { confirmNeeded: "true" },
    };
  }
  const conflictEnd = new Date(scheduledAt.getTime() + durationMinutes * 60000);
  if (!confirmed) {
    const conflict = await findScheduleConflict(
      user.tenantId,
      order.branchId,
      order.id,
      scheduledAt,
      conflictEnd,
    );
    if (conflict) {
      return {
        ok: false,
        message:
          conflict.certainty === "possible"
            ? `Шинэ товлосон огноо ${conflict.label}-тай давхцах магадлалтай. Үргэлжлүүлэхийн тулд дахин "Хадгалах" дарна уу.`
            : `Шинэ товлосон огноо ${conflict.label}-тай давхцаж байна. Үргэлжлүүлэхийн тулд дахин "Хадгалах" дарна уу.`,
        fieldErrors: { confirmNeeded: "true" },
      };
    }
  }

  // S06 fix: re-validate status === SCHEDULED against a fresh, locked read
  // before writing — a concurrent start/cancel/postpone must not be
  // overwritten by a reschedule that validated against stale state.
  try {
    await withOrderTransaction(
      user.tenantId,
      id,
      { id: true, branchId: true, status: true, scheduledAt: true },
      async (tx, freshRaw) => {
        const fresh = freshRaw as {
          id: string;
          branchId: string;
          status: OrderStatus;
          scheduledAt: Date | null;
        } | null;
        if (!fresh) throw new OrderActionValidationError("Засварын хуудас олдсонгүй.");
        assertOrderBranchScope(user, fresh.branchId);
        if (fresh.status !== "SCHEDULED") {
          throw new OrderActionValidationError(
            "Зөвхөн эхлээгүй (товлогдсон) захиалгын огноог энд шилжүүлнэ.",
          );
        }
        await tx.serviceOrder.update({
          where: { id: fresh.id },
          data: { scheduledAt },
        });
        // D-068 dual-write: still SCHEDULED, not a phase transition — update the
        // open booking's start/end in place instead of closing+opening a new row.
        await updateOpenOrderTimeBookingSchedule(tx, fresh.id, {
          startAt: scheduledAt,
          endAt: conflictEnd,
        });
        await logAudit(
          {
            tenantId: user.tenantId,
            userId: user.id,
            entity: "ServiceOrder",
            entityId: fresh.id,
            action: "UPDATE",
            summary: "Товлосон огноог хуваарийн хуудаснаас шилжүүлэв",
            before: { scheduledAt: (fresh.scheduledAt ?? previous)?.toISOString() ?? null },
            after: { scheduledAt: scheduledAt.toISOString() },
          },
          tx,
        );
      },
    );
  } catch (e) {
    return orderActionErrorResult(e);
  }

  await notifyOrderRescheduled(order.appointment, previous, scheduledAt);

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard/appointments/calendar");
  return { ok: true, message: "Товлосон огноо шилжлээ." };
}

// --- PAYMENT STATUS -------------------------------------------------------
// Гараар зарлах action-ийг бүрмөсөн хассан — Төлбөрийн төлөв (PAID/PARTIAL/
// UNPAID) цаашид зөвхөн бодит (арга/дүнгээр бүртгэгдсэн) төлбөрүүдээс
// автоматаар тооцогдоно (харах: app/_actions/order-payments.ts
// recordOrderPaymentAction/reverseOrderPaymentAction). Дашбоард дээр захиалгын
// дэлгэрэнгүй хуудасны "Төлбөр" картын гарчгийн badge (PAYMENT_STATUS_BADGE/
// PAYMENT_STATUS_LABEL, харах: page.tsx) л одоогийн төлөвийг харуулна.

// --- DELETE ---------------------------------------------------------------

export async function deleteOrderAction(formData: FormData): Promise<void> {
  const user = await authorize("delete");
  const id = s(formData, "id");
  if (!id) return;

  const target = await prisma.serviceOrder.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { number: true, branchId: true },
  });
  if (target) assertOrderBranchScope(user, target.branchId);

  // S06 fix: re-check "no PAID payment" against a fresh, locked read
  // immediately before deleting — a payment recorded between the pre-lock
  // check and the delete must not be silently lost.
  await withOrderTransaction(
    user.tenantId,
    id,
    { id: true, branchId: true },
    async (tx, freshRaw) => {
      const fresh = freshRaw as { id: string; branchId: string } | null;
      if (!fresh) return;
      assertOrderBranchScope(user, fresh.branchId);
      const hasPaidPayment = await tx.orderPayment.findFirst({
        where: { orderId: id, status: "PAID" },
        select: { id: true },
      });
      if (hasPaidPayment) {
        throw new Error(
          "Энэ засварын хуудсанд төлбөр төлөгдсөн тул устгах боломжгүй.",
        );
      }
      // PENDING/CANCELLED/FAILED зэрэг бодит мөнгө хөдлөөгүй оролдлогуудыг
      // устгана — OrderPayment.orderId одоо Restrict тул захиалга устахаас
      // өмнө эдгээрийг цэвэрлэх шаардлагатай.
      await tx.orderPayment.deleteMany({
        where: { orderId: id, status: { not: "PAID" } },
      });
      await tx.serviceOrder.delete({
        where: { id, tenantId: user.tenantId },
      });
    },
  );

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "ServiceOrder",
    entityId: id,
    action: "DELETE",
    summary: target ? `#${target.number}` : null,
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  redirect("/dashboard/orders");
}

// --- ITEMS ----------------------------------------------------------------

// Service.type → ServiceItem.kind тааруулга (DIAGNOSTIC хэрэглэгдэхгүй)
const SERVICE_KIND_TO_ITEM_KIND: Record<string, ItemKind> = {
  LABOR: "LABOR",
  GOODS: "PART",
};

export async function addOrderItemAction(
  orderId: string,
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const serviceIdRaw = s(formData, "serviceId");
  const diagnosticTemplateIdRaw = s(formData, "diagnosticTemplateId");
  let kind = s(formData, "kind") as ItemKind;
  let description = s(formData, "description");
  const quantity = parseDecimal(s(formData, "quantity") || "1");
  let unitPrice = parseDecimal(s(formData, "unitPrice"));
  try { await assertOrderEditAccess(user, orderId); } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "Алдаа" }; }

  let serviceId: string | null = null;
  let isGoods = false;

  // Оношилгооны загвар сонгосон — DIAGNOSTIC kind line item болно
  if (diagnosticTemplateIdRaw) {
    const tpl = await prisma.diagnosticTemplate.findFirst({
      where: {
        id: diagnosticTemplateIdRaw,
        tenantId: user.tenantId,
        isActive: true,
      },
      select: { id: true, name: true, price: true },
    });
    if (!tpl) {
      return {
        ok: false,
        fieldErrors: { diagnosticTemplateId: "Оношилгоо олдсонгүй." },
      };
    }
    // Ижил оношилгоо нэг засварын хуудсанд давхардаж болохгүй (цуцлагдсан
    // мөрийг тооцохгүй — цуцалсан бол дахин нэмэх боломжтой).
    const dup = await prisma.serviceItem.findFirst({
      where: {
        orderId,
        kind: "DIAGNOSTIC",
        diagnosticTemplateId: tpl.id,
        status: { not: "CANCELLED" },
      },
      select: { id: true },
    });
    if (dup) {
      return {
        ok: false,
        fieldErrors: {
          diagnosticTemplateId: `«${tpl.name}» энэ засварын хуудаст аль хэдийн нэмэгдсэн байна.`,
        },
      };
    }
    kind = "DIAGNOSTIC";
    if (!description) description = tpl.name;
    if (!unitPrice) unitPrice = tpl.price ?? new Prisma.Decimal(0);
  } else if (serviceIdRaw) {
    // Үйлчилгээний каталогоос сонгосон
    const svc = await prisma.service.findFirst({
      where: { id: serviceIdRaw, tenantId: user.tenantId, isActive: true },
      select: {
        id: true,
        type: true,
        name: true,
        code: true,
        price: true,
        stock: true,
        unit: { select: { name: true } },
      },
    });
    if (!svc) {
      return { ok: false, fieldErrors: { serviceId: "Үйлчилгээ олдсонгүй." } };
    }
    serviceId = svc.id;
    const mappedKind = SERVICE_KIND_TO_ITEM_KIND[svc.type];
    if (!mappedKind) {
      return { ok: false, fieldErrors: { serviceId: "Үйлчилгээний төрөл буруу." } };
    }
    kind = mappedKind;
    isGoods = svc.type === "GOODS";
    if (!description) {
      description = svc.code ? `${svc.name} (${svc.code})` : svc.name;
    }
    if (!unitPrice) unitPrice = svc.price;

    if (isGoods && quantity && svc.stock && svc.stock.lt(quantity)) {
      return {
        ok: false,
        fieldErrors: {
          quantity: `Үлдэгдэл хүрэхгүй (одоо: ${svc.stock.toString()}${svc.unit?.name ? ` ${svc.unit.name}` : ""}).`,
        },
      };
    }
  }

  const errors: Record<string, string> = {};
  if (!(ITEM_KINDS as readonly string[]).includes(kind))
    errors.kind = "Төрлийг сонгоно уу.";
  if (!description) errors.description = "Нэр оруулна уу.";
  if (!quantity) errors.quantity = "Тоо ширхэг буруу.";
  if (!unitPrice) errors.unitPrice = "Үнэ буруу.";

  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, tenantId: user.tenantId },
    select: { id: true, branchId: true, status: true },
  });
  if (!order) return { ok: false, message: "Засварын хуудас олдсонгүй." };
  try {
    assertOrderBranchScope(user, order.branchId);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  if (isOrderLocked(order.status as OrderStatus)) {
    return {
      ok: false,
      message: "Дууссан / цуцлагдсан засварын хуудсанд мөр нэмж болохгүй.",
    };
  }

  const total = quantity!.times(unitPrice!);

  await prisma.$transaction(async (tx) => {
    const created = await tx.serviceItem.create({
      data: {
        orderId,
        kind,
        description,
        quantity: quantity!,
        unitPrice: unitPrice!,
        total,
        serviceId,
        diagnosticTemplateId: diagnosticTemplateIdRaw || null,
      },
      select: { id: true },
    });

    await logAudit(
      {
        tenantId: user.tenantId,
        userId: user.id,
        entity: "ServiceOrder",
        entityId: orderId,
        action: "ITEM_ADDED",
        summary: `${kind} · ${description} × ${quantity!.toString()} @ ${unitPrice!.toString()}`,
        after: {
          itemId: created.id,
          kind,
          description,
          quantity: quantity!.toString(),
          unitPrice: unitPrice!.toString(),
          total: total.toString(),
          serviceId,
          diagnosticTemplateId: diagnosticTemplateIdRaw || null,
        },
      },
      tx,
    );

    if (serviceId && isGoods) {
      await tx.service.update({
        where: { id: serviceId },
        data: { stock: { decrement: quantity! } },
      });
      await logAudit(
        {
          tenantId: user.tenantId,
          userId: user.id,
          entity: "Service",
          entityId: serviceId,
          action: "STOCK_CHANGE",
          summary: `-${quantity!.toString()} (засварын хуудас #${orderId})`,
          after: { delta: `-${quantity!.toString()}`, reason: "ORDER_ITEM_ADD" },
        },
        tx,
      );
    }

    await recomputeTotal(orderId, tx);
  });

  revalidatePath(`/dashboard/orders/${orderId}`);
  if (serviceId) {
    revalidatePath("/dashboard/services", "layout");
    revalidatePath(`/dashboard/services/${serviceId}`);
  }
  return { ok: true };
}

/**
 * Мөрийг цуцлана — УСТГАХГҮЙ, зөвхөн CANCELLED болгож хэн/хэзээ цуцалснаа
 * хадгална (түүх хадгалагдана). GOODS бол нөөцийг буцаана, нийт дүнг
 * цуцлагдсаныг эс тооцож дахин бодно.
 */
export async function cancelOrderItemAction(
  formData: FormData,
): Promise<void> {
  const user = await authorize("edit");
  const itemId = s(formData, "itemId");
  if (!itemId) return;

  const item = await prisma.serviceItem.findFirst({
    where: { id: itemId, order: { tenantId: user.tenantId } },
    select: {
      id: true,
      orderId: true,
      serviceId: true,
      quantity: true,
      status: true,
      service: { select: { type: true } },
      order: { select: { status: true, branchId: true, assignedToId: true } },
    },
  });
  if (!item) return;
  if (!canEditOrder(user, item.order)) return;
  assertOrderBranchScope(user, item.order.branchId);
  if (isOrderLocked(item.order.status as OrderStatus)) {
    throw new Error("Дууссан засварын хуудасны мөрийг цуцлаж болохгүй.");
  }
  if (!isServiceItemCancellable(item.status as ServiceItemStatus)) {
    throw new Error("Энэ мөрийг цуцлах боломжгүй.");
  }

  const restoreStock = item.serviceId && item.service?.type === "GOODS";

  await prisma.$transaction(async (tx) => {
    await tx.serviceItem.update({
      where: { id: item.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: user.id,
      },
    });
    await logAudit(
      {
        tenantId: user.tenantId,
        userId: user.id,
        entity: "ServiceOrder",
        entityId: item.orderId,
        action: "ITEM_CANCELLED",
        summary: `цуцалсан мөр ${item.id}`,
        before: {
          itemId: item.id,
          serviceId: item.serviceId,
          quantity: item.quantity.toString(),
        },
      },
      tx,
    );
    if (restoreStock && item.serviceId) {
      await tx.service.update({
        where: { id: item.serviceId },
        data: { stock: { increment: item.quantity } },
      });
      await logAudit(
        {
          tenantId: user.tenantId,
          userId: user.id,
          entity: "Service",
          entityId: item.serviceId,
          action: "STOCK_CHANGE",
          summary: `+${item.quantity.toString()} (мөр цуцлагдсан)`,
          after: {
            delta: `+${item.quantity.toString()}`,
            reason: "ORDER_ITEM_CANCEL",
          },
        },
        tx,
      );
    }

    await recomputeTotal(item.orderId, tx);
  });

  revalidatePath(`/dashboard/orders/${item.orderId}`);
  if (item.serviceId) {
    revalidatePath("/dashboard/services", "layout");
    revalidatePath(`/dashboard/services/${item.serviceId}`);
  }
}

/**
 * Мөрийн явцыг (хүлээгдэж буй/эхэлсэн/дууссан) чөлөөтэй, дурын дарааллаар
 * өөрчилнө — ганцхан нөхцөл: одоогийн явц цуцлагдаагүй байх. Цуцлахыг энд
 * зөвшөөрөхгүй — тусдаа cancelOrderItemAction-оор (хэн/хэзээг заавал хадгална).
 */
export async function changeOrderItemStatusAction(
  formData: FormData,
): Promise<void> {
  const user = await authorizeItemStatus();
  const itemId = s(formData, "itemId");
  const next = s(formData, "status") as ServiceItemStatus;
  if (!itemId || !next || next === "CANCELLED") return;
  if (!(SERVICE_ITEM_STATUSES as readonly string[]).includes(next)) return;

  const item = await prisma.serviceItem.findFirst({
    where: { id: itemId, order: { tenantId: user.tenantId } },
    select: {
      id: true,
      orderId: true,
      kind: true,
      status: true,
      diagnosticReportId: true,
      order: { select: { status: true, branchId: true, assignedToId: true } },
    },
  });
  if (!item) return;
  if (!canChangeOrderItemStatus(user, item.order)) return;
  assertOrderBranchScope(user, item.order.branchId);
  if (isOrderLocked(item.order.status as OrderStatus)) {
    throw new Error("Дууссан засварын хуудасны мөрийн явцыг өөрчлөх боломжгүй.");
  }
  if (!canChangeServiceItemStatus(item.status as ServiceItemStatus)) {
    throw new Error("Цуцлагдсан мөрийн явцыг өөрчлөх боломжгүй.");
  }
  // Оношилгоо бөглөгдсөнөөр (тайлантай холбогдсоноор) л дууссан гэж тооцно —
  // энэ мөрийн явцыг гараар шууд "дуусгах" боломжгүй, бусад төрөл чөлөөтэй.
  if (next === "COMPLETED" && item.kind === "DIAGNOSTIC" && !item.diagnosticReportId) {
    throw new Error("Оношилгоог эхлээд бөглөнө үү.");
  }

  await prisma.serviceItem.update({
    where: { id: item.id },
    data: { status: next },
  });
  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "ServiceOrder",
    entityId: item.orderId,
    action: "ITEM_STATUS_CHANGE",
    summary: `${item.status} → ${next} (мөр ${item.id})`,
    before: { status: item.status },
    after: { status: next },
  });

  revalidatePath(`/dashboard/orders/${item.orderId}`);
}
