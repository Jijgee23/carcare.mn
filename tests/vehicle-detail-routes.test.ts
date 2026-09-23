import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";
import type { ApiUser } from "../lib/auth/api-token";

// Same environment/import-boundary story as tests/vehicles-list-route.test.ts:
// these routes transitively import `server-only` (via lib/api.ts -> ... ->
// lib/subscription-server.ts on sibling routes, and lib/prisma.ts's env
// validation), so `tsx --test` cannot import
// app/api/v1/vehicles/[id]/route.ts or .../refresh-hur/route.ts directly.
// Coverage here is therefore split:
//   - behavioral tests of the permission primitives each handler calls
//     (requirePermission/hasPermission, already proven generic and reused
//     here for the vehicles.view/edit/delete codes), and
//   - source-pattern assertions on the route files themselves, each labelled
//     with exactly what it pins and why a database-backed test isn't
//     available for it.
process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

let requirePermission: typeof import("../lib/api").requirePermission;
let hasPermission: typeof import("../lib/auth/roles").hasPermission;

before(async () => {
  [{ requirePermission }, { hasPermission }] = await Promise.all([
    import("../lib/api"),
    import("../lib/auth/roles"),
  ]);
});

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

function src(relPath: string): string {
  return readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), relPath),
    "utf8",
  );
}

// --- Permission primitives, each code this file's routes gate on ----------

test("vehicles.view / vehicles.edit / vehicles.delete each deny a role lacking the code", () => {
  for (const code of ["vehicles.view", "vehicles.edit", "vehicles.delete"] as const) {
    const denied = user({ permissions: ["orders.view"] });
    assert.notEqual(requirePermission(denied, code), null, `${code} must deny`);
  }
});

test("vehicles.view / vehicles.edit / vehicles.delete each pass for a role that has the code", () => {
  for (const code of ["vehicles.view", "vehicles.edit", "vehicles.delete"] as const) {
    const granted = user({ permissions: [code] });
    assert.equal(requirePermission(granted, code), null, `${code} must pass`);
  }
});

test("owners bypass all three codes without an explicit grant", () => {
  const owner = user({ isOwner: true, permissions: [] });
  for (const code of ["vehicles.view", "vehicles.edit", "vehicles.delete"] as const) {
    assert.equal(hasPermission(owner, code), true);
    assert.equal(requirePermission(owner, code), null);
  }
});

// --- app/api/v1/vehicles/[id]/route.ts --------------------------------

const DETAIL_ROUTE = "../app/api/v1/vehicles/[id]/route.ts";

test("GET gates on vehicles.view before any Prisma read, and scopes through TenantVehicle", () => {
  const source = src(DETAIL_ROUTE);
  const getStart = source.indexOf("export async function GET");
  const patchStart = source.indexOf("export async function PATCH");
  assert.ok(getStart >= 0 && patchStart > getStart, "GET must precede PATCH");
  const body = source.slice(getStart, patchStart);

  const permCheck = body.indexOf('requirePermission(auth.user, "vehicles.view")');
  const load = body.indexOf("loadTenantVehicle");
  assert.ok(permCheck >= 0, "GET must call requirePermission(auth.user, \"vehicles.view\")");
  assert.ok(load > permCheck, "permission check must run before the tenant-scoped read");

  // loadTenantVehicle itself must query through TenantVehicle, never
  // Vehicle directly (Phase 3 invariant: Vehicle has no tenantId).
  const helperStart = source.indexOf("async function loadTenantVehicle");
  const helperBody = source.slice(helperStart, source.indexOf("function commandErrorResponse"));
  assert.match(helperBody, /prisma\.tenantVehicle\.findUnique/);
  assert.match(helperBody, /tenantId_vehicleId:\s*\{\s*tenantId,\s*vehicleId\s*\}/);
  assert.doesNotMatch(helperBody, /prisma\.vehicle\.findUnique/);
});

