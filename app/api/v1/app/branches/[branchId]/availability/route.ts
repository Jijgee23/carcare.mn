import { jsonError, jsonOk } from "@/lib/api";
import { bookingDayBounds } from "@/lib/booking-time";
import { resolveEffectiveSchedule } from "@/lib/branch-effective-schedule";
import { branchScheduleForDateSelect } from "@/lib/branch-effective-schedule-server";
import {
  buildDaySlots,
  DEFAULT_SLOT_CAPACITY,
  DEFAULT_SLOT_MINUTES,
} from "@/lib/appointment-slots";
import {
  resolveBranchCategoryDurations,
  resolveTakenCapacityIntervals,
} from "@/lib/category-duration";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { isFeatureEnabled } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

// GET /api/v1/app/branches/[branchId]/availability?date=YYYY-MM-DD[&categoryIds=a,b,c]
// Нийтэд нээлттэй. Сонгосон ангилалуудын нийлбэр хугацаанд багтах сул цагуудыг
// (slot) буцаана — booking v2 D. categoryIds хоосон бол салбарын default slot урт.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ branchId: string }> },
) {
  setBypassContext();
  const { branchId } = await ctx.params;
  const sp = new URL(req.url).searchParams;

  const dateStr = sp.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return jsonError(400, "date (YYYY-MM-DD) шаардлагатай.");
  }
  const categoryIds = (sp.get("categoryIds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      tenantId: true,
      slotMinutes: true,
      slotCapacity: true,
      tenant: { select: { acceptsOnlineBooking: true, suspended: true } },
      ...branchScheduleForDateSelect(dateStr),
    },
  });
  if (!branch) return jsonError(404, "Салбар олдсонгүй.");
  if (!branch.tenant.acceptsOnlineBooking || branch.tenant.suspended) {
    return jsonError(403, "Энэ байгууллага онлайн цаг захиалга хүлээн авахгүй.");
  }
  if (
    !(await isFeatureEnabled(branch.tenantId, PLAN_LIMIT_CODES.ONLINE_BOOKING))
  ) {
    return jsonError(403, "Энэ байгууллага онлайн цаг захиалга хүлээн авахгүй.");
  }

  let bounds;
  try { bounds = bookingDayBounds(dateStr); } catch { return jsonError(400, "Буруу өдөр."); }
  const schedule = resolveEffectiveSchedule({ dateStr, branch });
  const { open, openTime, closeTime } = schedule;

  // Сонгосон ангилалуудын нийт хугацаа (booking v2). Хоосон бол default slot урт.
  const slotMin = branch.slotMinutes ?? DEFAULT_SLOT_MINUTES;
  const { totalMinutes } = categoryIds.length
    ? await resolveBranchCategoryDurations(prisma, branch.id, categoryIds)
    : { totalMinutes: 0 };
  const appointmentMinutes = totalMinutes > 0 ? totalMinutes : slotMin;

  // Тухайн өдрийн захиалга болон хүчин чадал эзэлж буй идэвхтэй ажлууд.
  const dayStart = bounds.start;
  const dayEnd = bounds.end;
  const capacityIntervals = await resolveTakenCapacityIntervals(
    prisma,
    branch.id,
    dayStart,
    dayEnd,
    slotMin,
  );
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
    appointmentMinutes,
  });

  return jsonOk({
    date: dateStr,
    durationMinutes: appointmentMinutes,
    scheduleSource: schedule.source,
    scheduleLabel: schedule.label,
    ...availability,
  });
}
