"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/account";
import { requireUser } from "@/lib/auth";
import { assertActiveSubscription } from "@/lib/subscription-server";
import { canCreate, canEdit, workingBranchScopeId } from "@/lib/auth/roles";
import { formatWhen, resolveCustomerForAccount } from "@/lib/appointments";
import { ensureAppointmentFeeCheckout } from "@/lib/appointment-payments";
import {
  isSlotAvailable,
  resolveBranchCategoryDurations,
  resolveTakenCapacityIntervals,
} from "@/lib/category-duration";
import { ensureTenantVehicle } from "@/lib/vehicles";
import {
  DEFAULT_SLOT_CAPACITY,
  DEFAULT_SLOT_MINUTES,
  type DayAvailability,
  buildDaySlots,
} from "@/lib/appointment-slots";
import { logAudit } from "@/lib/audit";
import { customerLabel } from "@/lib/customers";
import { createNotification, notifyStaff } from "@/lib/notifications";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { isFeatureEnabled } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";
import { reserveAppointment, ReservationError, ReservationConflictError } from "@/lib/appointment-reservations";
import { bookingDateKey, bookingDayBounds } from "@/lib/booking-time";
import { resolveEffectiveSchedule } from "@/lib/branch-effective-schedule";
import { branchScheduleForDateSelect } from "@/lib/branch-effective-schedule-server";
import { timeToMinutes } from "@/lib/branches";
import { safeNext } from "@/lib/safe-redirect";
import { setBypassContext } from "@/lib/tenant-context";
import { appointmentBookingPaymentStatus } from "@/lib/appointment-payment-status";

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
 *
 * Booking v2: `categoryIds` (заавал биш) өгвөл захиалгын нийт үргэлжлэх
 * хугацааг (branch override ?? category default ?? 30) тэдгээрийн нийлбэрээр
 * тооцож, slot-ийн "хаах цагт багтах уу" хилд ашиглана (mobile-ийн
 * `/branches/[branchId]/availability` endpoint-той адил дүрэм).
 */
