// Contract — GET /api/v1/reports/export (P7-B0)
//
// GET /api/v1/reports/export
//   Auth: any authenticated user (no permission code — D-174/D-175). Same
//     `from`/`to` validation as `GET /api/v1/reports` (see that route's
//     comment): optional, YYYY-MM-DD, `from <= to`, span at most
//     `MAX_REPORT_RANGE_DAYS` (366) days, unknown params rejected.
//   200: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
//     body, `Content-Disposition: attachment; filename="tailan_<from>_<to>.xlsx"` —
//     byte-identical workbook to the web export (D-175: mobile reuses the
//     web's .xlsx workbook via `lib/reports-export.ts`, shared through the
//     device share sheet on the Flutter side; no CSV).
//   Errors: 401 (no code), 422 (VALIDATION)
import { jsonError, requireApiUser } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { rejectUnknownParams } from "@/lib/list-query-params";
import { loadReportData, parseRange, validateReportRangeParams } from "@/lib/reports";
import { buildReportWorkbook, reportExportFilename } from "@/lib/reports-export";

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
  const buffer = await buildReportWorkbook(data, range);
  const filename = reportExportFilename(range);

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
