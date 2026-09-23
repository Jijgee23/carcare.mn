import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";
import type { ApiUser } from "../lib/auth/api-token";

// P5-B2 — server-rendered diagnostic report PDF endpoint
// (`app/api/v1/diagnostics/reports/[id]/pdf/route.ts`), additive only. Extracts
// the `@react-pdf/renderer` `Document`/`Page` layout from the existing
// client-only `pdf-generator.tsx` into `lib/diagnostics-pdf.tsx`'s
// `renderReportPdf`, which this route calls server-side (`renderToBuffer`,
// not the client's `BlobProvider`).
//
// Same split as `tests/diagnostic-routes-security.test.ts` (P5-B0), for the
// same reason: this repo's Prisma client needs a real `adapter-pg`
// connection even for a single query, and there is no prisma-mocking
// convention here (see `tests/service-commands.test.ts`,
// `tests/customer-commands.test.ts`). So:
//   - the actual PDF byte output IS exercised for real, since
//     `renderReportPdf` is a pure function of its input (no Prisma inside);
//   - `requirePermission`/`canViewOrder` are exercised BEHAVIORALLY against
//     the real primitives the route calls;
//   - permission-gate placement (before the Prisma read), tenant-scoping,
//     and the order-scoped "404 not 403" pattern are asserted structurally
//     (source-pattern) against the real route source, mirroring the existing
//     `GET /api/v1/diagnostics/reports/[id]/route.ts` exactly as the slice
//     spec requires.

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

let requirePermission: typeof import("../lib/api").requirePermission;
let hasPermission: typeof import("../lib/auth/roles").hasPermission;
let canViewOrder: typeof import("../lib/auth/order-access").canViewOrder;
let renderReportPdf: typeof import("../lib/diagnostics-pdf").renderReportPdf;
type DiagnosticReportPdfData = import("../lib/diagnostics-pdf").DiagnosticReportPdfData;

before(async () => {
  const [api, roles, orderAccess, diagnosticsPdf] = await Promise.all([
    import("../lib/api"),
    import("../lib/auth/roles"),
    import("../lib/auth/order-access"),
    import("../lib/diagnostics-pdf"),
  ]);
  requirePermission = api.requirePermission;
  hasPermission = roles.hasPermission;
  canViewOrder = orderAccess.canViewOrder;
  renderReportPdf = diagnosticsPdf.renderReportPdf;
});

function src(relPath: string): string {
  return readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), relPath),
    "utf8",
  );
}

function pdfRouteSource(): string {
  return src("../app/api/v1/diagnostics/reports/[id]/pdf/route.ts");
}

function user(overrides: Partial<ApiUser> & { permissions?: string[] }): ApiUser {
  const { permissions, ...rest } = overrides;
  return {
    id: "u1",
    tenantId: "t1",
    isOwner: false,
    role: permissions ? { permissions, name: "Test" } : null,
    ...rest,
  } as ApiUser;
}

// 1x1 red PNG, generated locally (no network fetch needed by
// @react-pdf/renderer's image decoder during the test).
const TINY_PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

function happyPathReport(): DiagnosticReportPdfData {
  return {
    reportId: "rpt_test1",
    templateName: "Ерөнхий үзлэг",
    templateVersion: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    customerName: "Бат-Эрдэнэ",
    customerPhone: "99001122",
    vehicleMake: "Toyota",
    vehicleModel: "Prius",
    vehiclePlate: "1234 УБА",
    branchName: "Төв салбар",
    signatureUrl: TINY_PNG_DATA_URI,
    sections: [
      {
        id: "sec1",
        title: "Үндсэн үзлэг",
        items: [
          { id: "brakes", label: "Тормоз", type: "check", required: false },
          { id: "photoitem", label: "Гэмтлийн зураг", type: "photo", required: false },
          { id: "sigitem", label: "Гарын үсэг", type: "signature", required: false },
        ],
      },
    ],
    data: {
      brakes: { value: "Солих" },
      photoitem: { photos: [TINY_PNG_DATA_URI] },
      sigitem: { value: TINY_PNG_DATA_URI },
    },
  };
}

// --- Behavioral: renderReportPdf produces a real PDF for a report with at
// least one photo, one signature reference, and one check-type answer.

test("renderReportPdf produces a buffer whose byte signature starts with %PDF for a happy-path report", async () => {
  const buffer = await renderReportPdf(happyPathReport());
  assert.ok(buffer.length > 0, "PDF buffer must not be empty");
  assert.equal(buffer.subarray(0, 4).toString("latin1"), "%PDF");
});

test("renderReportPdf handles a report with no photos/signature and only a check answer", async () => {
  const report = happyPathReport();
  report.signatureUrl = undefined;
  report.sections = [
    {
      id: "sec1",
      title: "Үндсэн үзлэг",
      items: [{ id: "brakes", label: "Тормоз", type: "check", required: false }],
    },
  ];
  report.data = { brakes: { value: "Хэвийн" } };
  const buffer = await renderReportPdf(report);
  assert.equal(buffer.subarray(0, 4).toString("latin1"), "%PDF");
});

// --- Behavioral: requirePermission("diagnostics.view") — same permission the
// existing GET /reports/[id] route requires, reused verbatim by this route.