export async function getBranchDaySlots(
  branchId: string,
  dateStr: string,
  categoryIds: string[] = [],
): Promise<DayAvailability> {
  // Нэвтрээгүй зочид ч дуудах нийтэд нээлттэй action (booking-form-оос) тул
  // bypass ашиглана — org/[slug]/page.tsx-ийн адил зарчим.
  setBypassContext();
  if (!branchId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { open: false, reason: "Буруу өдөр.", slots: [] };
  }
  let date: Date;
  try { date = bookingDayBounds(dateStr).start; } catch {
    return { open: false, reason: "Буруу өдөр.", slots: [] };
  }
  if (!Number.isFinite(date.getTime())) {
    return { open: false, reason: "Буруу өдөр.", slots: [] };
  }
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      slotMinutes: true,
      slotCapacity: true,
      ...branchScheduleForDateSelect(dateStr),
    },
  });
  if (!branch) return { open: false, reason: "Салбар олдсонгүй.", slots: [] };
  const schedule = resolveEffectiveSchedule({ dateStr, branch });
  const { open, openTime, closeTime } = schedule;

  const dayStart = date;
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60000);
  const slotMin = branch.slotMinutes ?? DEFAULT_SLOT_MINUTES;
  const resolved = categoryIds.length > 0
    ? await resolveBranchCategoryDurations(prisma, branchId, categoryIds)
    : null;
  // Захиалга болон хүчин чадал эзэлж буй идэвхтэй ажлыг ижил дүрмээр
  // тооцно. Ингэснээр picker дээр сул мэт харагдсан цаг reservation дээр
  // гэнэт мөргөлдөхгүй, linked appointment/order давхар тоологдохгүй.
  const capacityIntervals = open
    ? await resolveTakenCapacityIntervals(prisma, branchId, dayStart, dayEnd, slotMin)
    : [];
  const taken = capacityIntervals.map((interval) => ({
    start: new Date(interval.startMs),
    durationMinutes: Math.max(1, Math.ceil((interval.endMs - interval.startMs) / 60000)),
  }));

  const availability = buildDaySlots({
    dateStr,
    open,
    openTime,
    closeTime,
    slotMinutes: slotMin,
    capacity: branch.slotCapacity ?? DEFAULT_SLOT_CAPACITY,
    taken,
    now: new Date(),
    appointmentMinutes: resolved?.totalMinutes,
  });
  return {
    ...availability,
    scheduleSource: schedule.source,
    scheduleLabel: schedule.label,
    durationMinutes: resolved?.totalMinutes || slotMin,
  };
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
  const vehicleId = s(formData, "vehicleId") || null;

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

  // Membership and duration are rechecked together inside the reservation transaction.
  const requestedCategoryIds = [...new Set(formData.getAll("categoryIds").map(String).filter(Boolean))];
  // Машин сонгосон бол (global Vehicle id) энэ хэрэглэгчийнх мөн эсэхийг
  // шалгана: өөрөө нэмсэн (AccountVehicle) ЭСВЭЛ сервисээс бүртгэгдэж
  // холбогдсон (TenantVehicle → Customer, account/утсаар). Хоёр дахь
  // тохиолдолд AccountVehicle холбоос үүсгэж appointment-д ашиглана.
  let accountVehicleId: string | null = null;
  if (vehicleId) {
    const link = await prisma.accountVehicle.findUnique({
      where: { accountId_vehicleId: { accountId: account.id, vehicleId } },
      select: { id: true },
    });
    if (link) {
      accountVehicleId = link.id;
    } else {
      const owned = await prisma.tenantVehicle.findFirst({
        where: {
          vehicleId,
          OR: [
            { customer: { accountId: account.id } },
            { customer: { phone: { endsWith: account.phone } } },
          ],
        },
        select: { id: true },
      });
      if (!owned) {
        return { ok: false, fieldErrors: { vehicleId: "Машин олдсонгүй." } };
      }
      const created = await prisma.accountVehicle.upsert({
        where: { accountId_vehicleId: { accountId: account.id, vehicleId } },
        create: { accountId: account.id, vehicleId },
        update: {},
        select: { id: true },
      });
      accountVehicleId = created.id;
    }
  }

  let created;
  try {
    created = await reserveAppointment({
      tenantId: branch.tenantId, branchId: branch.id, accountId: account.id,
      accountVehicleId, categoryIds: requestedCategoryIds, requestedAt: requestedAt!, note: note || null,
    });
  } catch (error) {
    if (error instanceof ReservationError) return { ok: false, message: error.message };
    throw error;
  }

  // Цаг захиалгын хураамж — идэвхтэй бол QPay invoice татаж, хэрэглэгчийг
  // шууд төлбөрийн хуудас руу чиглүүлнэ. QPay доголдвол ч захиалга үүсэхийг
  // тасалдуулахгүй (payment мөр FAILED-ээр үлдэж дараа дахин оролдоно).
  let requiresPayment = false;
  try {
    const result = await ensureAppointmentFeeCheckout(created.id);
    requiresPayment = result.required;
  } catch (e) {
    console.warn("[payment] createAppointment:", e);
  }

  // Холбогдох ажилтнуудад шинэ цаг захиалга ирсэн тухай мэдэгдэнэ — гэхдээ
  // хураамж шаардлагатай бол хэрэглэгч төлөх хүртэл хүлээнэ (мэдэгдэл
  // `confirmAppointmentPayment`-аас, төлбөр баталгаажсаны дараа очно).
  if (!requiresPayment) {
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
  }

  revalidatePath("/account");
  if (requiresPayment) {
    redirect(`/account/appointments/${created.id}/pay`);
  }
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

/**
 * Хэрэглэгч өөрийн PENDING/CONFIRMED цагаа өөр хугацаанд шилжүүлнэ — цуцлаад
 * дахин захиалахын оронд. Захиалга (ServiceOrder) аль хэдийн үүссэн бол
 * (ажилтан аль хэдийн ажилд авсан) энд зөвшөөрөхгүй — байгууллагатай шууд
 * холбогдох ёстой. Хугацааны хязгаарлалт (жишээ нь "N цагийн өмнө")
 * одоогоор алга — цуцлах үйлдэлтэй адил (2026-09-08 шийдвэр).
 */
export async function rescheduleAppointmentByAccount(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const account = await requireAccount();
  const id = s(formData, "id");
  const requestedRaw = s(formData, "requestedAt");
  if (!id || !requestedRaw) return { ok: false, message: "Буруу хүсэлт." };

  const requestedAt = new Date(requestedRaw);
  if (!Number.isFinite(requestedAt.getTime())) {
    return { ok: false, fieldErrors: { requestedAt: "Огноо буруу." } };
  }
  return rescheduleAppointmentByAccountCore(account, id, requestedAt);
}

/**
 * `rescheduleAppointmentByAccount`-ийн цөм логик — FormData-аас тусгаарласан,
 * учир нь мобайл апп (`/api/v1/app/appointments/[id]/reschedule`) ч мөн адил
 * үйлдлийг дуудах шаардлагатай (server action шууд дуудагдахгүй, JSON API
 * хэрэгтэй). Аль аль газраас нэг л газрын логикийг ашиглана — audit/staff
 * мэдэгдэл хоёуланд адил ажиллана.
 */
