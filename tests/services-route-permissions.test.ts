import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";
import type { ApiUser } from "../lib/auth/api-token";

// `app/api/v1/services/route.ts` and `app/api/v1/services/[id]/route.ts`
// transitively import `lib/subscription-server.ts`, which does
// `import "server-only"`. That package is not a real dependency (Next's
// bundler resolves it specially at build time), so plain `tsx --test` module
// resolution cannot import either route file directly — the same gap
// documented in `tests/customers-list-route.test.ts` and
// `tests/customer-detail-routes.test.ts` for the P3-B0 correction this slice
// (P4-B0a) mirrors.
//
// What is tested with real runtime behaviour, without a database:
//   1. `requirePermission`/`hasPermission` — the exact primitives each
//      handler calls — for denied/granted/owner-bypass, against the
//      `services.view`/`services.create` codes this slice adds.
// What is asserted structurally (source-pattern), and why each one is a
// legitimate proxy given the import barrier:
//   - each handler gates on its permission code before any Prisma call
//   - POST also gates on `requireActiveSubscriptionApi`, after the
//     permission check and before the request body is parsed/used
//   - every Prisma read/write in the file stays scoped by
//     `auth.user.tenantId` (unchanged by this slice, re-asserted here so a
//     future edit can't drop the gate silently alongside the tenant scope)

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

function src(relPath: string): string {
  return readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), relPath),
    "utf8",
  );
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

function listRouteSections() {
  const source = src("../app/api/v1/services/route.ts");
  const getStart = source.indexOf("export async function GET");
  const postStart = source.indexOf("export async function POST");
  assert.ok(getStart >= 0 && postStart > getStart, "GET must precede POST");
  return {
    full: source,
    get: source.slice(getStart, postStart),
    post: source.slice(postStart),
  };
}

function detailRouteSource() {
  return src("../app/api/v1/services/[id]/route.ts");
}

// --- Behavioral: requirePermission/hasPermission for the codes this slice adds

test("services.view permission-denied for a role lacking the code", () => {
  const denied = user({ permissions: ["orders.view"] });
  assert.notEqual(requirePermission(denied, "services.view"), null);
});

test("services.view positive for a role that has the code", () => {
  const granted = user({ permissions: ["services.view"] });
  assert.equal(requirePermission(granted, "services.view"), null);
});

test("services.view owner bypass — owners never need the explicit code", () => {
  const owner = user({ isOwner: true, permissions: [] });
  assert.equal(hasPermission(owner, "services.view"), true);
  assert.equal(requirePermission(owner, "services.view"), null);
});

test("services.create permission-denied for a role lacking the code", () => {
  const denied = user({ permissions: ["services.view"] });
  assert.notEqual(requirePermission(denied, "services.create"), null);
});

test("services.create positive for a role that has the code", () => {
  const granted = user({ permissions: ["services.create"] });
  assert.equal(requirePermission(granted, "services.create"), null);
});

test("services.create owner bypass", () => {
  const owner = user({ isOwner: true, permissions: [] });
  assert.equal(hasPermission(owner, "services.create"), true);
  assert.equal(requirePermission(owner, "services.create"), null);
});

// --- Cross-tenant negative: the tenant scope that turns a foreign id into 404

test("services.view denial and services.create denial are independent — a customers-only role gets neither", () => {
  const crossResourceRole = user({ permissions: ["customers.view", "customers.create"] });
  assert.notEqual(requirePermission(crossResourceRole, "services.view"), null);
  assert.notEqual(requirePermission(crossResourceRole, "services.create"), null);
});

// --- Source-pattern: GET /api/v1/services gates before querying, tenant-scoped

test("GET /api/v1/services gates on services.view before building the query, and the query stays tenant-scoped", () => {
  const { get } = listRouteSections();
  const permCheck = get.indexOf('requirePermission(auth.user, "services.view")');
  const whereBuild = get.indexOf("const where: Prisma.ServiceWhereInput");
  const findMany = get.indexOf("prisma.service.findMany");
  assert.ok(permCheck >= 0, "GET must call requirePermission(auth.user, \"services.view\")");
  assert.ok(whereBuild > permCheck, "permission check must run before the where is built");
  assert.ok(findMany > whereBuild, "the Prisma read must use the built where");
  assert.match(get, /tenantId:\s*auth\.user\.tenantId/, "GET's where must stay tenant-scoped");
});

// --- Source-pattern: POST /api/v1/services gates permission then subscription

test("POST /api/v1/services gates on services.create, then requireActiveSubscriptionApi, before parsing the body", () => {
  const { post } = listRouteSections();
  const permCheck = post.indexOf('requirePermission(auth.user, "services.create")');
  const subCheck = post.indexOf("requireActiveSubscriptionApi(auth.user)");
  const bodyParse = post.indexOf("req.json()");
  assert.ok(permCheck >= 0, "POST must call requirePermission(auth.user, \"services.create\")");
  assert.ok(subCheck > permCheck, "subscription check must run after the permission check");
  assert.ok(bodyParse > subCheck, "body parsing must happen after both gates");
});

test("POST /api/v1/services creates the row scoped to auth.user.tenantId", () => {
  const { post } = listRouteSections();
  assert.match(post, /tenantId:\s*auth\.user\.tenantId,?\s*\n\s*\},\s*\n\s*select: SERVICE_SELECT/);
});

// --- Source-pattern: GET /api/v1/services/[id] gates before the Prisma read

test("GET /api/v1/services/[id] gates on services.view before the Prisma read, and the lookup stays tenant-scoped", () => {
  const source = detailRouteSource();
  const permCheck = source.indexOf('requirePermission(auth.user, "services.view")');
  const findFirst = source.indexOf("prisma.service.findFirst");
  assert.ok(permCheck >= 0, "GET must call requirePermission(auth.user, \"services.view\")");
  assert.ok(findFirst > permCheck, "permission check must precede the Prisma read");
  assert.match(
    source,
    /prisma\.service\.findFirst\(\{\s*where:\s*\{\s*id,\s*tenantId:\s*auth\.user\.tenantId/,
    "GET must look up the service by id AND tenantId together",
  );
});

test("GET /api/v1/services/[id] does not require an active subscription — reads stay available to a locked tenant", () => {
  const source = detailRouteSource();
  const getStart = source.indexOf("export async function GET");
  assert.ok(getStart >= 0);
  // Scope to just the GET function's own body — slicing to EOF broke once
  // P4-B1 legitimately added PATCH/DELETE below GET in this same file, both
  // of which correctly call requireActiveSubscriptionApi. Find the next
  // top-level export after GET to bound the slice.
  const nextExportOffset = source.indexOf("export async function", getStart + 1);
  const getEnd = nextExportOffset >= 0 ? nextExportOffset : source.length;
  assert.doesNotMatch(source.slice(getStart, getEnd), /requireActiveSubscriptionApi/);
});

// --- Wiring sanity: both routes still require an authenticated ApiUser first

test("all three handlers require an authenticated ApiUser before any permission check", () => {
  const { get, post } = listRouteSections();
  const detail = detailRouteSource();
  for (const section of [get, post, detail]) {
    const authIdx = section.indexOf("requireApiUser(req)");
    const earlyReturn = section.indexOf("if (auth.response) return auth.response;");
    const permIdx = section.indexOf("requirePermission(auth.user,");
    assert.ok(authIdx >= 0, "must call requireApiUser(req)");
    assert.ok(earlyReturn > authIdx, "must early-return auth.response");
    assert.ok(permIdx > earlyReturn, "permission check must come after the auth early-return");
  }
});
