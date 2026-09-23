import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, test } from "node:test";
import type { ApiUser } from "../lib/auth/api-token";

// See `tests/customers-list-route.test.ts` — `lib/api.ts` transitively
// imports `lib/prisma.ts`, which validates process.env at module load time,
// so these must be set before the dynamic import below.
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

// Same environment gap as `tests/customers-list-route.test.ts` — importing
// `app/api/v1/vehicles/route.ts` pulls in `lib/subscription-server.ts`
// (`import "server-only"`), which `tsx --test` cannot resolve. See that file's
// header comment and `tests/api-branch-routes.test.ts`'s KNOWN GAP note for the
// full explanation. This file applies the same two-pronged approach: behavioral
// tests of the permission primitives the GET handler calls, plus a source-
// pattern check that the handler actually calls them in the right order.

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

test("vehicles.view permission-denied for a role lacking the code", () => {
  const denied = user({ permissions: ["orders.view"] });
  const result = requirePermission(denied, "vehicles.view");
  assert.notEqual(result, null);
});

test("vehicles.view positive for a role that has the code", () => {
  const granted = user({ permissions: ["vehicles.view"] });
  const result = requirePermission(granted, "vehicles.view");
  assert.equal(result, null);
});

test("vehicles.view owner bypass — owners never need the explicit code", () => {
  const owner = user({ isOwner: true, permissions: [] });
  assert.equal(hasPermission(owner, "vehicles.view"), true);
  const result = requirePermission(owner, "vehicles.view");
  assert.equal(result, null);
});

test("GET handler gates on vehicles.view before querying, and the query stays tenant-scoped", async () => {
  const source = await readFile(new URL("../app/api/v1/vehicles/route.ts", import.meta.url), "utf8");
  const getStart = source.indexOf("export async function GET");
  const postStart = source.indexOf("export async function POST");
  assert.ok(getStart >= 0 && postStart > getStart, "GET must precede POST");
  const getBody = source.slice(getStart, postStart);

  const permCheck = getBody.indexOf('requirePermission(auth.user, "vehicles.view")');
  const buildWhere = getBody.indexOf("buildVehicleListWhere(");
  const findMany = getBody.indexOf("prisma.tenantVehicle.findMany");
  assert.ok(permCheck >= 0, "GET must call requirePermission(auth.user, \"vehicles.view\")");
  assert.ok(buildWhere > permCheck, "permission check must run before the where is built");
  assert.ok(findMany > buildWhere, "the Prisma read must use the built where");

  // Vehicle tenant isolation runs through the TenantVehicle join, not the
  // global Vehicle row (Phase 3 invariant). P3-B6 moved the where-building
  // into `lib/vehicles/vehicle-list-query.ts`, which is Prisma.TenantVehicle-
  // WhereInput-typed and asserted directly in
  // `tests/customer-vehicle-list-query.test.ts` (real behavioral coverage). Here we
  // only confirm the route passes its own tenantId into that builder.
  assert.match(
    getBody,
    /buildVehicleListWhere\(query,\s*\{\s*tenantId:\s*auth\.user\.tenantId\s*\}\)/,
    "GET must build the where clause scoped to auth.user.tenantId through TenantVehicle",
  );
});