export async function rescheduleAppointmentByAccountCore(
  account: { id: string; name: string | null; phone: string },
  id: string,
  requestedAt: Date,
): Promise<AppointmentActionState> {
  if (requestedAt.getTime() < Date.now()) {
    return { ok: false, fieldErrors: { requestedAt: "Өнгөрсөн цаг сонгох боломжгүй." } };
  }

  const appt = await prisma.appointment.findFirst({
    where: { id, accountId: account.id },
    select: {
      id: true,
      tenantId: true,
      branchId: true,
      status: true,
      requestedAt: true,
      estimatedDurationMinutes: true,
      serviceOrderId: true,
    },
  });
  if (!appt) return { ok: false, message: "Цаг захиалга олдсонгүй." };
  if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") {
    return { ok: false, message: "Энэ цагийг шилжүүлэх боломжгүй." };
  }
  if (appt.serviceOrderId) {
    return {
      ok: false,
      message:
        "Энэ цагт засварын хуудас нээгдсэн тул онлайнаар шилжүүлэх боломжгүй. Байгууллагатай холбогдоно уу.",
    };
  }

  try {
    const { withBookingTransaction } = await import("@/lib/prisma");
    await withBookingTransaction(appt.tenantId, async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { id: appt.branchId, tenantId: appt.tenantId, isActive: true },
        include: {
          schedules: true,
          scheduleExceptions: { where: { date: bookingDayBounds(bookingDateKey(requestedAt)).start } },
          scheduleSeasons: {
            where: {
              isActive: true,
              startsOn: { lte: bookingDayBounds(bookingDateKey(requestedAt)).start },
              endsOn: { gt: bookingDayBounds(bookingDateKey(requestedAt)).start },
            },
            include: { days: true },
          },
        },
      });
      if (!branch) throw new ReservationError(403, "Салбар олдсонгүй.");

      const duration =
        appt.estimatedDurationMinutes ?? branch.slotMinutes ?? DEFAULT_SLOT_MINUTES;
      const schedule = resolveEffectiveSchedule({
        dateStr: bookingDateKey(requestedAt),
        branch,
      });
      const slots = buildDaySlots({
        dateStr: bookingDateKey(requestedAt),
        open: schedule.open,
        openTime: schedule.openTime,
        closeTime: schedule.closeTime,
        slotMinutes: branch.slotMinutes ?? DEFAULT_SLOT_MINUTES,
        capacity: branch.slotCapacity ?? DEFAULT_SLOT_CAPACITY,
        // Слот нээлттэй эсэхийг (цаг, ажиллах өдөр) шалгахад л ашиглана —
        // багтаамжийг доор `isSlotAvailable`-аар (өөрийгөө хасаж) шалгана.
        taken: [],
        now: new Date(),
      });
      if (!slots.slots.some((slot) => slot.iso === requestedAt.toISOString() && slot.available)) {
        throw new ReservationError(400, "Ажиллах цагт багтах сул цаг сонгоно уу.");
      }
      if (!(await isSlotAvailable(tx, appt.branchId, requestedAt, duration, appt.id))) {
        throw new ReservationError(409, "Энэ цаг дүүрсэн байна. Өөр цаг сонгоно уу.");
      }

      await tx.appointment.update({
        where: { id: appt.id },
        data: { requestedAt },
      });
    });
  } catch (error) {
    if (error instanceof ReservationError) return { ok: false, message: error.message };
    throw error;
  }

  // Тусдаа (transaction-гүй) — booking transaction нь өөр (extended биш
  // "base") Prisma client ашигладаг тул `logAudit`-ийн хүлээж буй tx-тэй
  // төрөл таарахгүй. Rollback-той хамт алдвал audit мөр л дутуу үлдэнэ —
  // цуцлах үйлдэл (cancelAppointmentByAccount) ч мөн адил audit хийдэггүй.
  await logAudit({
    tenantId: appt.tenantId,
    branchId: appt.branchId,
    entity: "Appointment",
    entityId: appt.id,
    action: "UPDATE",
    summary: "Хэрэглэгч цагаа шилжүүлэв",
    before: { requestedAt: appt.requestedAt.toISOString() },
    after: { requestedAt: requestedAt.toISOString() },
  });

  try {
    const who = account.name?.trim() || account.phone;
    await notifyStaff({
      type: "appointment_rescheduled_by_account",
      tenantId: appt.tenantId,
      branchId: appt.branchId,
      input: {
        appointmentId: appt.id,
        body: `${who} — цагаа ${formatWhen(requestedAt)} болгож шилжүүллээ.`,
      },
    });
  } catch (e) {
    console.warn("[notify] rescheduleAppointmentByAccount:", e);
  }

  revalidatePath("/account");
  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/appointments/calendar");
  return { ok: true, message: "Цаг шилжлээ." };
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

  const scope = workingBranchScopeId(user);
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
      select: { id: true, accountId: true },
    }),
  ]);
  if (!branch) return { ok: false, fieldErrors: { branchId: "Салбар олдсонгүй." } };
  if (!customer) {
    return { ok: false, fieldErrors: { customerId: "Үйлчлүүлэгч олдсонгүй." } };
  }

  // Staff and customer reservations share category, duration and capacity checks —
  // staff alone may override a capacity-full slot after an explicit confirm
  // (see ReservationConflictError; a phone-in booking is a real physical
  // exception a staff member present at the branch can vouch for).
  const requestedCategoryIds = [...new Set(formData.getAll("categoryIds").map(String).filter(Boolean))];
  const confirmed = s(formData, "confirmed") === "true";
  let created;
  try {
    created = await reserveAppointment({
      tenantId: user.tenantId, branchId, customerId, staffUserId: user.id,
      // Customer нь онлайн Account-той гүүрлэгдсэн бол (өмнө нь тэр утсаар
      // онлайн захиалга хийсэн байвал) энэ утсаар бүртгэсэн цагийг мөн тэр
      // Account-д харагдуулна — эс бөгөөс "Миний захиалгууд"-д алга болно (2026-09-08
      // хэрэглэгчийн тайлан).
      accountId: customer.accountId,
      categoryIds: requestedCategoryIds, requestedAt: requestedAt!, note: note || null,
      confirmed,
    });
  } catch (error) {
    if (error instanceof ReservationConflictError) {
      return { ok: false, message: error.message, fieldErrors: { confirmNeeded: "true" } };
    }
    if (error instanceof ReservationError) return { ok: false, message: error.message };
    throw error;
  }

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
  // Хуваарийн (calendar) хуудаснаас "next"-тэй ирсэн бол тэр рүү буцна.
  redirect(safeNext(s(formData, "next"), "/dashboard/appointments"));
}