test("GET returns 404 (not 403) when the TenantVehicle link is missing — no cross-tenant leak", () => {
  const source = src(DETAIL_ROUTE);
  const getStart = source.indexOf("export async function GET");
  const patchStart = source.indexOf("export async function PATCH");
  const body = source.slice(getStart, patchStart);
  assert.match(body, /if \(!vehicle\) return jsonError\(404, "Машин олдсонгүй\."\);/);
  assert.doesNotMatch(body, /jsonError\(403/);
});

test("PATCH gates on vehicles.edit, checks tenant linkage before mutating, and delegates to updateVehicleCommand", () => {
  const source = src(DETAIL_ROUTE);
  const patchStart = source.indexOf("export async function PATCH");
  const deleteStart = source.indexOf("export async function DELETE");
  const body = source.slice(patchStart, deleteStart);

  const permCheck = body.indexOf('requirePermission(auth.user, "vehicles.edit")');
  const tenantCheck = body.indexOf("prisma.tenantVehicle.findUnique");
  const command = body.indexOf("updateVehicleCommand({");
  assert.ok(permCheck >= 0, "PATCH must call requirePermission(auth.user, \"vehicles.edit\")");
  assert.ok(tenantCheck > permCheck, "tenant-link check must run after the permission gate");
  assert.ok(command > tenantCheck, "the command must run after the tenant-link 404 check");

  // 404-not-403 for another tenant's vehicle.
  assert.match(body, /if \(!existing\) return jsonError\(404, "Машин олдсонгүй\."\);/);
  assert.doesNotMatch(body, /jsonError\(403/);

  // No re-implemented validation/plate/owner-change logic — the command owns
  // all of that.
  assert.doesNotMatch(body, /prisma\.vehicle\.update/);
  assert.doesNotMatch(body, /prisma\.\$transaction/);
});

test("DELETE gates on vehicles.delete, checks tenant linkage, and delegates to deleteVehicleCommand", () => {
  const source = src(DETAIL_ROUTE);
  const deleteStart = source.indexOf("export async function DELETE");
  const body = source.slice(deleteStart);

  const permCheck = body.indexOf('requirePermission(auth.user, "vehicles.delete")');
  const tenantCheck = body.indexOf("prisma.tenantVehicle.findUnique");
  const command = body.indexOf("deleteVehicleCommand({");
  assert.ok(permCheck >= 0, "DELETE must call requirePermission(auth.user, \"vehicles.delete\")");
  assert.ok(tenantCheck > permCheck, "tenant-link check must run after the permission gate");
  assert.ok(command > tenantCheck, "the command must run after the tenant-link 404 check");

  assert.match(body, /if \(!existing\) return jsonError\(404, "Машин олдсонгүй\."\);/);
  assert.doesNotMatch(body, /jsonError\(403/);

  // Deletion must never touch prisma.vehicle directly from the route — only
  // the shared command (which itself only deletes the TenantVehicle link;
  // pinned separately in tests/vehicle-commands.test.ts).
  assert.doesNotMatch(body, /prisma\.vehicle\.delete/);
  assert.doesNotMatch(body, /prisma\.tenantVehicle\.deleteMany/);
});

test("errors from the shared commands are forwarded, not re-coded, by commandErrorResponse", () => {
  const source = src(DETAIL_ROUTE);
  const start = source.indexOf("function commandErrorResponse");
  const end = source.indexOf("export async function GET");
  const body = source.slice(start, end);
  assert.match(body, /error instanceof VehicleCommandError/);
  assert.match(body, /error\.status/);
  assert.match(body, /error\.message/);
  assert.match(body, /error\.code/);
});

// --- app/api/v1/vehicles/[id]/refresh-hur/route.ts ----------------------

const REFRESH_ROUTE = "../app/api/v1/vehicles/[id]/refresh-hur/route.ts";

test("refresh-hur gates on vehicles.edit before any Prisma read", () => {
  const source = src(REFRESH_ROUTE);
  const permCheck = source.indexOf('requirePermission(auth.user, "vehicles.edit")');
  const tenantRead = source.indexOf("prisma.tenantVehicle.findUnique");
  assert.ok(permCheck >= 0, "must call requirePermission(auth.user, \"vehicles.edit\")");
  assert.ok(tenantRead > permCheck, "permission check must run before the tenant-link read");
});

test("refresh-hur proves ownership through a TenantVehicle link scoped to the caller's tenant, mirroring the account route's AccountVehicle check", () => {
  const staffSource = src(REFRESH_ROUTE);
  assert.match(staffSource, /prisma\.tenantVehicle\.findUnique\(\{/);
  assert.match(staffSource, /tenantId_vehicleId:\s*\{\s*tenantId:\s*auth\.user\.tenantId,\s*vehicleId:\s*id\s*\}/);
  // 404-not-403 when the link is missing.
  assert.match(staffSource, /if \(!link\) return jsonError\(404, "Машин олдсонгүй\."\);/);
  assert.doesNotMatch(staffSource, /jsonError\(403/);

  // The account route's equivalent shape, for comparison — proves the two
  // routes check ownership through their respective realms (TenantVehicle vs
  // AccountVehicle) rather than one silently reusing the other's check.
  const accountSource = src("../app/api/v1/app/vehicles/[id]/refresh-hur/route.ts");
  assert.match(accountSource, /prisma\.accountVehicle\.findFirst\(\{/);
  assert.match(accountSource, /where:\s*\{\s*id,\s*accountId:\s*account\.id\s*\}/);
});

test("refresh-hur never forks or reimplements refreshVehicleFieldsFromHur — it calls the one shared helper", () => {
  const source = src(REFRESH_ROUTE);
  assert.match(source, /import \{ refreshVehicleFieldsFromHur \} from "@\/lib\/vehicle-hur-refresh"/);
  assert.match(source, /refreshVehicleFieldsFromHur\(link\.vehicle\.id, link\.vehicle\.plate\)/);
  // No inline HurService call or prisma.vehicle.update duplicating the
  // helper's write.
  assert.doesNotMatch(source, /HurService/);
  assert.doesNotMatch(source, /prisma\.vehicle\.update/);

  const helperSource = src("../lib/vehicle-hur-refresh.ts");
  assert.doesNotMatch(helperSource, /TenantVehicle|tenantId/);
});

test("an upstream HUR failure degrades to a clean 502 without corrupting stored fields", () => {
  const source = src(REFRESH_ROUTE);
  const start = source.indexOf("const result = await refreshVehicleFieldsFromHur");
  const body = source.slice(start, start + 400);
  assert.match(body, /if \(!result\.ok\)/);
  assert.match(body, /jsonError\(502, result\.message\)/);

  // Confirm the helper itself never writes on the failure branch (the write
  // only happens after a successful HUR call) — the route's 502 path cannot
  // corrupt data because the helper never reached prisma.vehicle.update.
  const helperSource = src("../lib/vehicle-hur-refresh.ts");
  const hurCallIdx = helperSource.indexOf("HurService.getVehicle(plate)");
  const updateIdx = helperSource.indexOf("prisma.vehicle.update");
  assert.ok(hurCallIdx >= 0 && updateIdx > hurCallIdx, "the HUR fetch (and its failure branch) must precede the write");
});

test("the unscoped cross-tenant serviceCount/diagnosisCount fields are stripped before the response leaves this route", () => {
  const source = src(REFRESH_ROUTE);
  assert.match(source, /const \{ serviceCount: _serviceCount, diagnosisCount: _diagnosisCount, \.\.\.vehicle \} =\s*result\.vehicle;/);
  assert.match(source, /return jsonOk\(\{ vehicle \}\)/);
  // The response payload variable itself must never carry the raw keys
  // through to jsonOk.
  const responseLine = source.slice(source.indexOf("return jsonOk({ vehicle })"));
  assert.doesNotMatch(responseLine.slice(0, 40), /serviceCount|diagnosisCount/);

  // Confirm what's being stripped really is unscoped — pins the leak against
  // the helper's own _count shape so this test breaks (loudly) if the helper
  // is ever changed to scope the counts, at which point stripping would be
  // the wrong fix.
  const helperSource = src("../lib/vehicle-hur-refresh.ts");
  const countsBlock = helperSource.slice(
    helperSource.indexOf("_count: {"),
    helperSource.indexOf("},", helperSource.indexOf("_count: {")) + 2,
  );
  assert.doesNotMatch(countsBlock, /tenantId/);
});

test("the account/mobile route passes the same counts through — deliberately, and not a leak there", () => {
  // Same helper, same unscoped counts, opposite conclusion. Several
  // TenantVehicle links can point at one Vehicle row, so those counts are
  // "this registration's history across the shops it has visited".
  //
  //   - To the ACCOUNT caller, that is their own car's history. Their data.
  //     The account route spreads it through, and that is fine.
  //   - To a STAFF caller it is not: a shop that did two of five jobs would
  //     learn three happened at other shops. That is why THIS route strips
  //     the fields (see the test above).
  //
  // Pinned so that nobody "fixes" the account route by analogy with ours, and
  // so that a future change to either side has to face the distinction.
  const accountSource = src("../app/api/v1/app/vehicles/[id]/refresh-hur/route.ts");
  assert.match(accountSource, /\.\.\.result\.vehicle/);
  assert.doesNotMatch(accountSource, /serviceCount: _|diagnosisCount: _/);
});
