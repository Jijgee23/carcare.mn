import type { Prisma } from "@/app/generated/prisma/client";
import { buildDaySlots, DEFAULT_SLOT_MINUTES } from "@/lib/appointment-slots";
import { bookingDateKey, bookingDayBounds } from "@/lib/booking-time";
import { resolveEffectiveSchedule } from "@/lib/branch-effective-schedule";
import { isSlotAvailable, resolveBranchCategoryDurations } from "@/lib/category-duration";

export class ReservationError extends Error {
  constructor(public status: 400 | 403 | 409, message: string) { super(message); }
}

/**
 * Specifically the capacity-full case (as opposed to out-of-hours/past,
 * which stays a hard block for everyone). Staff booking a phone-in
 * appointment may deliberately override this one — a customer knows their
 * relationship with the shop lets them double up a bay, or the branch's
 * capacity number is just conservative — the same "soft warning, not a hard
 * rule" latitude order scheduling already has (see D-hours decisions in
 * COWORK.md). Customer online self-booking never gets this override
 * (`staffUserId` absent), since nothing there can vouch for a real physical
 * exception the way a staff member present at the branch can.
 */
export class ReservationConflictError extends ReservationError {
  constructor(message: string) { super(409, message); }
}

export type ReservationInput = {
  tenantId: string;
  branchId: string;
  requestedAt: Date;
  categoryIds: string[];
  accountId?: string | null;
  accountVehicleId?: string | null;
  customerId?: string | null;
  note?: string | null;
  staffUserId?: string;
  // Only honored when staffUserId is set — see ReservationConflictError.
  confirmed?: boolean;
};

/** Caller authenticates first. All DB operations here use the SAME transaction. */
export async function reserveAppointmentInTransaction(
  tx: Prisma.TransactionClient,
  input: ReservationInput,
  now = new Date(),
) {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Branch" WHERE id = ${input.branchId} AND "tenantId" = ${input.tenantId} FOR UPDATE
  `;
  if (!locked.length) throw new ReservationError(403, "Салбар олдсонгүй.");
  if (!Number.isFinite(input.requestedAt.getTime())) throw new ReservationError(400, "Огноо буруу.");
  const dateStr = bookingDateKey(input.requestedAt);
  const day = bookingDayBounds(dateStr).start;
  const branch = await tx.branch.findFirst({
    where: { id: input.branchId, tenantId: input.tenantId, isActive: true },
    include: {
      schedules: true,
      scheduleExceptions: { where: { date: day } },
      scheduleSeasons: {
        where: { isActive: true, startsOn: { lte: day }, endsOn: { gt: day } },
        include: { days: true },
      },
      tenant: { select: { suspended: true, acceptsOnlineBooking: true } },
    },
  });
  if (!branch || branch.tenant.suspended || (!input.staffUserId && !branch.tenant.acceptsOnlineBooking)) {
    throw new ReservationError(403, "Энэ салбар цаг захиалга хүлээн авахгүй.");
  }
  if (input.accountVehicleId) {
    if (!input.accountId || !await tx.accountVehicle.findFirst({
      where: { id: input.accountVehicleId, accountId: input.accountId }, select: { id: true },
    })) throw new ReservationError(400, "Машин олдсонгүй.");
  }
  if (input.customerId && !await tx.customer.findFirst({
    where: { id: input.customerId, tenantId: input.tenantId }, select: { id: true },
  })) throw new ReservationError(400, "Үйлчлүүлэгч олдсонгүй.");

  const categoryIds = [...new Set(input.categoryIds)];
  if (categoryIds.length) {
    const categories = await tx.category.findMany({ where: {
      id: { in: categoryIds }, tenantId: input.tenantId, isActive: true,
      OR: [{ branches: { some: { id: branch.id } } }, { branches: { none: {} } }],
    }, select: { id: true } });
    if (categories.length !== categoryIds.length) throw new ReservationError(400, "Үйлчилгээний ангиллаа дахин сонгоно уу.");
  }
  const resolved = await resolveBranchCategoryDurations(tx, branch.id, categoryIds);
  const duration = resolved.totalMinutes || branch.slotMinutes || DEFAULT_SLOT_MINUTES;
  const schedule = resolveEffectiveSchedule({ dateStr, branch });
  const slots = buildDaySlots({
    dateStr,
    open: schedule.open,
    openTime: schedule.openTime,
    closeTime: schedule.closeTime,
    slotMinutes: branch.slotMinutes ?? DEFAULT_SLOT_MINUTES,
    capacity: branch.slotCapacity ?? 1, appointmentMinutes: duration,
    taken: [], now,
  });
  if (!slots.slots.some((slot) => slot.iso === input.requestedAt.toISOString() && slot.available)) {
    throw new ReservationError(400, "Ажиллах цагт багтах сул цаг сонгоно уу.");
  }
  if (!await isSlotAvailable(tx, branch.id, input.requestedAt, duration)) {
    const overrideAllowed = Boolean(input.staffUserId) && input.confirmed === true;
    if (!overrideAllowed) {
      throw new ReservationConflictError(
        input.staffUserId
          ? "Энэ цаг дүүрсэн байна. Үргэлжлүүлэхийн тулд дахин баталгаажуулна уу."
          : "Энэ цаг дүүрсэн байна. Өөр цаг сонгоно уу.",
      );
    }
  }
  return tx.appointment.create({
    data: {
      tenantId: input.tenantId, branchId: branch.id, requestedAt: input.requestedAt,
      estimatedDurationMinutes: duration, accountId: input.accountId ?? null,
      accountVehicleId: input.accountVehicleId ?? null, customerId: input.customerId ?? null,
      note: input.note ?? null, categoryId: categoryIds[0] ?? null,
      categories: categoryIds.length ? { create: categoryIds.map((categoryId) => ({ categoryId })) } : undefined,
      status: input.staffUserId ? "CONFIRMED" : "PENDING",
      respondedAt: input.staffUserId ? now : null, respondedById: input.staffUserId ?? null,
    }, select: { id: true, status: true, requestedAt: true },
  });
}

export async function reserveAppointment(input: ReservationInput) {
  const { withBookingTransaction } = await import("@/lib/prisma");
  return withBookingTransaction(input.tenantId, (tx) => reserveAppointmentInTransaction(tx, input));
}
