"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/account";
import { requireUser } from "@/lib/auth";
import { branchScopeId, canCreate, canEdit } from "@/lib/auth/roles";
import {
  resolveCustomerForAccount,
  snapshotVehicleForAccount,
} from "@/lib/appointments";
import {
  DEFAULT_SLOT_CAPACITY,
  DEFAULT_SLOT_MINUTES,
  type DayAvailability,
  buildDaySlots,
  isSlotAvailable,
  weekdayFromDate,
} from "@/lib/appointment-slots";
import { logAudit } from "@/lib/audit";
import { createNotification, notifyStaff } from "@/lib/notifications";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { isFeatureEnabled } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";

// Мэдэгдэлд цаг харуулах нэг мөрийн формат.
function formatWhen(d: Date): string {
  return d.toLocaleString("mn-MN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type AppointmentActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Тухайн салбар + өдрийн (YYYY-MM-DD) цагийн нүхнүүдийг буцаана — захиалгатай
 * (завгүй) болон сул цагуудтай. Хэрэглэгчийн booking-form-оос дуудна.
 */
export async function getBranchDaySlots(
  branchId: string,
  dateStr: string,
): Promise<DayAvailability> {
  if (!branchId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { open: false, reason: "Буруу өдөр.", slots: [] };
  }
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      openTime: true,
      closeTime: true,
      slotMinutes: true,
      slotCapacity: true,
      schedules: {
        select: {
          weekday: true,
          isOpen: true,
          openTime: true,
          closeTime: true,
        },
      },
    },
  });
  if (!branch) return { open: false, reason: "Салбар олдсонгүй.", slots: [] };

  const date = new Date(`${dateStr}T00:00:00`);
  if (!Number.isFinite(date.getTime())) {
    return { open: false, reason: "Буруу өдөр.", slots: [] };
  }
  const weekday = weekdayFromDate(date);
  const sched = branch.schedules.find((x) => x.weekday === weekday);
  const open = sched
    ? sched.isOpen
    : Boolean(branch.openTime && branch.closeTime);
  const openTime = sched?.openTime ?? branch.openTime;
  const closeTime = sched?.closeTime ?? branch.closeTime;

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60000);
  const taken = open
    ? await prisma.appointment.findMany({
        where: {
          branchId,
          status: { in: ["PENDING", "CONFIRMED"] },
          requestedAt: { gte: dayStart, lt: dayEnd },
        },
        select: { requestedAt: true },
      })
    : [];

  return buildDaySlots({
    dateStr,
    open,
    openTime,
    closeTime,
    slotMinutes: branch.slotMinutes ?? DEFAULT_SLOT_MINUTES,
    capacity: branch.slotCapacity ?? DEFAULT_SLOT_CAPACITY,
    taken: taken.map((t) => t.requestedAt),
    now: new Date(),
  });
}

// --- Хэрэглэгчийн тал (Account) -------------------------------------------

/**
 * Account вэб/аппаас цаг хүсэх. Branch-аас тенантыг тодорхойлж PENDING үүсгэнэ.
 * (Consumer UI нь Phase 3-д; энэ action бэлэн байна.)
 */
