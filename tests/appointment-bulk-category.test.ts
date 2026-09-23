import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Same environment limitation documented in tests/appointment-lifecycle-routes.test.ts
// and tests/appointment-commands.test.ts: this route transitively imports
// lib/appointments/appointment-commands.ts, which imports
// lib/subscription-server.ts, which does `import "server-only"` — not
// resolvable under plain Node module resolution (`tsx --test`), and there is
// no database connection available here either way. Behavioral coverage for
// this route is therefore `npm run build` + `npm run lint` + manual/staging
// verification, matching the P2-B1/B2 precedent. What follows is structural
// (source-text) verification of the route's wiring, boundary validation, and
// delegation to the P2-B1 bulk command — plus a few pure unit tests of the
// route's own request-body parser, which has no Prisma/server-only
// dependency and so *can* run live by importing it directly. Those live
// tests are marked BEHAVIORAL below; everything else is STRUCTURAL.

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

function readSource(relativePath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relativePath), "utf8");
}

const routeSource = () => readSource("../app/api/v1/appointments/bulk/category/route.ts");
const bulkCommandsSource = () => readSource("../lib/appointments/appointment-bulk-commands.ts");

// --- STRUCTURAL: wiring (auth / permission / scope / delegation) -----------

test("STRUCTURAL: route requires an authenticated ApiUser", () => {
  const src = routeSource();
  assert.match(src, /requireApiUser\(req\)/);
  assert.match(src, /if \(auth\.response\) return auth\.response;/);
});

test("STRUCTURAL: route requires appointments.edit", () => {
  const src = routeSource();
  assert.match(src, /requirePermission\(auth\.user,\s*"appointments\.edit"\)/);
  assert.match(src, /if \(denied\) return denied;/);
});

test("STRUCTURAL: route resolves the X-Working-Branch scope before the bulk command runs", () => {
  const src = routeSource();
  const resolveIdx = src.indexOf("resolveWorkingBranch(req, auth.user)");
  const commandIdx = src.indexOf("bulkChangeAppointmentCategoryCommand(");
  assert.notEqual(resolveIdx, -1, "must call resolveWorkingBranch");
  assert.notEqual(commandIdx, -1, "must call bulkChangeAppointmentCategoryCommand");
  assert.ok(resolveIdx < commandIdx, "scope must be resolved before the command runs");
  assert.match(src, /if \(scopeResult\.response\) return scopeResult\.response;/);
});

test("STRUCTURAL: route passes the resolved scope into the actor, not a bare header value", () => {
  const src = routeSource();
  assert.match(
    src,
    /actor:\s*\{\s*\.\.\.auth\.user,\s*workingBranchId:\s*scopeResult\.branchId\s*\?\?\s*undefined\s*\}/,
  );
});

