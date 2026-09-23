// Contract — GET /api/v1/reports (P7-B0)
//
// GET /api/v1/reports
//   Auth: any authenticated user (no permission code — D-174: reports on
//     mobile match the web, which gates on `requireUser()` only). The
//     missing web permission gate is a separate, already-recorded issue —
//     this route does not add one either, to keep parity.
//   Query: from?, to? — both optional, YYYY-MM-DD. If either is present,
//     both must parse, `from <= to`, and the span must be at most
//     `MAX_REPORT_RANGE_DAYS` (366) days. Absent both, defaults to "this
//     month" (mirrors `parseRange`'s web default). Unknown params are
//     rejected with 422 `{error, code: "VALIDATION", fieldErrors}`.
//   200: { range: { from, to, label, key }, data: ReportData }
//   Errors: 401 (no code), 422 (VALIDATION)
//
// Tenant scoping and the query plan are unchanged from the web dashboard:
// this route calls the same `lib/reports.ts` loader the page and the export
// routes call (P7-B0 moved it there), it does not fork it. Branch scoping
// uses `resolveWorkingBranch` (X-Working-Branch header + shift lock), the same
// mobile pattern as `/overview` and `/appointments`. `loadReportData` takes the already-resolved id so the loader
// itself stays un-forked between the two callers.
import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { rejectUnknownParams } from "@/lib/list-query-params";
import { loadReportData, parseRange, validateReportRangeParams } from "@/lib/reports";

const ALLOWED_PARAMS = ["from", "to"] as const;

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(req.url);

  const unknown = rejectUnknownParams(searchParams, ALLOWED_PARAMS);
  if (unknown) {
    return jsonError(422, unknown.message, {
      code: "VALIDATION",
      fieldErrors: { [unknown.field]: unknown.message },
    });
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const invalid = validateReportRangeParams({ from, to });
  if (invalid) {
    return jsonError(422, invalid.message, {
      code: "VALIDATION",
      fieldErrors: { [invalid.field]: invalid.message },
    });
  }

  const range = parseRange({ from: from ?? undefined, to: to ?? undefined });
  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;
  const data = await loadReportData(auth.user, range, scopeResult.branchId ?? null);

  return jsonOk({ range, data });
}
