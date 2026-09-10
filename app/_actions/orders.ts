"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { customerLabel } from "@/lib/customers";
import { createNotification } from "@/lib/notifications";
import {
  canCreate,
  canDelete,
  canEdit,
  hasPermission,
  workingBranchScopeId,
} from "@/lib/auth/roles";
import { assertActiveSubscription } from "@/lib/subscription-server";
import { parseDurationInput, MAX_CATEGORY_DURATION_MINUTES } from "@/lib/category-duration";
import { isPendingAppointmentPaymentExpired } from "@/lib/appointment-payment-status";
import {
  ITEM_KINDS,
  ORDER_STATUS_TRANSITIONS,
  SERVICE_ITEM_STATUSES,
  canChangeServiceItemStatus,
  isOrderLocked,
  isServiceItemCancellable,
  type ItemKind,
  type OrderStatus,
  type ServiceItemStatus,
} from "@/lib/orders";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { enforceCountLimit } from "@/lib/plan-limits-server";
import { prisma, withBookingTransaction, type PrismaTransactionClient } from "@/lib/prisma";
import { bookingDateKey, bookingDayBounds } from "@/lib/booking-time";
import { resolveEffectiveSchedule } from "@/lib/branch-effective-schedule";
import { branchScheduleForDateSelect } from "@/lib/branch-effective-schedule-server";
import { timeToMinutes } from "@/lib/branches";
import { safeNext } from "@/lib/safe-redirect";
import { ensureTenantVehicle } from "@/lib/vehicles";
import { nextOrderNumber } from "@/lib/order-number";

export type OrderActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

type ScheduleConflict = {
  label: string;
  certainty: "definite" | "possible";
};

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
    const d = new Date(scheduledRaw);
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