test("STRUCTURAL: route delegates to the P2-B1 bulk command and performs no inline Prisma write of its own", () => {
  const src = routeSource();
  assert.match(src, /await bulkChangeAppointmentCategoryCommand\(/);
  assert.doesNotMatch(src, /prisma\.appointment\.update\(/);
  assert.doesNotMatch(src, /prisma\.\$transaction\(/);
  assert.doesNotMatch(src, /prisma\.appointmentCategory\./);
});

test("STRUCTURAL: route maps the command's plain-Error scope/subscription rejections to 403, not 500", () => {
  const src = routeSource();
  assert.match(src, /STAFF_SCOPE_MESSAGES/);
  assert.match(src, /SUBSCRIPTION_LOCKED_MESSAGE/);
  assert.match(src, /jsonError\(403, error\.message\)/);
});

test("STRUCTURAL: route returns the bulk command's result verbatim as the response body", () => {
  const src = routeSource();
  assert.match(src, /return jsonOk\(result\);/);
});

// --- STRUCTURAL: boundary validation reuses the P2-B1 constant, not a local copy ---

test("STRUCTURAL: route imports MAX_BULK_APPOINTMENT_IDS from the P2-B1 bulk-commands module rather than redefining it", () => {
  const src = routeSource();
  assert.match(
    src,
    /import\s*\{[^}]*MAX_BULK_APPOINTMENT_IDS[^}]*\}\s*from\s*"@\/lib\/appointments\/appointment-bulk-commands"/,
  );
  assert.doesNotMatch(src, /MAX_BULK_APPOINTMENT_IDS\s*=\s*\d/, "must not redefine the cap locally");
});

test("STRUCTURAL: the imported cap is in fact exported by the bulk-commands module (no drift)", () => {
  const src = bulkCommandsSource();
  assert.match(src, /export const MAX_BULK_APPOINTMENT_IDS\s*=\s*100/);
});

test("STRUCTURAL: route rejects empty appointmentIds at the boundary before touching any row", () => {
  const src = routeSource();
  assert.match(src, /rawIds\.length === 0/);
});

test("STRUCTURAL: route rejects an oversized appointmentIds list at the boundary", () => {
  const src = routeSource();
  assert.match(src, /rawIds\.length > MAX_BULK_APPOINTMENT_IDS/);
});

test("STRUCTURAL: route rejects duplicate appointmentIds at the boundary", () => {
  const src = routeSource();
  assert.match(src, /seen\.has\(appointmentId\)/);
});

test("STRUCTURAL: route wraps the singular categoryId into the command's categoryIds array, not the other way round", () => {
  const src = routeSource();
  assert.match(src, /categoryIds:\s*\[parsed\.categoryId\]/);
});

// --- STRUCTURAL: response shape mirrors the orders bulk-status precedent ---

test("STRUCTURAL: response shape matches the orders bulk/status precedent ({succeeded, failed:[{id, code, message}]})", () => {
  const ordersRouteSrc = readSource("../app/api/v1/orders/bulk/status/route.ts");
  const bulkCommandsSrc = bulkCommandsSource();
  // Both bulk endpoints return the command's result object verbatim.
  assert.match(ordersRouteSrc, /return jsonOk\(result\);/);
  assert.match(routeSource(), /return jsonOk\(result\);/);
  // The appointment bulk command's result type carries the same
  // succeeded/failed{code,message} shape as the order one.
  assert.match(bulkCommandsSrc, /succeeded:\s*string\[\]/);
  assert.match(bulkCommandsSrc, /failed:\s*BulkAppointmentFailure\[\]/);
  assert.match(bulkCommandsSrc, /code:\s*string;\s*\n\s*message:\s*string;/);
});

// --- STRUCTURAL: deterministic ordering and per-row independence come from the command ---

test("STRUCTURAL: the P2-B1 bulk command iterates targets in input order and never aborts the batch on one failure", () => {
  const src = bulkCommandsSource();
  const forOfIdx = src.indexOf("for (const appointmentId of input.appointmentIds)");
  assert.notEqual(forOfIdx, -1, "must iterate appointmentIds in the given order (deterministic)");
  assert.match(src, /catch \(error\) \{\s*failed\.push\(failureFor\(appointmentId, error\)\);\s*\}/);
});

test("STRUCTURAL: the P2-B1 command re-derives estimatedDurationMinutes from resolveCategoryDurations on category change", () => {
  const src = bulkCommandsSource();
  assert.match(src, /resolveCategoryDurations\(tx, uniqueIds\)/);
  assert.match(src, /estimatedDurationMinutes:\s*totalMinutes/);
});

test("STRUCTURAL: the P2-B1 command forbids category change once a ServiceOrder is linked (LINKED_ORDER_EXISTS)", () => {
  const src = bulkCommandsSource();
  assert.match(src, /LINKED_ORDER_EXISTS/);
  assert.match(src, /appt\.serviceOrderId/);
});

test("STRUCTURAL: the P2-B1 command rejects a cross-tenant appointment id (APPOINTMENT_OUT_OF_SCOPE)", () => {
  const src = bulkCommandsSource();
  assert.match(src, /actor\.tenantId !== appt\.tenantId/);
  assert.match(src, /APPOINTMENT_OUT_OF_SCOPE/);
});

test("STRUCTURAL: the P2-B1 command scopes the category lookup by tenant and active status (ineligible category -> CATEGORY_NOT_FOUND)", () => {
  const src = bulkCommandsSource();
  assert.match(src, /tenantId:\s*actor\.tenantId,\s*isActive:\s*true/);
  assert.match(src, /branches:\s*\{ some: \{ id: appt\.branchId \} \}/);
  assert.match(src, /branches:\s*\{ none: \{\} \}/);
  assert.match(src, /CATEGORY_NOT_FOUND/);
});

test("STRUCTURAL: the P2-B1 command applies branch scope through assertStaffScope before mutating a row (forbidden-row / branch negative)", () => {
  const src = bulkCommandsSource();
  const scopeIdx = src.indexOf("await assertStaffScope(actor, appt.branchId);");
  const txIdx = src.indexOf("await prisma.$transaction(");
  assert.notEqual(scopeIdx, -1);
  assert.notEqual(txIdx, -1);
  assert.ok(scopeIdx < txIdx, "scope must be asserted before the mutating transaction");
});

// Note: there is no BEHAVIORAL (live-imported) coverage of the route module
// itself. Importing `route.ts` — even just to reach its unexported parser —
// transitively pulls in lib/appointments/appointment-commands.ts ->
// lib/subscription-server.ts -> `import "server-only"`, which cannot resolve
// under `tsx --test` (see the file banner above and the P2-B1/lifecycle-route
// precedent). Every test in this file is therefore STRUCTURAL (source-text)
// verification; nothing here executes the route's request handler.
