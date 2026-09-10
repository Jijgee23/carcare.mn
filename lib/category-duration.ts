import { bookingDateKey, bookingDayBounds } from "@/lib/booking-time";
import { peakOccupancy } from "@/lib/schedule-capacity";
import { DEFAULT_SLOT_CAPACITY, DEFAULT_SLOT_MINUTES } from "@/lib/appointment-slots";
import { resolveOrderEffectiveInterval } from "@/lib/schedule-order-interval";
import { isPendingAppointmentPaymentExpired } from "@/lib/appointment-payment-status";
// Concrete read shapes accept both the RLS-extended client and a real transaction
// without casting away Prisma's generic extension types.
type PrismaTransactionClient = {
  category: { findMany(args: {
    where: { id: { in: string[] } }; select: { id: true; durationMinutes: true };
  }): Promise<{ id: string; durationMinutes: number | null }[]> };
  branchCategoryDuration: { findMany(args: {
    where: { branchId: string; categoryId: { in: string[] } };
    select: { categoryId: true; durationMinutes: true };
  }): Promise<{ categoryId: string; durationMinutes: number }[]> };
  branch: { findUnique(args: {
    where: { id: string }; select: { slotMinutes: true; slotCapacity: true };
  }): Promise<{ slotMinutes: number | null; slotCapacity: number | null } | null> };
  appointment: { findMany(args: {
    where: { branchId: string; status: { in: ("PENDING" | "CONFIRMED")[] }; requestedAt: { gte: Date; lt: Date } };
    select: {
      requestedAt: true; estimatedDurationMinutes: true; categoryId: true; serviceOrderId: true;
      categories: { select: { categoryId: true } };
      status: true; createdAt: true; feeAmount: true; feeUnderpaidAmount: true;
      payment: { select: { status: true } };
    };
  }): Promise<TakenAppointmentCandidateRow[]> };
  serviceOrder?: { findMany(args: {
    where: {
      branchId: string;
      status: { in: ("SCHEDULED" | "IN_PROGRESS" | "WAITING_PARTS")[] };
      OR: Array<{ scheduledAt: { lt: Date } } | { scheduledAt: null }>;
    };
    select: {
      status: true;
      scheduledAt: true;
      startedAt: true;
      estimatedDurationMinutes: true;
      expectedFinishAt: true;
      occupiesCapacity: true;
      id: true;
    };
  }): Promise<TakenOrderRow[]> };
};

// Ангилалд хугацаа тохируулаагүй үеийн эцсийн fallback (минут). Slot-ийн
// анхдагч урттай санаатай нийцүүлэв — booking v2-ийн шатлал:
//   BranchCategoryDuration.durationMinutes  (салбар-тусгай override)
//     ?? Category.durationMinutes            (tenant-ийн default)
//     ?? DEFAULT_CATEGORY_DURATION_MINUTES   (платформын fallback)
export const DEFAULT_CATEGORY_DURATION_MINUTES = DEFAULT_SLOT_MINUTES;

// Онлайн захиалгын нэг ангиллын хугацааны хил (минут). Дээд хязгаар нь нэг
// ажлын өдрийн бодит хамгийн урт (12 цаг) — үүнээс урт ажил slot үүсгэдэггүй
// (олон өдөрт үргэлжлэх захиалгыг онлайн флоу дэмждэггүй; ажилтан гараар товлоно).
export const MIN_CATEGORY_DURATION_MINUTES = 5;
export const MAX_CATEGORY_DURATION_MINUTES = 12 * 60; // 720