export async function createAppointment(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const account = await requireAccount();

  const branchId = s(formData, "branchId");
  const requestedRaw = s(formData, "requestedAt");
  const note = s(formData, "note");
  const accountVehicleId = s(formData, "accountVehicleId") || null;

  const fieldErrors: Record<string, string> = {};
  if (!branchId) fieldErrors.branchId = "Салбараа сонгоно уу.";

  let requestedAt: Date | null = null;
  if (!requestedRaw) {
    fieldErrors.requestedAt = "Цагаа сонгоно уу.";
  } else {
    const d = new Date(requestedRaw);
    if (!Number.isFinite(d.getTime())) {
      fieldErrors.requestedAt = "Огноо буруу.";
    } else if (d.getTime() < Date.now()) {
      fieldErrors.requestedAt = "Өнгөрсөн цаг сонгох боломжгүй.";
    } else {
      requestedAt = d;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      tenantId: true,
      tenant: { select: { acceptsOnlineBooking: true, suspended: true } },
    },
  });
  if (!branch) {
    return { ok: false, fieldErrors: { branchId: "Салбар олдсонгүй." } };
  }
  if (!branch.tenant.acceptsOnlineBooking || branch.tenant.suspended) {
    return {
      ok: false,
      message: "Энэ байгууллага онлайн цаг захиалга хүлээн авахгүй байна.",
    };
  }
  // Багц дэмжихгүй болсон (downgrade) тохиолдолд блоклоно.
  const bookingEnabled = await isFeatureEnabled(
    branch.tenantId,
    PLAN_LIMIT_CODES.ONLINE_BOOKING,
  );
  if (!bookingEnabled) {
    return {
      ok: false,
      message: "Энэ байгууллага онлайн цаг захиалга хүлээн авахгүй байна.",
    };
  }

  // Сонгосон цаг хараахан дүүрээгүй эсэхийг шалгана (давхар захиалга).
  if (!(await isSlotAvailable(prisma, branch.id, requestedAt!))) {
    return {
      ok: false,
      fieldErrors: {
        requestedAt: "Энэ цаг дүүрсэн байна. Өөр цаг сонгоно уу.",
      },
    };
  }

  // Машин сонгосон бол тухайн Account-ийнх мөн эсэхийг шалгана.
  if (accountVehicleId) {
    const owned = await prisma.accountVehicle.findFirst({
      where: { id: accountVehicleId, accountId: account.id },
      select: { id: true },
    });
    if (!owned) {
      return { ok: false, fieldErrors: { accountVehicleId: "Машин олдсонгүй." } };
    }
  }

  const created = await prisma.appointment.create({
    data: {
      tenantId: branch.tenantId,
      branchId: branch.id,
      accountId: account.id,
      accountVehicleId,
      requestedAt: requestedAt!,
      note: note || null,
      status: "PENDING",
    },
  });

  // Холбогдох ажилтнуудад шинэ цаг захиалга ирсэн тухай мэдэгдэнэ.
  try {
    const who = account.name?.trim() || account.phone;
    await notifyStaff({
      type: "appointment_created",
      tenantId: branch.tenantId,
      branchId: branch.id,
      input: {
        appointmentId: created.id,
        body: `${who} — ${formatWhen(requestedAt!)} цагт цаг захиаллаа.`,
      },
    });
  } catch (e) {
    console.warn("[notify] createAppointment:", e);
  }

  revalidatePath("/account");
  redirect("/account");
}

/**
 * Хэрэглэгч өөрийн PENDING/CONFIRMED цагаа цуцлах.
 */
export async function cancelAppointmentByAccount(
  formData: FormData,
): Promise<void> {
  const account = await requireAccount();
  const id = s(formData, "id");
  if (!id) return;

  const appt = await prisma.appointment.findFirst({
    where: { id, accountId: account.id },
    select: {
      id: true,
      status: true,
      tenantId: true,
      branchId: true,
      requestedAt: true,
    },
  });
  if (!appt || (appt.status !== "PENDING" && appt.status !== "CONFIRMED")) {
    return;
  }

  await prisma.appointment.update({
    where: { id: appt.id },
    data: { status: "CANCELLED" },
  });

  // Холбогдох ажилтнуудад цуцалсан тухай мэдэгдэнэ.
  try {
    const who = account.name?.trim() || account.phone;
    await notifyStaff({
      type: "appointment_cancelled",
      tenantId: appt.tenantId,
      branchId: appt.branchId,
      input: {
        appointmentId: appt.id,
        body: `${who} — ${formatWhen(appt.requestedAt)} цагийн захиалгаа цуцаллаа.`,
      },
    });
  } catch (e) {
    console.warn("[notify] cancelAppointmentByAccount:", e);
  }

  revalidatePath("/account");
}

// --- Ажилтны тал (User) ---------------------------------------------------

/**
 * Ажилтан утсаар орж ирсэн цаг захиалгыг гараар бүртгэнэ. Account-гүй (phone-in)
 * тул тенантын Customer-ыг шууд оноож, CONFIRMED-ээр үүсгэнэ. Захиалга (order)
 * нь дараа нь "Захиалга үүсгэх" холбоосоор үүснэ.
 */
