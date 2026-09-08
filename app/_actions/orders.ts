"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import {
  canCreate,
  canDelete,
  canEdit,
  hasPermission,
  workingBranchScopeId,
} from "@/lib/auth/roles";
import { assertActiveSubscription } from "@/lib/subscription-server";
import { parseDurationInput } from "@/lib/category-duration";
import {
  ITEM_KINDS,
  ORDER_STATUS_TRANSITIONS,
  PAYMENT_STATUSES,
  SERVICE_ITEM_STATUSES,
  canChangeServiceItemStatus,
  isOrderLocked,
  isServiceItemCancellable,
  type ItemKind,
  type OrderStatus,
  type PaymentStatus,
  type ServiceItemStatus,
} from "@/lib/orders";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { enforceCountLimit } from "@/lib/plan-limits-server";
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import { ensureTenantVehicle } from "@/lib/vehicles";

export type OrderActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

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

async function nextOrderNumber(tenantId: string): Promise<string> {
  // Хамгийн өндөр дугаар дээр нэмнэ — count ашиглавал устгасан захиалгын улмаас
  // дугаар давхцаж (P2002) болзошгүй. Дугаарууд тэгээр гүйцээсэн тул desc эрэмбэ
  // нь тоон утгын дарааллыг өгнө.
  const last = await prisma.serviceOrder.findFirst({
    where: { tenantId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const lastNum = last ? Number.parseInt(last.number, 10) || 0 : 0;
  return String(lastNum + 1).padStart(5, "0");
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
    const number = await nextOrderNumber(user.tenantId);
    try {
      const created = await prisma.$transaction(async (tx) => {
        if (accountVehicleToLink) {
          await ensureTenantVehicle(tx, {
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
            tx,
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
  redirect(`/dashboard/orders/${createdId}`);
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
    select: { status: true },
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
      status: true,
      startedAt: true,
      estimatedDurationMinutes: true,
    },
  });
  if (!order) return { ok: false, message: "Засварын хуудас олдсонгүй." };

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

  const updates: Prisma.ServiceOrderUpdateInput = { status: next };
  const startedAt =
    next === "IN_PROGRESS" && order.status === "SCHEDULED"
      ? new Date()
      : order.startedAt;
  if (next === "IN_PROGRESS" && order.status === "SCHEDULED") {
    updates.startedAt = startedAt;
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
  if (next === "IN_PROGRESS" && startedAt && order.estimatedDurationMinutes) {
    updates.expectedFinishAt = new Date(
      startedAt.getTime() + order.estimatedDurationMinutes * 60000,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: updates,
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
    select: { id: true, status: true, occupiesCapacity: true },
  });
  if (!order) return { ok: false, message: "Засварын хуудас олдсонгүй." };
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

// --- PAYMENT STATUS -------------------------------------------------------

export async function changeOrderPaymentStatusAction(
  formData: FormData,
): Promise<void> {
  const user = await authorize("edit");
  const id = s(formData, "id");
  const next = s(formData, "paymentStatus") as PaymentStatus;
  const paidAmountRaw = s(formData, "paidAmount");

  if (!id) return;
  if (!(PAYMENT_STATUSES as readonly string[]).includes(next)) {
    throw new Error("Төлбөрийн төлөв буруу.");
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { id: true, totalAmount: true, paymentStatus: true },
  });
  if (!order) return;

  const updates: Prisma.ServiceOrderUpdateInput = { paymentStatus: next };

  if (next === "PAID") {
    updates.paidAt = new Date();
    updates.paidAmount = order.totalAmount ?? new Prisma.Decimal(0);
  } else if (next === "UNPAID") {
    updates.paidAt = null;
    updates.paidAmount = null;
  } else if (next === "PARTIAL") {
    const amt = parseDecimal(paidAmountRaw);
    if (!amt) {
      throw new Error("Хагас төлбөрийн дүнг зөв оруулна уу.");
    }
    if (order.totalAmount && amt.gt(order.totalAmount)) {
      throw new Error("Төлсөн дүн нийт дүнгээс их байж болохгүй.");
    }
    updates.paidAmount = amt;
    updates.paidAt = null;
  }

  const paidAmountStr =
    updates.paidAmount instanceof Prisma.Decimal
      ? updates.paidAmount.toString()
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: updates,
    });
    await logAudit(
      {
        tenantId: user.tenantId,
        userId: user.id,
        entity: "ServiceOrder",
        entityId: order.id,
        action: "PAYMENT_CHANGE",
        summary: `${order.paymentStatus} → ${next}${paidAmountStr ? ` (${paidAmountStr})` : ""}`,
        before: { paymentStatus: order.paymentStatus },
        after: { paymentStatus: next, paidAmount: paidAmountStr },
      },
      tx,
    );
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard");
}

// --- DELETE ---------------------------------------------------------------

export async function deleteOrderAction(formData: FormData): Promise<void> {
  const user = await authorize("delete");
  const id = s(formData, "id");
  if (!id) return;

  const target = await prisma.serviceOrder.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { number: true },
  });

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
    select: { id: true, status: true },
  });
  if (!order) return { ok: false, message: "Засварын хуудас олдсонгүй." };
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
      order: { select: { status: true } },
    },
  });
  if (!item) return;
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
      order: { select: { status: true } },
    },
  });
  if (!item) return;
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