/**
 * `requireUser()`-ийг ЗААВАЛ эхлээд (энэ appointment-ийг Prisma-аар
 * татахаас ӨМНӨ) дуудаж tenant context тохируулсан байх ёстой — эс бөгөөс
 * "Tenant context тохируулагдаагүй" алдаа шидэгдэнэ (харах: lib/prisma.ts).
 * Тиймээс энэ функц context тохируулахгүй, зөвхөн аль хэдийн resolve
 * хийсэн `user`-ийг branchId-тэй нь харьцуулж шалгана.
 */
async function assertStaffScope(
  user: Awaited<ReturnType<typeof requireUser>>,
  branchId?: string,
) {
  if (!canEdit(user, "appointments")) {
    throw new Error("Танд цаг захиалга удирдах эрх байхгүй.");
  }
  const scope = workingBranchScopeId(user);
  if (scope && branchId && branchId !== scope) {
    throw new Error("Зөвхөн өөрийн салбарын цаг захиалгыг удирдана.");
  }
  await assertActiveSubscription(user.tenantId);
}

/**
 * Calendar recovery for an appointment whose service-order link cannot be
 * resolved in the current tenant/branch scope. This deliberately does not
 * create an order: repairing a historical relationship must never create a
 * duplicate repair record by accident.
 */
