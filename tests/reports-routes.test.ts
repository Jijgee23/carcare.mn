import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";

// P7-B0 — Reports/export extraction and the mobile-facing API routes.
//
// Source-pattern coverage (mirroring tests/employees-routes.test.ts):
//   - the web page and web export route delegate to `lib/reports.ts` /
//     `lib/reports-export.ts` rather than re-implementing the loader or the
//     workbook builder ("moved, not forked");
//   - both new API routes call `requireApiUser` before anything else, reject
//     unknown params before validating `from`/`to`, and validate before
//     calling the loader;
//   - neither API route references a permission code (D-174: auth only).

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

function src(relPath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relPath), "utf8");
}

// --- source-pattern: web callers delegate to lib/, don't reimplement

test("app/dashboard/reports/data.ts re-exports from lib/reports, does not reimplement the loader", () => {
  const source = src("../app/dashboard/reports/data.ts");
  assert.match(source, /from "@\/lib\/reports"/);
  assert.doesNotMatch(source, /prisma\.serviceOrder/, "must not re-implement Prisma queries");
});

test("web dashboard page and export route call loadReportData from lib/reports, not a local copy", () => {
  const page = src("../app/dashboard/reports/page.tsx");
  const exportRoute = src("../app/dashboard/reports/export/route.ts");
  assert.match(page, /loadReportData\(user, range, workingBranchScopeId\(user\)\)/);
  assert.match(exportRoute, /from "@\/lib\/reports"/);
  assert.match(exportRoute, /loadReportData\(user, range, workingBranchScopeId\(user\)\)/);
  assert.match(exportRoute, /buildReportWorkbook\(data, range\)/);
  assert.doesNotMatch(exportRoute, /new ExcelJS\.Workbook/, "workbook building must live in lib/reports-export.ts, not the route");
});

test("lib/reports-export.ts owns the ExcelJS workbook construction", () => {
  const lib = src("../lib/reports-export.ts");
  assert.match(lib, /new ExcelJS\.Workbook/);
  assert.match(lib, /addWorksheet\("Хураангуй"\)/);
});

// --- GET /api/v1/reports

test("GET /api/v1/reports authenticates, rejects unknown params, then validates before loading", () => {
  const source = src("../app/api/v1/reports/route.ts");
  const auth = source.indexOf("requireApiUser(req)");
  const early = source.indexOf("if (auth.response) return auth.response;");
  const unknown = source.indexOf("rejectUnknownParams(");
  const validate = source.indexOf("validateReportRangeParams(");
  const load = source.indexOf("loadReportData(");
  assert.ok(auth >= 0 && early > auth, "must auth before anything else");
  assert.ok(unknown > early, "unknown-param rejection must run after auth");
  assert.ok(validate > unknown, "range validation must run after unknown-param rejection");
  assert.ok(load > validate, "loadReportData must run after validation");
  assert.doesNotMatch(source, /requirePermission/, "D-174: reports API is auth-only, no permission gate");
  assert.match(source, /resolveWorkingBranch\(req, auth\.user\)/, "must scope branches via resolveWorkingBranch, like /overview");
  assert.doesNotMatch(source, /workingBranchScopeId\(/, "the API route must not call the web-session-only workingBranchScopeId");
});

test("GET /api/v1/reports/export follows the same gate order and reuses the shared workbook builder", () => {
  const source = src("../app/api/v1/reports/export/route.ts");
  const auth = source.indexOf("requireApiUser(req)");
  const early = source.indexOf("if (auth.response) return auth.response;");
  const unknown = source.indexOf("rejectUnknownParams(");
  const validate = source.indexOf("validateReportRangeParams(");
  const load = source.indexOf("loadReportData(");
  const build = source.indexOf("buildReportWorkbook(");
  assert.ok(auth >= 0 && early > auth);
  assert.ok(unknown > early);
  assert.ok(validate > unknown);
  assert.ok(load > validate);
  assert.ok(build > load);
  assert.doesNotMatch(source, /requirePermission/, "D-174/D-175: export API is auth-only, no permission gate");
  assert.match(source, /resolveWorkingBranch\(req, auth\.user\)/);
  assert.match(source, /Content-Disposition/);
  assert.match(
    source,
    /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
  );
  assert.doesNotMatch(source, /new ExcelJS\.Workbook/, "must delegate workbook building to lib/reports-export.ts");
});

// --- behavioural: the routes actually run and produce the documented shape

let GET_REPORTS: typeof import("../app/api/v1/reports/route").GET;
let GET_EXPORT: typeof import("../app/api/v1/reports/export/route").GET;

before(async () => {
  [{ GET: GET_REPORTS }, { GET: GET_EXPORT }] = await Promise.all([
    import("../app/api/v1/reports/route"),
    import("../app/api/v1/reports/export/route"),
  ]);
});

function reqWithoutAuth(url: string): Request {
  return new Request(url);
}

test("GET /api/v1/reports without an Authorization header returns 401", async () => {
  const res = await GET_REPORTS(reqWithoutAuth("http://x/api/v1/reports"));
  assert.equal(res.status, 401);
});

test("GET /api/v1/reports still 401s with an unknown param and no auth (auth gate runs first, per the source-pattern check above)", async () => {
  const res = await GET_REPORTS(reqWithoutAuth("http://x/api/v1/reports?bogus=1"));
  assert.equal(res.status, 401);
});

test("rejectUnknownParams rejects a param outside from/to for the reports routes' ALLOWED_PARAMS", async () => {
  const { rejectUnknownParams } = await import("../lib/list-query-params");
  const err = rejectUnknownParams(new URLSearchParams("bogus=1"), ["from", "to"]);
  assert.ok(err);
  assert.equal(err!.field, "bogus");
});

test("GET /api/v1/reports/export without an Authorization header returns 401", async () => {
  const res = await GET_EXPORT(reqWithoutAuth("http://x/api/v1/reports/export"));
  assert.equal(res.status, 401);
});
