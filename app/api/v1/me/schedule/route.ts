// P6-B3 — the caller's own resolved-month schedule, mirroring
// `app/dashboard/my-schedule/page.tsx`'s data section (now `loadMySchedule`
// in `lib/employee-schedule-read.ts`, P6-B1). Auth only — no
// `employees.view`/`employees.schedule` check, and the userId always comes
// from the authenticated session, never from the request, so this can never
// return another user's schedule.
//
// Contract:
//   GET /api/v1/me/schedule?month=YYYY-MM
//     Auth: any authenticated user (no permission code)
//     Query: month — optional "YYYY-MM" (default: current month)
//     200 → { month, dates: string[], row: EmployeeScheduleRowView|null,
//              cells: Record<date, ScheduleCellView>, branches: ScheduleBranchView[] }
//     Errors:
//       401 (no code)
//       400 {error, code:"VALIDATION", fieldErrors} — bad month format
import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { firstOfMonth, monthDates } from "@/lib/employee-schedule";
import { loadMySchedule } from "@/lib/employee-schedule-read";
import { rejectUnknownParams } from "@/lib/list-query-params";
import { prisma } from "@/lib/prisma";

const ALLOWED_PARAMS = ["month"] as const;

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const unknown = rejectUnknownParams(url.searchParams, ALLOWED_PARAMS);
  if (unknown) {
    return jsonError(400, unknown.message, { code: "VALIDATION", fieldErrors: { [unknown.field]: unknown.message } });
  }

  const monthParam = url.searchParams.get("month");
  if (monthParam != null && !/^\d{4}-\d{2}$/.test(monthParam)) {
    return jsonError(400, "month утга буруу байна.", {
      code: "VALIDATION",
      fieldErrors: { month: "month нь YYYY-MM хэлбэртэй байна." },
    });
  }
  const month = monthParam ?? new Date().toISOString().slice(0, 7);
  const rangeStart = firstOfMonth(`${month}-01`);
  const dates = monthDates(rangeStart);

  const { row, cells, branches } = await loadMySchedule({
    db: prisma,
    tenantId: auth.user.tenantId,
    userId: auth.user.id,
    dates,
  });

  return jsonOk({ month, dates, row, cells, branches });
}