export async function repairAppointmentOrderLinkAction(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const id = s(formData, "appointmentId");
  const mode = s(formData, "mode");
  const orderId = s(formData, "orderId");
  if (!id || (mode !== "detach" && mode !== "relink")) {
    return { ok: false, message: "Буруу хүсэлт." };
  }

  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      branchId: true,
      status: true,
      customerId: true,
      vehicleId: true,
      serviceOrderId: true,
    },
  });
  if (!appointment) return { ok: false, message: "Цаг захиалга олдсонгүй." };

  try {
    await assertStaffScope(user, appointment.branchId);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  if (user.tenantId !== appointment.tenantId || !canEdit(user, "orders")) {
    return { ok: false, message: "Танд энэ холбоосыг засах эрх байхгүй." };
  }
  if (appointment.status !== "PENDING" && appointment.status !== "CONFIRMED") {
    return { ok: false, message: "Энэ цагийн захиалга одоо идэвхгүй байна." };
  }
  if (!appointment.serviceOrderId) {
    return { ok: false, message: "Энэ цагт засварын хуудас холбогдоогүй байна." };
  }

  const linkedOrder = await prisma.serviceOrder.findFirst({
    where: {
      id: appointment.serviceOrderId,
      tenantId: appointment.tenantId,
    },
    select: { id: true, branchId: true },
  });
  if (linkedOrder && linkedOrder.branchId === appointment.branchId) {
    return {
      ok: false,
      message: "Холболт зөв байна. Календарийг дахин ачаална уу.",
    };
  }

  if (mode === "relink") {
    if (!orderId) return { ok: false, message: "Засварын хуудсаа сонгоно уу." };
    if (!appointment.customerId || !appointment.vehicleId) {
      return {
        ok: false,
        message: "Үйлчлүүлэгч болон машин тодорхойгүй тул автоматаар холбох боломжгүй.",
      };
    }

    const replacement = await prisma.serviceOrder.findFirst({
      where: {
        id: orderId,
        tenantId: appointment.tenantId,
        branchId: appointment.branchId,
        customerId: appointment.customerId,
        vehicleId: appointment.vehicleId,
        status: { in: ["SCHEDULED", "IN_PROGRESS", "WAITING_PARTS"] },
        appointment: { is: null },
      },
      select: { id: true, number: true },
    });
    if (!replacement) {
      return {
        ok: false,
        message: "Сонгосон засварын хуудас энэ үйлчлүүлэгч, машин, салбарт тохирохгүй эсвэл аль хэдийн холбогдсон байна.",
      };
    }

    try {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.appointment.updateMany({
          where: {
            id: appointment.id,
            tenantId: appointment.tenantId,
            serviceOrderId: appointment.serviceOrderId,
          },
          data: { serviceOrderId: replacement.id },
        });
        if (updated.count !== 1) throw new Error("Цагийн захиалга өөрчлөгдсөн байна.");
        await logAudit(
          {
            tenantId: appointment.tenantId,
            userId: user.id,
            branchId: appointment.branchId,
            entity: "Appointment",
            entityId: appointment.id,
            action: "UPDATE",
            summary: "Цаг захиалгын засварын хуудасны холбоосыг сэргээв",
            before: { serviceOrderId: appointment.serviceOrderId },
            after: { serviceOrderId: replacement.id, orderNumber: replacement.number },
          },
          tx,
        );
      });
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Холбоос сэргээхэд алдаа гарлаа.",
      };
    }

    revalidatePath("/dashboard/appointments");
    revalidatePath("/dashboard/appointments/calendar");
    revalidatePath(`/dashboard/orders/${replacement.id}`);
    return { ok: true, message: "Цаг захиалгын холбоосыг сэргээлээ." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.updateMany({
        where: {
          id: appointment.id,
          tenantId: appointment.tenantId,
          serviceOrderId: appointment.serviceOrderId,
        },
        data: { serviceOrderId: null },
      });
      if (updated.count !== 1) throw new Error("Цагийн захиалга өөрчлөгдсөн байна.");
      await logAudit(
        {
          tenantId: appointment.tenantId,
          userId: user.id,
          branchId: appointment.branchId,
          entity: "Appointment",
          entityId: appointment.id,
          action: "UPDATE",
          summary: "Цаг захиалгын эвдэрсэн засварын хуудасны холбоосыг салгав",
          before: { serviceOrderId: appointment.serviceOrderId },
          after: { serviceOrderId: null },
        },
        tx,
      );
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Холбоос салгахад алдаа гарлаа.",
    };
  }

  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/appointments/calendar");
  return { ok: true, message: "Эвдэрсэн холбоосыг салгалаа." };
}

/**
 * Ажилтан цаг баталгаажуулна:
 *   - утсаар тенантын Customer-ыг resolve/create (гүүр)
 *   - appointment-ийг CONFIRMED болгож, тухайн Customer-той холбоно
 * Захиалга (ServiceOrder) нь дараа нь order урсгалаар үүснэ.
 */