async function validateScheduledOrderHours(
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
          select: { id: true },
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
      ? appointmentEstimatedDurationMinutes ?? 60
      : walkInEstimatedDurationMinutes ?? 60,
  );
  if (scheduledHoursError) {
    return { ok: false, fieldErrors: { scheduledAt: scheduledHoursError } };
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
          status: { in: ["SCHEDULED", "IN_PROGRESS", "WAITING_PARTS"] },
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
              ? appointmentEstimatedDurationMinutes
              : walkInEstimatedDurationMinutes,
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

  const { errors: refErrors, vehicleIsPostpaid } = await validateRefs(
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
      appointment: { select: { id: true, accountId: true, status: true } },
    },
  });
  if (!existing) {
    return { ok: false, message: "Засварын хуудас олдсонгүй." };
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
    existing.estimatedDurationMinutes ?? 60,
  );
  if (scheduledHoursError) {
    return { ok: false, fieldErrors: { scheduledAt: scheduledHoursError } };
  }

  // Товлосон огноог өөрчилж байгаа бөгөөд захиалга хараахан эхлээгүй (эсвэл
  // эхэлсэн ч сэлбэг хүлээж, товлосон огноогоороо тооцогддог) үед л
  // давхцлыг шалгана — reviseExpectedFinishAction-той адил, зөвхөн
  // анхааруулга, хатуу хориглол биш (D-хугацааны шийдвэр, COWORK.md-г үз).
  const scheduledChanged =
    data.scheduledAt != null &&
    (existing.scheduledAt == null ||
      data.scheduledAt.getTime() !== existing.scheduledAt.getTime());
  const confirmed = s(formData, "confirmed") === "true";
  if (existing.status === "SCHEDULED" && scheduledChanged && !confirmed) {
    // Хугацаа тодорхойгүй бол (тооцоолол алга) 1 цагийн ойролцоо цонхоор
    // шалгана — зөвхөн анхааруулгын зорилготой энгийн таамаг, хадгалагдахгүй.
    const durationMinutes = existing.estimatedDurationMinutes ?? 60;
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
        message: `Шинэ товлосон огноо ${conflict}-тай давхцаж байна. Үргэлжлүүлэхийн тулд дахин "Хадгалах" дарна уу.`,
        fieldErrors: { confirmNeeded: "true" },
      };
    }
  }

  try {
    // Машин солигдож болзошгүй тул дараа төлбөрт snapshot-ыг дахин тооцно.
    const updated = await prisma.serviceOrder.updateMany({
      where: scopedOrderWhere,
      data: { ...data, isPostpaid: vehicleIsPostpaid },
    });
    if (updated.count === 0) {
      return { ok: false, message: "Засварын хуудас олдсонгүй." };
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Шинэчлэх явцад алдаа гарлаа.",
    };
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

  const order = await prisma.serviceOrder.findFirst({
    where: { id, tenantId: user.tenantId },
    select: {
      id: true,
      branchId: true,
      status: true,
      startedAt: true,
      estimatedDurationMinutes: true,
    },
  });
  if (!order) return { ok: false, message: "Засварын хуудас олдсонгүй." };
  try {
    assertOrderBranchScope(user, order.branchId);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const allowed = ORDER_STATUS_TRANSITIONS[order.status as OrderStatus];
  if (!allowed?.includes(next)) {
    return { ok: false, message: "Энэ статус руу шилжих боломжгүй." };
  }

  // Дуусгахаас өмнө нэмэгдсэн оношилгооны мөр бүгд тайлантай (бөглөгдсөн) байх ёстой.
  if (next === "COMPLETED") {
    const pending = await prisma.serviceItem.count({
      where: {
        orderId: order.id,
        kind: "DIAGNOSTIC",
        status: { not: "CANCELLED" },
        diagnosticReportId: null,
      },
    });
    if (pending > 0) {
      return {
        ok: false,
        message:
          "Бөглөгдөөгүй оношилгоо байна. Бүх оношилгоог бөглөсний дараа засварын хуудсыг дуусгана уу.",
      };
    }
  }

  const now = new Date();
  const enteringInProgress = next === "IN_PROGRESS";
  const startingFresh = enteringInProgress && order.status === "SCHEDULED";
  const resuming = enteringInProgress && order.status === "WAITING_PARTS";

  // Ажил эхлэхэд (эсвэл сэлбэгээс сэргэхэд) үргэлжлэх хугацааны тооцоолол
  // байх ёстой — эс бөгөөс энэ захиалга хугацаагүй, тодорхойгүй хугацаагаар
  // ажлын байрыг эзэлж, cap=1 мэт бага багтаамжтай салбарт БҮХ цаг захиалгыг
  // бүрмөсөн хаадаг байсан (D-хугацааны шийдвэр). Аль хэдийн тооцоолол байвал
  // (жишээ нь холбогдсон цаг захиалгаас өвлөгдсөн) дахин асуухгүй.
  let effectiveDurationMinutes = order.estimatedDurationMinutes;
  if (enteringInProgress && effectiveDurationMinutes == null) {
    const parsed = parseDurationInput(
      s(formData, "durationHours"),
      s(formData, "durationMinutes"),
    );
    if (!parsed.ok) {
      return { ok: false, fieldErrors: { duration: parsed.error } };
    }
    if (parsed.minutes == null) {
      return {
        ok: false,
        fieldErrors: {
          duration: "Ажлыг эхлүүлэхийн өмнө ойролцоо үргэлжлэх хугацааг оруулна уу.",
        },
      };
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
  // ажил тэр даруй суллана. Сэлбэг хүлээх рүү шилжихэд ажилтан өөрөө тодорхой
  // сонгоно ("occupiesCapacity" талбар, status-controls.tsx-ийн диалогоос) —
  // ирээгүй бол консерватив анхны утга true (хуучин дуудагчидтай нийцтэй).
  if (next === "COMPLETED" || next === "CANCELLED") {
    updates.occupiesCapacity = false;
  } else if (next === "WAITING_PARTS" && formData.has("occupiesCapacity")) {
    updates.occupiesCapacity = s(formData, "occupiesCapacity") === "true";
  } else {
    updates.occupiesCapacity = true;
  }
  if (enteringInProgress && effectiveDurationMinutes != null) {
    // Сэлбэг хүлээснээс сэргэхэд анхны эхэлсэн цагаас биш, ОДООгоос тоолж
    // дуусах хугацааг дахин тооцоолно — эс бөгөөс хүлээсэн хугацаа тооцогдохгүй,
    // дуусах хугацаа хуучирсан хэвээр үлдэнэ.
    const anchor = resuming ? now : startedAt;
    if (anchor) {
      updates.expectedFinishAt = new Date(
        anchor.getTime() + effectiveDurationMinutes * 60000,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: updates,
    });
    // Захиалгыг бүхэлд нь цуцлахад дотор нь бөглөгдсөн (COMPLETED) байсан
    // мөр — тэр дундаа бөглөгдсөн оношилгооны хуудас — идэвхтэй хэвээр
    // үлдэж, дуусаагүй мэт харагдахаас сэргийлж бүх мөрийг мөн цуцална.
    if (next === "CANCELLED") {
      await tx.serviceItem.updateMany({
        where: { orderId: order.id, status: { not: "CANCELLED" } },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: user.id },
      });
    }
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
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Статус шинэчлэгдлээ." };
}

// --- CAPACITY (WAITING_PARTS-с гадна, статус солихгүйгээр) ---------------

// Сэлбэг хүлээж буй захиалгын ажлын байрны эзэмшлийг статус солихгүйгээр
// суллах/сэргээх ("release/resume workspace"). Зөвхөн WAITING_PARTS үед л
// хамаатай — бусад статусад occupiesCapacity нь changeOrderStatusAction-оор
// л удирдагдана (COMPLETED/CANCELLED → false, бусад → true).
export async function setOrderCapacityAction(
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
  const occupiesCapacity = s(formData, "occupiesCapacity") === "true";
  if (!id) return { ok: false, message: "Буруу хүсэлт." };

  const order = await prisma.serviceOrder.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { id: true, branchId: true, status: true, occupiesCapacity: true },
  });
  if (!order) return { ok: false, message: "Засварын хуудас олдсонгүй." };
  try {
    assertOrderBranchScope(user, order.branchId);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  if (order.status !== "WAITING_PARTS") {
    return {
      ok: false,
      message: "Зөвхөн сэлбэг хүлээж буй захиалгад энэ үйлдлийг хийх боломжтой.",
    };
  }
  if (order.occupiesCapacity === occupiesCapacity) {
    return { ok: true, message: "Өөрчлөлт алга." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: { occupiesCapacity },
    });
    await logAudit(
      {
        tenantId: user.tenantId,
        userId: user.id,
        entity: "ServiceOrder",
        entityId: order.id,
        action: "STATUS_CHANGE",
        summary: occupiesCapacity
          ? "Ажлын байрны эзэмшлийг сэргээв"
          : "Ажлын байрыг суллав",
        before: { occupiesCapacity: order.occupiesCapacity },
        after: { occupiesCapacity },
      },
      tx,
    );
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: occupiesCapacity ? "Ажлын байрыг сэргээлээ." : "Ажлын байрыг суллалаа.",
  };
}

// --- EXPECTED FINISH TIME (manual revision) --------------------------------

// Дуусах хугацааг тооцоолсноос хойш ажилтан гар аргаар засаж чадна (сэлбэг
// хүлээх, гэнэтийн ажил зэргээс шалтгаалан хойшлох тохиолдол) — анхны
// автомат тооцооллоос ялгаатай, дурын үедээ дуудагдана. Анхны утга анх
// тавигдахад (өмнө нь байгаагүй үед) мэдэгдэл илгээхгүй — зөвхөн ЗАСВАРЛАСАН
// (өөрчилсөн) үед л, ба ялгаа 15 минутаас бага бол чимээгүй алгасна (эргэлзээт
// бага зөрүүгээр үйлчлүүлэгчийг дэмий цочроохгүйн тулд).
const MEANINGFUL_FINISH_CHANGE_MS = 15 * 60 * 1000;

// Салбарт өөр бай/лифтийн загвар байхгүй тул систем "давхцал"-ыг хатуу
// хязгаарлал биш, зөвхөн ажилтанд харуулах анхааруулга болгон ашиглана
// (D-хугацааны шийдвэр — жинхэнэ засварын ажил урьдчилан таамаглашгүй тул
// хатуу хориглол бодит байдалтай зөрчилддөг). lib/branch-schedule.ts-ийн
// зарчимтай адил (эхлэл/төгсгөл давхцах эсэх), гагцхүү зөвхөн энэ нэг
// захиалгын шинэ дуусах хугацаатай мөргөлдөх хамгийн ойрын нэгийг л олно.
async function findScheduleConflict(
  tenantId: string,
  branchId: string,
  excludeOrderId: string,
  start: Date,
  end: Date,
): Promise<ScheduleConflict | null> {
  // An appointment with no saved duration is treated as a "possible" conflict
  // for as long as it could still be running — but never floors ago: a stale
  // PENDING/CONFIRMED appointment from months back must not read as an
  // indefinite, still-ongoing conflict against a revision made today. Floor
  // at MAX_CATEGORY_DURATION_MINUTES (the platform's own definition of the
  // longest a single booking can legitimately run) before `start`, the same
  // stale-row guard lib/branch-schedule-loader.ts applies for the day view.
  const conflictFloor = new Date(start.getTime() - MAX_CATEGORY_DURATION_MINUTES * 60000);

  const [appts, orders] = await Promise.all([
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
    prisma.serviceOrder.findMany({
      where: {
        tenantId,
        branchId,
        id: { not: excludeOrderId },
        status: { in: ["SCHEDULED", "IN_PROGRESS", "WAITING_PARTS"] },
      },
      select: {
        number: true,
        status: true,
        scheduledAt: true,
        startedAt: true,
        estimatedDurationMinutes: true,
        expectedFinishAt: true,
        occupiesCapacity: true,
        customer: { select: { fullName: true, phone: true } },
      },
    }),
  ]);

  const startMs = start.getTime();
  const endMs = end.getTime();

  for (const a of appts) {
    if (a.status === "PENDING" && isPendingAppointmentPaymentExpired(a)) continue;
    const s0 = a.requestedAt.getTime();
    const e0 = a.estimatedDurationMinutes
      ? s0 + a.estimatedDurationMinutes * 60000
      : Number.POSITIVE_INFINITY;
    if (s0 < endMs && e0 > startMs) {
      return {
        label: `цаг захиалга (${customerLabel({ fullName: a.account?.name ?? a.customer?.fullName, phone: a.account?.phone ?? a.customer?.phone })})`,
        certainty: a.estimatedDurationMinutes == null ? "possible" : "definite",
      };
    }
  }

  for (const o of orders) {
    if (o.status !== "SCHEDULED" && o.occupiesCapacity === false) continue;
    // Which timestamp is authoritative depends only on whether work has
    // actually started (status), never on occupiesCapacity — that flag only
    // decides above whether the row is excluded at all. A SCHEDULED order has
    // no startedAt yet; falling back to it here would silently drop the order
    // from conflict detection (s0 == null → continue below) if occupiesCapacity
    // were ever true while still SCHEDULED.
    const scheduled = o.status === "SCHEDULED";
    const s0 = (scheduled ? o.scheduledAt : o.startedAt)?.getTime();
    if (s0 == null) continue;
    const e0 =
      o.expectedFinishAt?.getTime() ??
      (scheduled && o.estimatedDurationMinutes
        ? s0 + o.estimatedDurationMinutes * 60000
        : Number.POSITIVE_INFINITY);
    if (s0 < endMs && e0 > startMs) {
      return {
        label: `захиалга #${o.number} (${customerLabel(o.customer)})`,
        certainty: e0 === Number.POSITIVE_INFINITY ? "possible" : "definite",
      };
    }
  }

  return null;
}

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

  let expectedFinishAt: Date | null = null;
  if (expectedFinishRaw) {
    const d = new Date(expectedFinishRaw);
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

  if (order.status !== "IN_PROGRESS" && order.status !== "WAITING_PARTS") {
    return {
      ok: false,
      message: "Дуусах хугацааг зөвхөн ажиллаж буй засварын хуудсанд тохируулна.",
    };
  }

  if (expectedFinishAt) {
    if (!order.startedAt) {
      return {
        ok: false,
        message: "Дуусах хугацаа тохируулахын өмнө ажлын эхэлсэн цагийг тэмдэглэнэ үү.",
      };
    }
    if (expectedFinishAt.getTime() <= order.startedAt.getTime()) {
      return {
        ok: false,
        fieldErrors: {
          expectedFinishAt: "Дуусах хугацаа эхэлсэн хугацаанаас хойш байх ёстой.",
        },
      };
    }
  }

  if (expectedFinishAt && !confirmed) {
    const conflictStart = order.startedAt!;
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

  await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: { expectedFinishAt },
    });
    await logAudit(
      {
        tenantId: user.tenantId,
        userId: user.id,
        entity: "ServiceOrder",
        entityId: order.id,
        action: "UPDATE",
        summary: "Дуусах хугацааг гар аргаар шинэчлэв",
        before: { expectedFinishAt: previous?.toISOString() ?? null },
        after: { expectedFinishAt: expectedFinishAt?.toISOString() ?? null },
      },
      tx,
    );
  });

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

  const scheduledAt = new Date(scheduledRaw);
  if (!Number.isFinite(scheduledAt.getTime())) {
    return { ok: false, fieldErrors: { scheduledAt: "Огноо буруу." } };
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

  if (!confirmed) {
    const durationMinutes = order.estimatedDurationMinutes ?? 60;
    const conflictEnd = new Date(scheduledAt.getTime() + durationMinutes * 60000);
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
        message: `Шинэ товлосон огноо ${conflict}-тай давхцаж байна. Үргэлжлүүлэхийн тулд дахин "Хадгалах" дарна уу.`,
        fieldErrors: { confirmNeeded: "true" },
      };
    }
  }

  const previous = order.scheduledAt;

  await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: { scheduledAt },
    });
    await logAudit(
      {
        tenantId: user.tenantId,
        userId: user.id,
        entity: "ServiceOrder",
        entityId: order.id,
        action: "UPDATE",
        summary: "Товлосон огноог хуваарийн хуудаснаас шилжүүлэв",
        before: { scheduledAt: previous?.toISOString() ?? null },
        after: { scheduledAt: scheduledAt.toISOString() },
      },
      tx,
    );
  });

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

  const hasPaidPayment = await prisma.orderPayment.findFirst({
    where: { orderId: id, status: "PAID" },
    select: { id: true },
  });
  if (hasPaidPayment) {
    throw new Error(
      "Энэ засварын хуудсанд төлбөр төлөгдсөн тул устгах боломжгүй.",
    );
  }

  await prisma.$transaction(async (tx) => {
    // PENDING/CANCELLED/FAILED зэрэг бодит мөнгө хөдлөөгүй оролдлогуудыг
    // устгана — OrderPayment.orderId одоо Restrict тул захиалга устахаас
    // өмнө эдгээрийг цэвэрлэх шаардлагатай.
    await tx.orderPayment.deleteMany({
      where: { orderId: id, status: { not: "PAID" } },
    });
    await tx.serviceOrder.delete({
      where: { id, tenantId: user.tenantId },
    });
  });

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
      order: { select: { status: true, branchId: true } },
    },
  });
  if (!item) return;
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
      order: { select: { status: true, branchId: true } },
    },
  });
  if (!item) return;
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