/** Минутыг цаг+минут болгон задлана (UI-ийн input-д). */
export function splitMinutes(total: number): { hours: number; minutes: number } {
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** Минутыг "X ц Y мин" хэлбэрээр (0 бол алгасна). */
export function formatDuration(total: number): string {
  const { hours, minutes } = splitMinutes(total);
  if (hours && minutes) return `${hours} ц ${minutes} мин`;
  if (hours) return `${hours} ц`;
  return `${minutes} мин`;
}

export type DurationParse =
  | { ok: true; minutes: number | null }
  | { ok: false; error: string };

/**
 * Цаг+минут input-аас нийт минутыг гаргана — pure. Хоёул хоосон бол `null`
 * (тохируулаагүй / цэвэрлэх). Буруу/хязгаараас гадуур бол алдаа буцаана.
 */
export function parseDurationInput(
  hoursRaw: string,
  minutesRaw: string,
): DurationParse {
  const h = hoursRaw.trim();
  const m = minutesRaw.trim();
  if (!h && !m) return { ok: true, minutes: null };

  const hn = h ? Number(h) : 0;
  const mn = m ? Number(m) : 0;
  if (
    !Number.isInteger(hn) ||
    !Number.isInteger(mn) ||
    hn < 0 ||
    mn < 0 ||
    mn > 59
  ) {
    return { ok: false, error: "Цаг ба минутыг зөв оруулна уу (минут 0–59)." };
  }

  const total = hn * 60 + mn;
  if (
    total < MIN_CATEGORY_DURATION_MINUTES ||
    total > MAX_CATEGORY_DURATION_MINUTES
  ) {
    return {
      ok: false,
      error: `Хугацаа ${MIN_CATEGORY_DURATION_MINUTES} мин – ${MAX_CATEGORY_DURATION_MINUTES / 60} цагийн хооронд байна.`,
    };
  }
  return { ok: true, minutes: total };
}

/**
 * Нэг ангиллын effective хугацааг шатлан сонгоно — pure. `branchOverride` ба
 * `categoryDefault` аль аль нь null байж болно (тохируулаагүй).
 */
export function resolveCategoryDurationMinutes(opts: {
  branchOverride: number | null | undefined;
  categoryDefault: number | null | undefined;
}): number {
  return (
    opts.branchOverride ??
    opts.categoryDefault ??
    DEFAULT_CATEGORY_DURATION_MINUTES
  );
}

export type ResolvedCategoryDuration = {
  categoryId: string;
  minutes: number;
  source: "branch" | "tenant" | "default";
};

/**
 * Тухайн салбар дээр өгөгдсөн ангилалуудын effective хугацааг DB-ээс уншиж
 * шийднэ. Одоо байгаа `Branch↔Category` гишүүнчлэлд ХҮРэлгүйгээр зөвхөн
 * `Category.durationMinutes` + `BranchCategoryDuration` override-ыг уншина.
 *
 * Буцаах: ангилал тус бүрийн шийдэгдсэн хугацаа (эх сурвалжтай) + нийлбэр.
 * Санал болгосон ангилал бүрийн категори олдоно гэж үзнэ (endpoint талд
 * tenant/branch-д харьяалагдахыг тусдаа шалгах ёстой).
 */
export async function resolveBranchCategoryDurations(
  client: PrismaTransactionClient,
  branchId: string,
  categoryIds: string[],
): Promise<{ perCategory: ResolvedCategoryDuration[]; totalMinutes: number }> {
  const uniqueIds = [...new Set(categoryIds)];
  if (uniqueIds.length === 0) return { perCategory: [], totalMinutes: 0 };

  const [categories, overrides] = await Promise.all([
    client.category.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, durationMinutes: true },
    }),
    client.branchCategoryDuration.findMany({
      where: { branchId, categoryId: { in: uniqueIds } },
      select: { categoryId: true, durationMinutes: true },
    }),
  ]);

  const defaultById = new Map(categories.map((c) => [c.id, c.durationMinutes]));
  const overrideById = new Map(
    overrides.map((o) => [o.categoryId, o.durationMinutes]),
  );

  const perCategory: ResolvedCategoryDuration[] = uniqueIds.map((id) => {
    const branchOverride = overrideById.get(id) ?? null;
    const categoryDefault = defaultById.get(id) ?? null;
    const minutes = resolveCategoryDurationMinutes({
      branchOverride,
      categoryDefault,
    });
    const source =
      branchOverride != null
        ? "branch"
        : categoryDefault != null
          ? "tenant"
          : "default";
    return { categoryId: id, minutes, source };
  });

  const totalMinutes = perCategory.reduce((sum, c) => sum + c.minutes, 0);
  return { perCategory, totalMinutes };
}

/** Аль хэдийн авсан нэг захиалгын минимум мэдээлэл — хугацааг шийдэхэд хэрэгтэй. */
export type TakenAppointmentRow = {
  estimatedDurationMinutes?: number | null;
  requestedAt: Date;
  serviceOrderId?: string | null;
  categoryId: string | null;
  categories: { categoryId: string }[];
};

