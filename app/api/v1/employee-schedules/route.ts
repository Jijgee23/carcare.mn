// P6-B3 — mobile read of the employees×days schedule grid, mirroring
// `app/dashboard/employees/schedule/page.tsx`'s data section (now
// `loadEmployeeScheduleGrid` in `lib/employee-schedule-read.ts`, P6-B1).
// Permission: `employees.view` — schedule READS are open to anyone who can
// view employees; only WRITES (PUT/DELETE/bulk) require `employees.schedule`
// (see TENANT_MOBILE_SLICES.md's Phase 6 invariants). `canEdit` in the
// response tells the client whether it may call those write endpoints, so it
// doesn't have to special-case the schedule permission code itself.
//
// Contract:
//   GET /api/v1/employee-schedules?view=week|month&date=YYYY-MM-DD&branchId=&q=
//     Permission: employees.view
//     Query:
//       view     — "week" (default) or "month"
//       date     — anchor date YYYY-MM-DD (default: today, business date)
//       branchId — optional home-branch filter
//       q        — optional name/role search
//     Unknown query params are rejected (400).
//     200 → {
//       view, dates: string[],
//       rows: EmployeeScheduleRowView[],  // each cell carries `source`
//       branches: ScheduleBranchView[],
//       countByBranch: Record<branchId, number>,
//       totalEmployees: number,
//       canEdit: boolean, // hasPermission(auth.user, "employees.schedule")
//     }
//     Errors: 401 (no code), 403 {error, code:"FORBIDDEN"}, 400 {error, code:"VALIDATION", fieldErrors}
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { hasPermission } from "@/lib/auth/roles";
import { businessDateKey } from "@/lib/branch-effective-schedule";
import { firstOfMonth, mondayOfWeek, monthDates, weekDates } from "@/lib/employee-schedule";
import { loadEmployeeScheduleGrid } from "@/lib/employee-schedule-read";
import { rejectUnknownParams } from "@/lib/list-query-params";
import { prisma } from "@/lib/prisma";

const ALLOWED_PARAMS = ["view", "date", "branchId", "q"] as const;

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "employees.view");
  if (denied) return denied;

  const url = new URL(req.url);
  const unknown = rejectUnknownParams(url.searchParams, ALLOWED_PARAMS);
  if (unknown) {
    return jsonError(400, unknown.message, { code: "VALIDATION", fieldErrors: { [unknown.field]: unknown.message } });
  }

  const viewParam = url.searchParams.get("view");
  if (viewParam != null && viewParam !== "week" && viewParam !== "month") {
    return jsonError(400, "view утга буруу байна.", {
      code: "VALIDATION",
      fieldErrors: { view: "view нь week эсвэл month байна." },
    });
  }
  const view: "week" | "month" = viewParam === "month" ? "month" : "week";

  const dateParam = url.searchParams.get("date");
  if (dateParam != null && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return jsonError(400, "date утга буруу байна.", {
      code: "VALIDATION",
      fieldErrors: { date: "date нь YYYY-MM-DD хэлбэртэй байна." },
    });
  }
  const anchor = dateParam ?? businessDateKey();

  const branchId = url.searchParams.get("branchId")?.trim() || "";
  const q = url.searchParams.get("q")?.trim() || "";

  const rangeStart = view === "month" ? firstOfMonth(anchor) : mondayOfWeek(anchor);
  const dates = view === "month" ? monthDates(rangeStart) : weekDates(rangeStart);

  const { rows, branches, countByBranch, totalEmployees } = await loadEmployeeScheduleGrid({
    db: prisma,
    tenantId: auth.user.tenantId,
    dates,
    branchId,
    q,
  });

  return jsonOk({
    view,
    dates,
    rows,
    branches,
    countByBranch: Object.fromEntries(countByBranch),
    totalEmployees,
    canEdit: hasPermission(auth.user, "employees.schedule"),
  });
}