export async function confirmAppointment(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const id = s(formData, "id");
  if (!id) return { ok: false, message: "Буруу хүсэлт." };

  // Tenant context-ийг ЗААВАЛ эхлээд (доорх Prisma дуудлагаас өмнө)
  // тохируулна — эс бөгөөс "Tenant context тохируулагдаагүй" алдаа шидэгдэнэ.
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const appt = await prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      branchId: true,
      status: true,
      account: { select: { id: true, phone: true, name: true, email: true } },
      accountVehicle: { select: { vehicleId: true } },
      feeAmount: true,
      feeQpayInvoiceId: true,
      feeUnderpaidAmount: true,
      payment: { select: { status: true } },
    },
  });
  if (!appt) return { ok: false, message: "Цаг захиалга олдсонгүй." };

  try {
    await assertStaffScope(user, appt.branchId);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  if (user.tenantId !== appt.tenantId) {
    return { ok: false, message: "Танд энэ цагийг удирдах эрх байхгүй." };
  }
  if (appt.status !== "PENDING") {
    return { ok: false, message: "Энэ цаг аль хэдийн хариу авсан байна." };
  }
  const bookingPaymentStatus = appointmentBookingPaymentStatus(appt);
  if (bookingPaymentStatus !== "NOT_REQUIRED" && bookingPaymentStatus !== "PAID") {
    return {
      ok: false,
      message:
        "Захиалгын хураамж бүрэн төлөгдөөгүй тул цагийг баталгаажуулах боломжгүй.",
    };
  }
  // Онлайн захиалгад Account заавал байна (phone-in нь CONFIRMED-ээр үүсдэг тул
  // энд хүрэхгүй). Account байхгүй бол resolve хийх боломжгүй.
  if (!appt.account) {
    return { ok: false, message: "Энэ цагт хэрэглэгчийн мэдээлэл алга." };
  }
  const account = appt.account;
  const accountVehicle = appt.accountVehicle;

  try {
    await prisma.$transaction(async (tx) => {
      const customerId = await resolveCustomerForAccount(
        tx,
        appt.tenantId,
        account,
      );
      // Хэрэглэгч машинаа сонгосон бол тенантад TenantVehicle link үүсгэнэ.
      let vehicleId: string | null = null;
      if (accountVehicle) {
        vehicleId = accountVehicle.vehicleId;
        await ensureTenantVehicle(tx, {
          tenantId: appt.tenantId,
          vehicleId,
          customerId,
        });
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
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Баталгаажуулахад алдаа гарлаа.",
    };
  }

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
  revalidatePath("/account");
  return { ok: true, message: "Цаг баталгаажлаа." };
}

/** Ажилтан цаг татгалзах. */
export async function rejectAppointment(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const id = s(formData, "id");
  if (!id) return { ok: false, message: "Буруу хүсэлт." };

  // Tenant context-ийг ЗААВАЛ эхлээд (доорх Prisma дуудлагаас өмнө)
  // тохируулна — эс бөгөөс "Tenant context тохируулагдаагүй" алдаа шидэгдэнэ.
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

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
  if (!appt) return { ok: false, message: "Цаг захиалга олдсонгүй." };

  try {
    await assertStaffScope(user, appt.branchId);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  if (user.tenantId !== appt.tenantId) {
    return { ok: false, message: "Танд энэ цагийг удирдах эрх байхгүй." };
  }
  if (appt.status !== "PENDING") {
    return { ok: false, message: "Энэ цаг аль хэдийн хариу авсан байна." };
  }

  try {
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
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Татгалзахад алдаа гарлаа.",
    };
  }

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
  return { ok: true, message: "Цаг татгалзлаа." };
}

/** Ажилтан "ирээгүй" гэж тэмдэглэх (зөвхөн CONFIRMED-аас). */
export async function markAppointmentNoShow(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const id = s(formData, "id");
  if (!id) return { ok: false, message: "Буруу хүсэлт." };

  // Tenant context-ийг ЗААВАЛ эхлээд (доорх Prisma дуудлагаас өмнө)
  // тохируулна — эс бөгөөс "Tenant context тохируулагдаагүй" алдаа шидэгдэнэ.
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const appt = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, tenantId: true, branchId: true, status: true },
  });
  if (!appt) return { ok: false, message: "Цаг захиалга олдсонгүй." };

  try {
    await assertStaffScope(user, appt.branchId);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  if (user.tenantId !== appt.tenantId) {
    return { ok: false, message: "Танд энэ цагийг удирдах эрх байхгүй." };
  }
  if (appt.status !== "CONFIRMED") {
    return { ok: false, message: "Энэ цагийг тэмдэглэх боломжгүй." };
  }

  try {
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
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Тэмдэглэхэд алдаа гарлаа.",
    };
  }

  revalidatePath("/dashboard/appointments");
  return { ok: true, message: "Ирээгүй гэж тэмдэглэлээ." };
}