/** TakenAppointmentRow plus the fields needed to detect an expired unpaid hold. */
type TakenAppointmentCandidateRow = TakenAppointmentRow & {
  status: string;
  createdAt: Date;
  feeAmount: unknown;
  feeUnderpaidAmount: unknown;
  payment: { status: string } | null;
};

type TakenOrderRow = {
  id: string;
  status: string;
  scheduledAt: Date | null;
  startedAt: Date | null;
  estimatedDurationMinutes: number | null;
  expectedFinishAt: Date | null;
  occupiesCapacity: boolean | null;
};

/**
 * Аль хэдийн авсан (PENDING/CONFIRMED) захиалгуудын ЖИНХЭНЭ эзэлж буй
 * хугацааны интервал (эхлэх цаг + өөрийнх нь нийт үргэлжлэх хугацаа) —
 * `resolveBranchCategoryDurations`-ыг нэг л удаа (бүх захиалгын бүх
 * ангиллын id-г нэгтгэж) дуудна. Ангилалгүй захиалга (хуучин өгөгдөл эсвэл
 * ямар ч ангилал сонгоогүй) `fallbackMinutes`-ийг (ихэвчлэн салбарын slot
 * урт) авна.
 */
export async function resolveTakenAppointmentIntervals(
  client: PrismaTransactionClient,
  branchId: string,
  appointments: TakenAppointmentRow[],
  fallbackMinutes: number,
): Promise<{ start: Date; durationMinutes: number }[]> {
  const categoryIdsOf = (a: TakenAppointmentRow) =>
    a.categories.length
      ? a.categories.map((c) => c.categoryId)
      : a.categoryId
        ? [a.categoryId]
        : [];
  const allCategoryIds = [
    ...new Set(appointments.flatMap(categoryIdsOf)),
  ];
  const { perCategory } = allCategoryIds.length
    ? await resolveBranchCategoryDurations(client, branchId, allCategoryIds)
    : { perCategory: [] };
  const minutesById = new Map(perCategory.map((c) => [c.categoryId, c.minutes]));

  return appointments.map((a) => {
    const ids = categoryIdsOf(a);
    const total = ids.reduce((sum, id) => sum + (minutesById.get(id) ?? 0), 0);
    return {
      start: a.requestedAt,
      durationMinutes: a.estimatedDurationMinutes != null &&
        Number.isInteger(a.estimatedDurationMinutes) && a.estimatedDurationMinutes > 0
        ? a.estimatedDurationMinutes
        : total > 0 ? total : fallbackMinutes,
    };
  });
}

/**
 * Resolve every capacity-consuming interval in one business-day window.
 * Appointments linked to an active order are counted through the order only,
 * preventing the same vehicle/job from consuming capacity twice.
 */
