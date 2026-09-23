import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { branchFilterConflicts } from "@/app/api/v1/appointments/route";
import { bookingDayBounds } from "@/lib/booking-time";
import { branchScheduleForDateSelect } from "@/lib/branch-effective-schedule-server";
import { computeBranchDayAvailability } from "@/lib/appointments/day-availability";
import { prisma } from "@/lib/prisma";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/v1/appointments/slots
// Query: branchId (required), date (required, YYYY-MM-DD business-local day),
// categoryIds? (comma-separated)
// Permission: appointments.view
//
// Deliberately NOT `resolvePublicAvailability`/`getBranchDaySlots`
// (app/_actions/appointments.ts) — that path is documented PUBLIC/ANONYMOUS
// only (runs under setBypassContext, gates on the tenant's online-booking
// plan feature and `acceptsOnlineBooking`), and its own header comment
// explicitly warns it must never back an authenticated staff surface. This
// route instead fetches+authorizes the branch itself (tenantId + the
// resolved working-branch header, no plan gate), then hands it to the
// shared `computeBranchDayAvailability` (lib/appointments/day-availability.ts)
// for the pure slot math both this route and `resolvePublicAvailability`
// need identically — see that module's header comment for why the
// auth/bypass/plan-gate split stays at the call sites instead.
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

  const categoryIds = [
    ...new Set(
      (url.searchParams.get("categoryIds")?.split(",") ?? [])
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId: auth.user.tenantId, isActive: true },
    select: {
      id: true,
      tenantId: true,
      slotMinutes: true,
      slotCapacity: true,
      ...branchScheduleForDateSelect(dateStr),
    },
  });
  if (!branch) {
    return jsonError(404, "Салбар олдсонгүй.");
  }

  const { start: dayStart, end: dayEnd } = bookingDayBounds(dateStr);
  const result = await computeBranchDayAvailability(prisma, {
    branch,
    dateStr,
    dayStart,
    dayEnd,
    categoryIds,
  });
  if (!result.ok) {
    return jsonError(422, "Үйлчилгээний ангиллаа дахин сонгоно уу.", {
      fieldErrors: { categoryIds: "Үйлчилгээний ангиллаа дахин сонгоно уу." },
    });
  }

  return jsonOk(result.availability);
}
