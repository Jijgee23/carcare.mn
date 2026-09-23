import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";
import type { ApiUser } from "../lib/auth/api-token";

// `app/api/v1/{overview,audit}/route.ts` transitively import
// `lib/subscription-server.ts`/`lib/prisma.ts` (`import "server-only"`), so
// plain `tsx --test` module resolution cannot import them directly — the
// same import barrier documented in `tests/employees-routes.test.ts`.
// Behavioural coverage here is `requirePermission`/`hasPermission` for
// `audit.view`; structural coverage is source-pattern: each handler auths,
// gates permission where required, validates params before any Prisma call,
// stays tenant-scoped, and (for /audit) redacts before/after.

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
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relPath), "utf8");
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

function routeSource(rel: string) {
  return src(`../app/api/v1/${rel}`);
}

// --- Behavioral: audit.view gating

test("audit.view permission-denied for a role lacking the code", () => {
  const denied = user({ permissions: ["orders.view"] });
  assert.notEqual(requirePermission(denied, "audit.view"), null);
});

test("audit.view positive for a role that has the code", () => {
  const granted = user({ permissions: ["audit.view"] });
  assert.equal(requirePermission(granted, "audit.view"), null);
});

test("audit.view owner bypass", () => {
  const owner = user({ isOwner: true, permissions: [] });
  assert.equal(hasPermission(owner, "audit.view"), true);
  assert.equal(requirePermission(owner, "audit.view"), null);
});

// --- GET /api/v1/overview — structural

test("GET /api/v1/overview auths, rejects unknown params, resolves branch scope, then delegates to loadOverviewData before responding", () => {
  const source = routeSource("overview/route.ts");
  const auth = source.indexOf("requireApiUser(req)");
  const early = source.indexOf("if (auth.response) return auth.response;");
  const unknown = source.indexOf("rejectUnknownParams(");
  const scope = source.indexOf("resolveWorkingBranch(req, auth.user)");
  const load = source.indexOf("loadOverviewData(");
  const ok = source.indexOf("jsonOk(");
  assert.ok(auth >= 0 && early > auth, "must auth before anything else");
  assert.ok(unknown > early, "unknown-param rejection must run after auth");
  assert.ok(scope > unknown, "branch scope must resolve after param validation");
  assert.ok(load > scope, "loadOverviewData must be called after branch scope resolves");
  assert.ok(ok > load, "the response must be built after loadOverviewData resolves");
  assert.match(source, /tenantId:\s*auth\.user\.tenantId/, "must stay tenant-scoped");
});

test("GET /api/v1/overview does not gate any extra permission (matches the web dashboard: auth only)", () => {
  const source = routeSource("overview/route.ts");
  assert.doesNotMatch(source, /requirePermission\(/, "overview must not require a permission code");
});

// --- GET /api/v1/audit — structural

test("GET /api/v1/audit gates audit.view before param validation or any Prisma call", () => {
  const source = routeSource("audit/route.ts");
  const auth = source.indexOf("requireApiUser(req)");
  const early = source.indexOf("if (auth.response) return auth.response;");
  const perm = source.indexOf('requirePermission(auth.user, "audit.view")');
  const unknown = source.indexOf("rejectUnknownParams(");
  const rangeValidate = source.indexOf("validateAuditRangeParams(");
  const findMany = source.indexOf("prisma.auditLog.findMany");
  assert.ok(auth >= 0 && early > auth && perm > early, "must auth then gate audit.view");
  assert.ok(unknown > perm, "unknown-param rejection must run after the permission gate");
  assert.ok(rangeValidate > unknown, "date-range validation must run after unknown-param rejection");
  assert.ok(findMany > rangeValidate, "the Prisma read must come after all param validation");
});

test("GET /api/v1/audit builds its where via buildAuditWhere and stays tenant-scoped", () => {
  const source = routeSource("audit/route.ts");
  assert.match(source, /buildAuditWhere\(auth\.user\.tenantId,/);
});

test("GET /api/v1/audit redacts before/after and never returns raw AuditLog JSON fields", () => {
  const source = routeSource("audit/route.ts");
  assert.match(source, /before:\s*redactAuditJson\(l\.before\)/);
  assert.match(source, /after:\s*redactAuditJson\(l\.after\)/);
});

test("GET /api/v1/audit returns vocab lists sourced from lib/audit.ts", () => {
  const source = routeSource("audit/route.ts");
  assert.match(source, /import\s*{\s*ACTION_TYPES,\s*ENTITY_TYPES\s*}\s*from\s*"@\/lib\/audit"/);
  assert.match(source, /actions:\s*ACTION_TYPES/);
  assert.match(source, /entities:\s*ENTITY_TYPES/);
});

test("GET /api/v1/audit rejects unknown query params with 422 VALIDATION", () => {
  const source = routeSource("audit/route.ts");
  assert.match(source, /rejectUnknownParams\(searchParams, ALLOWED_PARAMS\)/);
  assert.match(source, /code:\s*"VALIDATION"/);
});