export async function resolveTakenCapacityIntervals(
  client: PrismaTransactionClient,
  branchId: string,
  dayStart: Date,
  dayEnd: Date,
  fallbackMinutes: number,
  excludeAppointmentId?: string,
): Promise<{ startMs: number; endMs: number }[]> {
  const [candidates, orderCandidates] = await Promise.all([
    client.appointment.findMany({
      where: {
        branchId,
        status: { in: ["PENDING", "CONFIRMED"] },
        requestedAt: { gte: dayStart, lt: dayEnd },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: {
        requestedAt: true,
        estimatedDurationMinutes: true,
        categoryId: true,
        serviceOrderId: true,
        categories: { select: { categoryId: true } },
        status: true,
        createdAt: true,
        feeAmount: true,
        feeUnderpaidAmount: true,
        payment: { select: { status: true } },
      },
    }),
    client.serviceOrder
      ? client.serviceOrder.findMany({
          where: {
            branchId,
            status: { in: ["SCHEDULED", "IN_PROGRESS", "WAITING_PARTS"] },
            OR: [{ scheduledAt: { lt: dayEnd } }, { scheduledAt: null }],
          },
          select: {
            id: true,
            status: true,
            scheduledAt: true,
            startedAt: true,
            estimatedDurationMinutes: true,
            expectedFinishAt: true,
            occupiesCapacity: true,
          },
        })
      : Promise.resolve([] as TakenOrderRow[]),
  ]);

  const orderIds = new Set(orderCandidates.map((o) => o.id));
  const liveCandidates = candidates.filter(
    (a) =>
      (!a.serviceOrderId || !orderIds.has(a.serviceOrderId)) &&
      !(a.status === "PENDING" && isPendingAppointmentPaymentExpired(a)),
  );
  const appointmentIntervals = await resolveTakenAppointmentIntervals(
    client,
    branchId,
    liveCandidates,
    fallbackMinutes,
  );
  const orderIntervals = orderCandidates.flatMap((o) => {
    if (o.status !== "SCHEDULED" && o.occupiesCapacity === false) return [];
    const resolved = resolveOrderEffectiveInterval(o);
    // Corrupt data (a computed end <= start) has no positive evidence of
    // occupancy, same as buildBranchSchedule's "invalid-interval" issue —
    // exclude rather than silently reserving the rest of the day for it.
    if (resolved.invalid || !resolved.start) return [];
    const start = resolved.start.getTime();
    if (!Number.isFinite(start) || start >= dayEnd.getTime()) return [];
    // Missing/unknown estimate: conservatively occupy through end of day,
    // matching buildBranchSchedule's "uncertain" fallback.
    const end = resolved.end != null && Number.isFinite(resolved.end.getTime())
      ? resolved.end.getTime()
      : dayEnd.getTime();
    if (end <= dayStart.getTime()) return [];
    return [{ startMs: start, endMs: end }];
  });

  return [
    ...appointmentIntervals.map((iv) => ({
      startMs: iv.start.getTime(),
      endMs: iv.start.getTime() + iv.durationMinutes * 60000,
    })),
    ...orderIntervals,
  ];
}

/**
 * Сервер тал — тухайн цаг (slot) хараахан дүүрээгүй эсэхийг шалгана
 * (давхар захиалгаас сэргийлнэ). `durationMinutes` — ШИНЭ захиалгын өөрийнх нь
 * нийт үргэлжлэх хугацаа (сонгосон ангиллуудын нийлбэр); өгөгдөөгүй бол
 * салбарын slot урттай тэнцүү гэж үзнэ.
 *
 * Overlap-based: зөвхөн `when`-тэй ижил слот-ийн НАРИЙН цонхонд эхэлсэн
 * захиалгыг биш, харин `[when, when+durationMinutes)`-той ЯМАРЧ цаг хугацаа
 * давхцаж буй (тэдгээрийн ӨӨРИЙНХ нь хугацаагаар) захиалгыг тоолно — эс
 * бөгөөс эрт эхэлсэн урт захиалга дараагийн цагуудыг "сул" мэт үзүүлж,
 * давхар захиалга үүсгэдэг байсан (жишээ: 12:00 + 120 мин захиалгатай ч
 * 12:30 "сул" гэж харагдаж, дахин захиалагдах боломжтой байсан).
 */
export async function isSlotAvailable(
  client: PrismaTransactionClient,
  branchId: string,
  when: Date,
  durationMinutes?: number,
  // Захиалгаа шилжүүлж байгаа Appointment-ийн ӨӨРИЙНХ нь одоогийн байрлалыг
  // "эзэлсэн" гэж тоохгүй байхын тулд (эс бөгөөс өөрийгөө өөртэйгөө
  // мөргөлдсөн мэт үзнэ).
  excludeAppointmentId?: string,
): Promise<boolean> {
  const branch = await client.branch.findUnique({
    where: { id: branchId },
    select: { slotMinutes: true, slotCapacity: true },
  });
  const slotMin = branch?.slotMinutes ?? DEFAULT_SLOT_MINUTES;
  const cap = branch?.slotCapacity ?? DEFAULT_SLOT_CAPACITY;
  const newDuration =
    durationMinutes && durationMinutes > 0 ? durationMinutes : slotMin;
  const newStartMs = when.getTime();
  const newEndMs = newStartMs + newDuration * 60000;

  // Тухайн өдрийн БҮХ идэвхтэй захиалгыг авна (зөвхөн `when`-ий орчмынхыг биш) —
  // эрт эхэлсэн ч урт хугацаатай захиалга хожуу цагтай давхцаж болно.
  const { start: dayStart, end: dayEnd } = bookingDayBounds(bookingDateKey(when));
  const intervals = await resolveTakenCapacityIntervals(
    client,
    branchId,
    dayStart,
    dayEnd,
    slotMin,
    excludeAppointmentId,
  );
  const count = peakOccupancy(intervals, newStartMs, newEndMs);
  return count < cap;
}
