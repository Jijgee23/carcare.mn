import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { branchFilterConflicts } from "@/app/api/v1/appointments/route";
import { bookingDayBounds } from "@/lib/booking-time";
import { loadBranchSchedule } from "@/lib/branch-schedule-loader";
import { buildCalendarDayModel } from "@/lib/appointments/calendar-day-model";
import { prisma } from "@/lib/prisma";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/v1/appointments/calendar
// Query: branchId?, date (required, YYYY-MM-DD business-local day)
// Permission: appointments.view
//
// Returns the shared day-grid TRUTH model (lib/appointments/calendar-day-model.ts)
// for one branch/day — status, schedule issues, open-ended/day-boundary
// distinction, capacity overflow and a restricted legend — so a Flutter
// renderer never has to reimplement `grid-schedule.tsx`'s inline heuristics.
// Lane geometry stays purely `laneIndex`/`capacityOverflow` here; pixel/percent
// layout remains a renderer concern (lib/schedule-grid-layout.ts is for that,
// and is intentionally not exposed through this route).
export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "appointments.view");
  if (denied) return denied;

  const url = new URL(req.url);
  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;
  const scope = scopeResult.branchId;

  const branchIdParam = url.searchParams.get("branchId")?.trim() || undefined;
  if (branchFilterConflicts(scope, branchIdParam)) {
    return jsonError(422, "Query параметрийн branchId нь баталгаажсан ажлын салбартай зөрчилдөж байна.", {
      fieldErrors: { branchId: "Идэвхтэй ажлын салбараас өөр салбарын мэдээлэл хүсэх боломжгүй." },
    });
  }
  const branchId = scope ?? branchIdParam;
  if (!branchId) {
    return jsonError(422, "branchId шаардлагатай.", { fieldErrors: { branchId: "Салбар шаардлагатай." } });
  }

  const dateStr = url.searchParams.get("date")?.trim() ?? "";
  if (!DATE_RE.test(dateStr)) {
    return jsonError(422, "date (YYYY-MM-DD) шаардлагатай.", { fieldErrors: { date: "Огноо шаардлагатай." } });
  }
  try {
    bookingDayBounds(dateStr);
  } catch {
    return jsonError(422, "Буруу өдөр.", { fieldErrors: { date: "Огноо буруу." } });
  }

  // tenantId + branchId scoped read; a cross-tenant/inactive branchId (staff
  // typo, stale client cache, or a deliberately forged id) resolves to 404,
  // never a silent empty-day response that could be misread as "no bookings".
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId: auth.user.tenantId, isActive: true },
    select: { id: true, name: true, slotCapacity: true },
  });
  if (!branch) {
    return jsonError(404, "Салбар олдсонгүй.");
  }

  const schedule = await loadBranchSchedule({
    tenantId: auth.user.tenantId,
    branchId: branch.id,
    dateStr,
  });

  const model = buildCalendarDayModel({
    branchId: branch.id,
    branchName: branch.name,
    dateKey: dateStr,
    rangeStart: schedule.rangeStart,
    rangeEnd: schedule.rangeEnd,
    intervals: schedule.intervals,
    issues: schedule.issues,
    appointments: schedule.appointments,
    slotCapacity: branch.slotCapacity ?? 1,
  });

  return jsonOk(model);
}
