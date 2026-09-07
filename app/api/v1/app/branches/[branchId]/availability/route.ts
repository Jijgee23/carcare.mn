import { jsonError, jsonOk } from "@/lib/api";
import {
  buildDaySlots,
  DEFAULT_SLOT_CAPACITY,
  DEFAULT_SLOT_MINUTES,
  weekdayFromDate,
} from "@/lib/appointment-slots";
import {
  resolveBranchCategoryDurations,
  resolveTakenAppointmentIntervals,
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
      openTime: true,
      closeTime: true,
      slotMinutes: true,
      slotCapacity: true,
      tenant: { select: { acceptsOnlineBooking: true, suspended: true } },
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
  if (!branch) return jsonError(404, "Салбар олдсонгүй.");
  if (!branch.tenant.acceptsOnlineBooking || branch.tenant.suspended) {
    return jsonError(403, "Энэ байгууллага онлайн цаг захиалга хүлээн авахгүй.");
  }
  if (
    !(await isFeatureEnabled(branch.tenantId, PLAN_LIMIT_CODES.ONLINE_BOOKING))
  ) {
    return jsonError(403, "Энэ байгууллага онлайн цаг захиалга хүлээн авахгүй.");
  }

  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = weekdayFromDate(new Date(y, m - 1, d));
  const sched = branch.schedules.find((s) => s.weekday === weekday);
  // Тухайн өдрийн хуваарь байвал баримтална; байхгүй бол branch-ийн default цаг.
  const open = sched
    ? sched.isOpen
    : branch.openTime != null && branch.closeTime != null;
  const openTime = sched ? (sched.openTime ?? branch.openTime) : branch.openTime;
  const closeTime = sched
    ? (sched.closeTime ?? branch.closeTime)
    : branch.closeTime;

  // Сонгосон ангилалуудын нийт хугацаа (booking v2). Хоосон бол default slot урт.
  const slotMin = branch.slotMinutes ?? DEFAULT_SLOT_MINUTES;
  const { totalMinutes } = categoryIds.length
    ? await resolveBranchCategoryDurations(prisma, branch.id, categoryIds)
    : { totalMinutes: 0 };
  const appointmentMinutes = totalMinutes > 0 ? totalMinutes : slotMin;

  // Тухайн өдрийн аль хэдийн авсан цагууд.
  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  const takenRows = await prisma.appointment.findMany({
    where: {
      branchId: branch.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      requestedAt: { gte: dayStart, lt: dayEnd },
    },
    select: {
      requestedAt: true,
      categoryId: true,
      categories: { select: { categoryId: true } },
    },
  });
  // Захиалга бүрийн ЖИНХЭНЭ эзэлж буй хугацаа (эхлэх цаг + өөрийнх нь
  // үргэлжлэх хугацаа) — эрт эхэлсэн урт захиалга дараагийн slot-уудыг
  // "сул" мэт үзүүлэхээс сэргийлнэ.
  const taken = await resolveTakenAppointmentIntervals(
    prisma,
    branch.id,
    takenRows,
    slotMin,
  );

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

  return jsonOk({ date: dateStr, durationMinutes: appointmentMinutes, ...availability });
}
