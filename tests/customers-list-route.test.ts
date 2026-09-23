import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, test } from "node:test";
import type { ApiUser } from "../lib/auth/api-token";

// `lib/api.ts` transitively imports `lib/prisma.ts`, which reads/validates
// process.env at module load time — these must be set before the (dynamic)
// import below, matching `tests/api-branch-routes.test.ts`'s pattern.
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

// `app/api/v1/customers/route.ts` transitively imports `lib/subscription-server.ts`,
// which does `import "server-only"`. That package is not a real dependency (Next's
// bundler resolves it specially at build time) so plain `tsx --test` module
// resolution cannot import the route file directly — confirmed:
// `Cannot find module 'server-only'`. This is the same pre-existing environment
// gap `tests/api-branch-routes.test.ts` documents for the orders routes, and it
// is not something this slice can work around without installing a real
// dependency or a hand-rolled resolution shim (out of scope).
//
// What we test instead, without a DB:
//   1. `requirePermission`/`hasPermission` — the exact primitives the GET handler
//      calls — behave correctly for denied, granted and owner-bypass cases. This
//      is real behavioral coverage of the security gate, just invoked directly
//      rather than through the unreachable route module.
//   2. A source-pattern check that `GET` in the route file actually calls
//      `requirePermission(auth.user, "customers.view")` before doing any Prisma
//      read, and that the tenant-scoping predicate is still present (the
//      cross-tenant guard `orderReadWhere`-equivalent for this route). This
//      cannot substitute for a runtime cross-tenant negative against real data,
//      but no database is available in this environment to run one.

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

test("customers.view permission-denied for a role lacking the code", () => {
  const denied = user({ permissions: ["orders.view"] });
  const result = requirePermission(denied, "customers.view");
  assert.notEqual(result, null);
});

test("customers.view positive for a role that has the code", () => {
  const granted = user({ permissions: ["customers.view"] });
  const result = requirePermission(granted, "customers.view");
  assert.equal(result, null);
});

test("customers.view owner bypass — owners never need the explicit code", () => {
  const owner = user({ isOwner: true, permissions: [] });
  assert.equal(hasPermission(owner, "customers.view"), true);
  const result = requirePermission(owner, "customers.view");
  assert.equal(result, null);
});

test("GET handler gates on customers.view before querying, and the query stays tenant-scoped", async () => {
  const source = await readFile(new URL("../app/api/v1/customers/route.ts", import.meta.url), "utf8");
  const getStart = source.indexOf("export async function GET");
  const postStart = source.indexOf("export async function POST");
  assert.ok(getStart >= 0 && postStart > getStart, "GET must precede POST");
  const getBody = source.slice(getStart, postStart);

  const permCheck = getBody.indexOf('requirePermission(auth.user, "customers.view")');
  const buildWhere = getBody.indexOf("buildCustomerListWhere(");
  const findMany = getBody.indexOf("prisma.customer.findMany");
  assert.ok(permCheck >= 0, "GET must call requirePermission(auth.user, \"customers.view\")");
  assert.ok(buildWhere > permCheck, "permission check must run before the where is built");
  assert.ok(findMany > buildWhere, "the Prisma read must use the built where");

  // P3-B6: the GET route now builds `where` via the shared
  // `lib/customers/customer-list-query.ts` builder instead of inlining the
  // predicate — the tenant scope is asserted directly against that builder
  // in `tests/customer-vehicle-list-query.test.ts` (a real behavioral check, not a
  // source-pattern one). Here we only confirm the route actually passes its
  // own tenantId into the builder call, not some other value.
  assert.match(
    getBody,
    /buildCustomerListWhere\(query,\s*\{\s*tenantId:\s*auth\.user\.tenantId\s*\}\)/,
    "GET must build the where clause scoped to auth.user.tenantId",
  );
});