test("permission-denied: a role lacking diagnostics.view is rejected", () => {
  const denied = user({ permissions: ["orders.view"] });
  assert.notEqual(requirePermission(denied, "diagnostics.view"), null);
});

test("positive: a role holding diagnostics.view is allowed", () => {
  const granted = user({ permissions: ["diagnostics.view"] });
  assert.equal(requirePermission(granted, "diagnostics.view"), null);
});

test("owner bypass: an owner never needs the explicit diagnostics.view code", () => {
  const owner = user({ isOwner: true, permissions: [] });
  assert.equal(hasPermission(owner, "diagnostics.view"), true);
  assert.equal(requirePermission(owner, "diagnostics.view"), null);
});

// --- Behavioral: canViewOrder — the real function the route calls for the
// order-scoped case.

test("cross-tenant / out-of-scope negative: canViewOrder is false for an 'own' scope user not assigned to the order", () => {
  const ownScopeUser = user({ permissions: ["orders.viewOwn"] });
  const otherOrder = { assignedToId: "someone-else" };
  assert.equal(canViewOrder(ownScopeUser, otherOrder), false);
});

test("order-scoped positive: canViewOrder is true for a branch-scope viewer regardless of assignment", () => {
  const branchScopeUser = user({ permissions: ["orders.view"] });
  const otherOrder = { assignedToId: "someone-else" };
  assert.equal(canViewOrder(branchScopeUser, otherOrder), true);
});

// --- Source-pattern: GET /api/v1/diagnostics/reports/[id]/pdf gates on
// diagnostics.view, before the Prisma read, tenant-scoped (proxy for the
// cross-tenant negative — a cross-tenant id can never match this where and
// falls through to the same 404 as "missing").

test("GET .../reports/[id]/pdf gates on diagnostics.view before the Prisma read, tenant-scoped", () => {
  const source = pdfRouteSource();
  const permCheck = source.indexOf('requirePermission(auth.user, "diagnostics.view")');
  const findFirst = source.indexOf("prisma.diagnosticReport.findFirst");
  assert.ok(permCheck >= 0, "must call requirePermission(auth.user, \"diagnostics.view\")");
  assert.ok(findFirst > permCheck, "permission check must precede the Prisma read");
  assert.match(
    source,
    /id,\s*\n\s*tenantId:\s*auth\.user\.tenantId/,
    "must look up the report by id AND tenantId together, matching the existing route",
  );
});

test("GET .../reports/[id]/pdf authenticates before authorizing", () => {
  const source = pdfRouteSource();
  const authIdx = source.indexOf("requireApiUser(req)");
  const earlyReturn = source.indexOf("if (auth.response) return auth.response;");
  const permIdx = source.indexOf("requirePermission(auth.user,");
  assert.ok(authIdx >= 0, "must call requireApiUser(req)");
  assert.ok(earlyReturn > authIdx, "must early-return auth.response");
  assert.ok(permIdx > earlyReturn, "permission check must come after the auth early-return");
});

// --- Source-pattern: order-scoped case returns 404, not 403, exactly like
// the existing GET /reports/[id] route — existence must never leak via a
// different status code.

test("GET .../reports/[id]/pdf returns 404 (not 403) for both a missing report and an order-access denial", () => {
  const source = pdfRouteSource();
  assert.match(
    source,
    /if\s*\(!report\)\s*return\s*jsonError\(404,/,
    "a missing report must 404",
  );
  assert.match(
    source,
    /if\s*\(report\.order\s*&&\s*!canViewOrder\(auth\.user,\s*report\.order\)\)\s*return\s*jsonError\(404,/,
    "an order-scoped access denial must also 404, matching the existing route's pattern exactly",
  );
  assert.doesNotMatch(
    source,
    /canViewOrder[^;]*jsonError\(403/,
    "the order-scoped denial must never leak existence via a 403",
  );
});

test("GET .../reports/[id]/pdf never returns a bare 403 anywhere (auth denial is the only 403, via requirePermission)", () => {
  const source = pdfRouteSource();
  assert.doesNotMatch(source, /jsonError\(403/, "this route has no direct 403 — only requirePermission's own 403 and the 404s above");
});

// --- Wiring sanity: response shape

test("GET .../reports[id]/pdf responds with a PDF content type and an attachment disposition", () => {
  const source = pdfRouteSource();
  assert.match(source, /"Content-Type":\s*"application\/pdf"/);
  assert.match(source, /"Content-Disposition":\s*`attachment; filename="/);
  assert.match(source, /renderReportPdf\(/, "must call the shared renderReportPdf function");
});

// --- Additive-only guarantee: this slice must not touch the existing
// client-side PDF button, print button, or the reports detail page.

test("lib/diagnostics-pdf.tsx does not import from pdf-generator.tsx or use client-only APIs", () => {
  const pdfLibSource = src("../lib/diagnostics-pdf.tsx");
  assert.doesNotMatch(pdfLibSource, /from\s*["'][^"']*pdf-generator["']/, "must not import the client-only document definition");
  assert.doesNotMatch(pdfLibSource, /"use client"/, "must stay a server module, not a client component");
  assert.doesNotMatch(pdfLibSource, /<BlobProvider|import\s*\{[^}]*BlobProvider/, "server-side renderer must not use the client-only BlobProvider");
});