export async function registerAppointmentByStaff(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const user = await requireUser();
  if (!canCreate(user, "appointments")) {
    return { ok: false, message: "Танд цаг захиалга бүртгэх эрх байхгүй." };
  }

  const branchId = s(formData, "branchId");
  const customerId = s(formData, "customerId");
  const requestedRaw = s(formData, "requestedAt");
  const note = s(formData, "note");

  const fieldErrors: Record<string, string> = {};
  if (!branchId) fieldErrors.branchId = "Салбараа сонгоно уу.";
  if (!customerId) fieldErrors.customerId = "Үйлчлүүлэгчээ сонгоно уу.";

  let requestedAt: Date | null = null;
  if (!requestedRaw) {
    fieldErrors.requestedAt = "Цагаа сонгоно уу.";
  } else {
    const d = new Date(requestedRaw);
    if (!Number.isFinite(d.getTime())) fieldErrors.requestedAt = "Огноо буруу.";
    else requestedAt = d;
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const scope = branchScopeId(user);
  if (scope && branchId !== scope) {
    return {
      ok: false,
      fieldErrors: { branchId: "Зөвхөн өөрийн салбарт бүртгэх боломжтой." },
    };
  }

  const [branch, customer] = await Promise.all([
    prisma.branch.findFirst({
      where: { id: branchId, tenantId: user.tenantId },
      select: { id: true },
    }),
    prisma.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true },
    }),
  ]);
  if (!branch) return { ok: false, fieldErrors: { branchId: "Салбар олдсонгүй." } };
  if (!customer) {
    return { ok: false, fieldErrors: { customerId: "Үйлчлүүлэгч олдсонгүй." } };
  }

  if (!(await isSlotAvailable(prisma, branchId, requestedAt!))) {
    return {
      ok: false,
      fieldErrors: {
        requestedAt: "Энэ цаг дүүрсэн байна. Өөр цаг сонгоно уу.",
      },
    };
  }

  const created = await prisma.appointment.create({
    data: {
      tenantId: user.tenantId,
      branchId,
      customerId,
      accountId: null,
      requestedAt: requestedAt!,
      note: note || null,
      status: "CONFIRMED",
      respondedAt: new Date(),
      respondedById: user.id,
    },
    select: { id: true },
  });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    branchId,
    entity: "Appointment",
    entityId: created.id,
    action: "CREATE",
    summary: "Утсаар цаг бүртгэсэн",
    after: {
      customerId,
      requestedAt: requestedAt!.toISOString(),
      status: "CONFIRMED",
    },
  });

  revalidatePath("/dashboard/appointments");
  redirect("/dashboard/appointments");
}

async function authorizeStaff(branchId?: string) {
  const user = await requireUser();
  if (!canEdit(user, "appointments")) {
    throw new Error("Танд цаг захиалга удирдах эрх байхгүй.");
  }
  const scope = branchScopeId(user);
  if (scope && branchId && branchId !== scope) {
    throw new Error("Зөвхөн өөрийн салбарын цаг захиалгыг удирдана.");
  }
  return user;
}

/**
 * Ажилтан цаг баталгаажуулна:
 *   - утсаар тенантын Customer-ыг resolve/create (гүүр)
 *   - appointment-ийг CONFIRMED болгож, тухайн Customer-той холбоно
 * Захиалга (ServiceOrder) нь дараа нь order урсгалаар үүснэ.
 */