/**
 * Тухайн салбарт өгөгдсөн хугацааны хүрээ (`start`-`end`) өөр цаг захиалга
 * эсвэл захиалгатай (order) давхцаж байгаа эсэхийг шалгана — `orders.ts`-ийн
 * ижил нэртэй функцтэй адил зарчим, гэхдээ энд ӨӨРИЙН ГЭСЭН Appointment-ийг
 * (шилжүүлж буй) хасна (order үүсэхэд order.ts нь `excludeOrderId`-аар
 * ServiceOrder-оо хасдаг — энд харин Appointment.id-аар өөрийгөө хасна).
 * Зөвхөн danger-биш (non-blocking) сануулга — staff "Хадгалах"-аа дахин
 * дарж давхцлыг зөвшөөрч болно.
 */
async function findAppointmentRescheduleConflict(
  tenantId: string,
  branchId: string,
  excludeAppointmentId: string,
  start: Date,
  end: Date,
): Promise<string | null> {
  const [appts, orders] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        tenantId,
        branchId,
        id: { not: excludeAppointmentId },
        status: { in: ["PENDING", "CONFIRMED"] },
        requestedAt: { lt: end },
      },
      select: {
        requestedAt: true,
        estimatedDurationMinutes: true,
        account: { select: { name: true, phone: true } },
        customer: { select: { fullName: true, phone: true } },
      },
    }),
    prisma.serviceOrder.findMany({
      where: {
        tenantId,
        branchId,
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
    const s0 = a.requestedAt.getTime();
    const e0 = a.estimatedDurationMinutes
      ? s0 + a.estimatedDurationMinutes * 60000
      : Number.POSITIVE_INFINITY;
    if (s0 < endMs && e0 > startMs) {
      return `цаг захиалга (${customerLabel({ fullName: a.account?.name ?? a.customer?.fullName, phone: a.account?.phone ?? a.customer?.phone })})`;
    }
  }

  for (const o of orders) {
    if (o.status !== "SCHEDULED" && o.occupiesCapacity === false) continue;
    const scheduled = o.status === "SCHEDULED" && o.occupiesCapacity !== true;
    const s0 = (scheduled ? o.scheduledAt : o.startedAt)?.getTime();
    if (s0 == null) continue;
    const e0 =
      o.expectedFinishAt?.getTime() ??
      (scheduled && o.estimatedDurationMinutes
        ? s0 + o.estimatedDurationMinutes * 60000
        : Number.POSITIVE_INFINITY);
    if (s0 < endMs && e0 > startMs) {
      return `захиалга #${o.number} (${customerLabel(o.customer)})`;
    }
  }

  return null;
}

/**
 * Ажилтан CONFIRMED цагийг өөр хугацаанд шилжүүлнэ — "ирээгүй" гэж
 * тэмдэглэхийн оронд, алдсан цагийг сэргээх боломж (2026-09-08: "ирц
 * алдсан" цагийг NO_SHOW болгохоос гадна дахин товлож болох байх ёстой
 * гэсэн шийдвэрээр нэмэгдсэн). PENDING цагийг энд шилжүүлдэггүй — тэр
 * баталгаажаагүй хүсэлт тул `confirmAppointment`/`rejectAppointment`-ээр
 * шийднэ, эсвэл хугацаа хэтэрвэл cron (`appointment_expired`) цуцална.
 */
export async function rescheduleAppointmentAction(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const id = s(formData, "id");
  const requestedRaw = s(formData, "requestedAt");
  const confirmed = s(formData, "confirmed") === "true";
  if (!id || !requestedRaw) return { ok: false, message: "Буруу хүсэлт." };

  const requestedAt = new Date(requestedRaw);
  if (!Number.isFinite(requestedAt.getTime())) {
    return { ok: false, fieldErrors: { requestedAt: "Огноо буруу." } };
  }
  if (requestedAt.getTime() < Date.now()) {
    return { ok: false, fieldErrors: { requestedAt: "Өнгөрсөн цаг сонгох боломжгүй." } };
  }

  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const appt = await prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      branchId: true,
      status: true,
      requestedAt: true,
      accountId: true,
      estimatedDurationMinutes: true,
    },
  });
  if (!appt) return { ok: false, message: "Цаг захиалга олдсонгүй." };

  try {
    await assertStaffScope(user, appt.branchId);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  if (user.tenantId !== appt.tenantId) {
    return { ok: false, message: "Танд энэ цагийг удирдах эрх байхгүй." };
  }
  if (appt.status !== "CONFIRMED") {
    return { ok: false, message: "Зөвхөн баталгаажсан цагийг энд шилжүүлнэ." };
  }

  const requestedDateStr = bookingDateKey(requestedAt);
  const requestedDay = bookingDayBounds(requestedDateStr);

  const branch = await prisma.branch.findFirst({
    where: { id: appt.branchId, tenantId: appt.tenantId, isActive: true },
    select: {
      slotMinutes: true,
      ...branchScheduleForDateSelect(requestedDateStr),
    },
  });
  if (!branch) return { ok: false, message: "Салбар олдсонгүй." };
  const durationMinutes = appt.estimatedDurationMinutes ?? branch.slotMinutes ?? DEFAULT_SLOT_MINUTES;
  const requestedEnd = new Date(requestedAt.getTime() + durationMinutes * 60000);
  const endExclusive = new Date(requestedEnd.getTime() - 1);
  if (bookingDateKey(endExclusive) !== requestedDateStr) {
    return {
      ok: false,
      message: "Цаг захиалга нэг өдрийн ажиллах цагийн дотор багтах ёстой.",
    };
  }
  const effective = resolveEffectiveSchedule({ dateStr: requestedDateStr, branch });
  const openMin = effective.openTime ? timeToMinutes(effective.openTime) : null;
  const closeMin = effective.closeTime ? timeToMinutes(effective.closeTime) : null;
  const startMin = (requestedAt.getTime() - requestedDay.start.getTime()) / 60000;
  if (
    !effective.open ||
    openMin == null ||
    closeMin == null ||
    closeMin <= openMin ||
    startMin < openMin ||
    startMin + durationMinutes > closeMin
  ) {
    return { ok: false, message: "Ажиллах цагт багтах сул цаг сонгоно уу." };
  }

  if (!confirmed) {
    const conflictEnd = new Date(requestedAt.getTime() + durationMinutes * 60000);
    const conflict = await findAppointmentRescheduleConflict(
      user.tenantId,
      appt.branchId,
      appt.id,
      requestedAt,
      conflictEnd,
    );
    if (conflict) {
      return {
        ok: false,
        message: `Шинэ цаг ${conflict}-тай давхцаж байна. Үргэлжлүүлэхийн тулд дахин "Хадгалах" дарна уу.`,
        fieldErrors: { confirmNeeded: "true" },
      };
    }
  }

  const previous = appt.requestedAt;

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appt.id },
      data: { requestedAt },
    });
    await logAudit(
      {
        tenantId: appt.tenantId,
        userId: user.id,
        branchId: appt.branchId,
        entity: "Appointment",
        entityId: appt.id,
        action: "UPDATE",
        summary: "Цагийг шилжүүлэв",
        before: { requestedAt: previous.toISOString() },
        after: { requestedAt: requestedAt.toISOString() },
      },
      tx,
    );
  });

  if (appt.accountId) {
    try {
      await createNotification({
        type: "appointment_rescheduled",
        recipient: { accountId: appt.accountId },
        input: { appointmentId: appt.id },
      });
    } catch (e) {
      console.warn("[notify] rescheduleAppointmentAction:", e);
    }
  }

  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/appointments/calendar");
  revalidatePath("/account");
  return { ok: true, message: "Цаг шилжлээ." };
}