export async function confirmAppointment(formData: FormData): Promise<void> {
  const id = s(formData, "id");
  if (!id) return;

  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, phone: true, name: true, email: true } },
      accountVehicle: {
        select: {
          plate: true,
          make: true,
          model: true,
          year: true,
          vin: true,
          fuelType: true,
          wheelPosition: true,
          mileage: true,
        },
      },
    },
  });
  if (!appt) return;

  const user = await authorizeStaff(appt.branchId);
  if (user.tenantId !== appt.tenantId) return;
  if (appt.status !== "PENDING") return;
  // Онлайн захиалгад Account заавал байна (phone-in нь CONFIRMED-ээр үүсдэг тул
  // энд хүрэхгүй). Account байхгүй бол resolve хийх боломжгүй.
  if (!appt.account) return;
  const account = appt.account;
  const accountVehicle = appt.accountVehicle;

  await prisma.$transaction(async (tx) => {
    const customerId = await resolveCustomerForAccount(
      tx,
      appt.tenantId,
      account,
    );
    // Хэрэглэгч машинаа сонгосон бол тенантын Vehicle руу snapshot хийнэ.
    let vehicleId: string | null = null;
    if (accountVehicle) {
      vehicleId = await snapshotVehicleForAccount(
        tx,
        appt.tenantId,
        customerId,
        accountVehicle,
      );
    }
    await tx.appointment.update({
      where: { id: appt.id },
      data: {
        status: "CONFIRMED",
        customerId,
        vehicleId,
        respondedAt: new Date(),
        respondedById: user.id,
      },
    });
    await logAudit(
      {
        tenantId: appt.tenantId,
        userId: user.id,
        branchId: appt.branchId,
        entity: "Appointment",
        entityId: appt.id,
        action: "STATUS_CHANGE",
        summary: "Цаг баталгаажуулсан",
        after: { status: "CONFIRMED", customerId, vehicleId },
      },
      tx,
    );
  });

  // Мэдэгдэл (DB + push). Алдаа гарвал confirm-ийг тасалдуулахгүй.
  try {
    await createNotification({
      type: "appointment_confirmed",
      recipient: { accountId: account.id },
      input: { appointmentId: appt.id },
    });
  } catch (e) {
    console.warn("[notify] confirmAppointment:", e);
  }

  revalidatePath("/dashboard/appointments");
}

/** Ажилтан цаг татгалзах. */
export async function rejectAppointment(formData: FormData): Promise<void> {
  const id = s(formData, "id");
  if (!id) return;

  const appt = await prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      branchId: true,
      status: true,
      accountId: true,
    },
  });
  if (!appt) return;

  const user = await authorizeStaff(appt.branchId);
  if (user.tenantId !== appt.tenantId) return;
  if (appt.status !== "PENDING") return;

  await prisma.appointment.update({
    where: { id: appt.id },
    data: {
      status: "REJECTED",
      respondedAt: new Date(),
      respondedById: user.id,
    },
  });
  await logAudit({
    tenantId: appt.tenantId,
    userId: user.id,
    branchId: appt.branchId,
    entity: "Appointment",
    entityId: appt.id,
    action: "STATUS_CHANGE",
    summary: "Цаг татгалзсан",
    after: { status: "REJECTED" },
  });

  // Онлайн захиалга (Account-той) бол хэрэглэгчид мэдэгдэнэ.
  if (appt.accountId) {
    try {
      await createNotification({
        type: "appointment_rejected",
        recipient: { accountId: appt.accountId },
        input: { appointmentId: appt.id },
      });
    } catch (e) {
      console.warn("[notify] rejectAppointment:", e);
    }
  }

  revalidatePath("/dashboard/appointments");
}

/** Ажилтан "ирээгүй" гэж тэмдэглэх (зөвхөн CONFIRMED-аас). */
export async function markAppointmentNoShow(formData: FormData): Promise<void> {
  const id = s(formData, "id");
  if (!id) return;

  const appt = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, tenantId: true, branchId: true, status: true },
  });
  if (!appt) return;

  const user = await authorizeStaff(appt.branchId);
  if (user.tenantId !== appt.tenantId) return;
  if (appt.status !== "CONFIRMED") return;

  await prisma.appointment.update({
    where: { id: appt.id },
    data: { status: "NO_SHOW" },
  });
  await logAudit({
    tenantId: appt.tenantId,
    userId: user.id,
    branchId: appt.branchId,
    entity: "Appointment",
    entityId: appt.id,
    action: "STATUS_CHANGE",
    summary: "Цагт ирээгүй гэж тэмдэглэв",
    after: { status: "NO_SHOW" },
  });

  revalidatePath("/dashboard/appointments");
}