// Үйлчлүүлэгч биечлэн ирснийг тэмдэглэнэ (arrivedAt) — ажил эхэлсэн гэсэн үг
// БИШ, зөвхөн ирц. markAppointmentNoShow-той бараг ижил бүтэцтэй.
export async function markAppointmentArrived(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const id = s(formData, "id");
  if (!id) return { ok: false, message: "Буруу хүсэлт." };

  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const appt = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, tenantId: true, branchId: true, status: true, arrivedAt: true },
  });
  if (!appt) return { ok: false, message: "Цаг захиалга олдсонгүй." };

  try {
    await assertStaffScope(user, appt.branchId);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }
  if (user.tenantId !== appt.tenantId) {
    return { ok: false, message: "Танд энэ цагийг удирдах эрх байхгүй." };
  }
  if (appt.status !== "CONFIRMED") {
    return { ok: false, message: "Энэ цагийг тэмдэглэх боломжгүй." };
  }
  if (appt.arrivedAt) {
    return { ok: false, message: "Аль хэдийн ирсэн гэж тэмдэглэсэн байна." };
  }

  try {
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { arrivedAt: new Date() },
    });
    await logAudit({
      tenantId: appt.tenantId,
      userId: user.id,
      branchId: appt.branchId,
      entity: "Appointment",
      entityId: appt.id,
      action: "STATUS_CHANGE",
      summary: "Үйлчлүүлэгч ирснийг тэмдэглэв",
      after: { arrivedAt: new Date().toISOString() },
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Тэмдэглэхэд алдаа гарлаа.",
    };
  }

  revalidatePath("/dashboard/appointments");
  return { ok: true, message: "Ирсэн гэж тэмдэглэлээ." };
}
