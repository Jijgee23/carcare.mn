import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";
import type { ApiUser } from "../lib/auth/api-token";

// `app/api/v1/employee-schedules/**` and `app/api/v1/me/schedule/route.ts`
// transitively import `lib/prisma.ts`/`lib/audit.ts`, which pull in
// "server-only" — the same import barrier documented in
// `tests/services-route-permissions.test.ts`, so these routes can't be
// imported directly by plain `tsx --test`. What is tested:
//   1. Behavioural: `requirePermission`/`hasPermission` for `employees.view`
//      and `employees.schedule` — the exact codes each handler gates on.
//   2. Source-pattern: each handler checks the right permission before any
//      Prisma/core call; the single-user routes (PUT/DELETE) call
//      `authorizeScheduleTarget` before the mutating core (P6-B1's core
//      relies on this — `resetEmployeeShiftCommand` takes no tenantId);
//      `/me/schedule` only ever uses `auth.user.id`, never a request-supplied
//      userId; every error response carries a `code`.

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

const GRID_ROUTE = "../app/api/v1/employee-schedules/route.ts";
const USER_ROUTE = "../app/api/v1/employee-schedules/[userId]/route.ts";
const BULK_ROUTE = "../app/api/v1/employee-schedules/bulk/route.ts";
const ME_SCHEDULE_ROUTE = "../app/api/v1/me/schedule/route.ts";

function functionSection(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `must export function ${name}`);
  const nextExport = source.indexOf("export async function", start + 1);
  return nextExport >= 0 ? source.slice(start, nextExport) : source.slice(start);
}

// --- Behavioural: requirePermission/hasPermission for the codes these routes gate on

test("employees.view permission-denied for a role lacking the code", () => {
  const denied = user({ permissions: ["orders.view"] });
  assert.notEqual(requirePermission(denied, "employees.view"), null);
});

test("employees.view positive for a role that has the code", () => {
  const granted = user({ permissions: ["employees.view"] });
  assert.equal(requirePermission(granted, "employees.view"), null);
});

test("employees.view owner bypass", () => {
  const owner = user({ isOwner: true, permissions: [] });
  assert.equal(hasPermission(owner, "employees.view"), true);
});

test("employees.schedule permission-denied for a role with only employees.view", () => {
  const viewOnly = user({ permissions: ["employees.view"] });
  assert.notEqual(requirePermission(viewOnly, "employees.schedule"), null);
});

test("employees.schedule positive for a role that has the code", () => {
  const granted = user({ permissions: ["employees.schedule"] });
  assert.equal(requirePermission(granted, "employees.schedule"), null);
});

test("employees.schedule owner bypass", () => {
  const owner = user({ isOwner: true, permissions: [] });
  assert.equal(hasPermission(owner, "employees.schedule"), true);
});

// --- Source-pattern: GET /api/v1/employee-schedules gates on employees.view

test("GET /api/v1/employee-schedules gates on employees.view before the grid load, and computes canEdit via employees.schedule", () => {
  const source = src(GRID_ROUTE);
  const permCheck = source.indexOf('requirePermission(auth.user, "employees.view")');
  const rejectUnknown = source.indexOf("rejectUnknownParams(");
  const gridLoad = source.indexOf("loadEmployeeScheduleGrid(");
  assert.ok(permCheck >= 0, "must call requirePermission(auth.user, \"employees.view\")");
  assert.ok(rejectUnknown > permCheck, "unknown-param rejection must run after the permission check");
  assert.ok(gridLoad > rejectUnknown, "grid load must run after param validation");
  assert.match(source, /hasPermission\(auth\.user,\s*"employees\.schedule"\)/, "canEdit must be derived from employees.schedule");
  assert.match(source, /tenantId:\s*auth\.user\.tenantId/, "grid load must stay tenant-scoped");
});

test("GET /api/v1/employee-schedules requires an authenticated ApiUser before the permission check", () => {
  const source = src(GRID_ROUTE);
  const authIdx = source.indexOf("requireApiUser(req)");
  const earlyReturn = source.indexOf("if (auth.response) return auth.response;");
  const permIdx = source.indexOf('requirePermission(auth.user, "employees.view")');
  assert.ok(authIdx >= 0 && earlyReturn > authIdx && permIdx > earlyReturn);
});

// --- Source-pattern: PUT/DELETE /api/v1/employee-schedules/[userId]

test("PUT /api/v1/employee-schedules/[userId] gates on employees.schedule, then authorizeScheduleTarget, before the upsert core", () => {
  const source = src(USER_ROUTE);
  const put = functionSection(source, "PUT");
  const permCheck = put.indexOf('requirePermission(auth.user, "employees.schedule")');
  const authorizeCall = put.indexOf("authorizeScheduleTarget(prisma,");
  const upsertCall = put.indexOf("upsertEmployeeShiftCommand(prisma,");
  assert.ok(permCheck >= 0, "PUT must call requirePermission(auth.user, \"employees.schedule\")");
  assert.ok(authorizeCall > permCheck, "authorizeScheduleTarget must run after the permission check");
  assert.ok(upsertCall > authorizeCall, "upsertEmployeeShiftCommand must run after authorizeScheduleTarget");
});

test("DELETE /api/v1/employee-schedules/[userId] gates on employees.schedule, then authorizeScheduleTarget, before the reset core", () => {
  const source = src(USER_ROUTE);
  const del = functionSection(source, "DELETE");
  const permCheck = del.indexOf('requirePermission(auth.user, "employees.schedule")');
  const authorizeCall = del.indexOf("authorizeScheduleTarget(prisma,");
  const resetCall = del.indexOf("resetEmployeeShiftCommand(prisma,");
  assert.ok(permCheck >= 0, "DELETE must call requirePermission(auth.user, \"employees.schedule\")");
  assert.ok(authorizeCall > permCheck, "authorizeScheduleTarget must run after the permission check");
  assert.ok(resetCall > authorizeCall, "resetEmployeeShiftCommand must run after authorizeScheduleTarget");
});

test("PUT and DELETE both pass tenantId to authorizeScheduleTarget so the target-in-tenant check is real", () => {
  const source = src(USER_ROUTE);
  const occurrences = source.match(/authorizeScheduleTarget\(prisma,\s*\{[^}]*tenantId:\s*auth\.user\.tenantId/g) ?? [];
  assert.equal(occurrences.length, 2, "both PUT and DELETE must pass auth.user.tenantId into authorizeScheduleTarget");
});

test("every error response in [userId]/route.ts carries a code", () => {
  const source = src(USER_ROUTE);
  const jsonErrorCalls = source.match(/jsonError\([^;]*?\);/g) ?? [];
  assert.ok(jsonErrorCalls.length > 0, "must have jsonError calls to check");
  for (const call of jsonErrorCalls) {
    assert.match(call, /code:/, `jsonError call missing code: ${call}`);
  }
});

// --- Source-pattern: POST /api/v1/employee-schedules/bulk

test("POST /api/v1/employee-schedules/bulk gates on employees.schedule before the bulk core, and does not call authorizeScheduleTarget (core tenant-filters targets itself)", () => {
  const source = src(BULK_ROUTE);
  const permCheck = source.indexOf('requirePermission(auth.user, "employees.schedule")');
  const bulkCall = source.indexOf("bulkUpsertEmployeeShiftCommand(prisma,");
  assert.ok(permCheck >= 0, "must call requirePermission(auth.user, \"employees.schedule\")");
  assert.ok(bulkCall > permCheck, "bulk core call must run after the permission check");
  assert.doesNotMatch(source, /authorizeScheduleTarget\(/, "bulk route must rely on the core's own tenant filter, not a per-target authorize call");
  assert.match(source, /tenantId:\s*auth\.user\.tenantId/, "bulk core call must be tenant-scoped");
});

test("every error response in bulk/route.ts carries a code", () => {
  const source = src(BULK_ROUTE);
  const jsonErrorCalls = source.match(/jsonError\([^;]*?\);/g) ?? [];
  assert.ok(jsonErrorCalls.length > 0, "must have jsonError calls to check");
  for (const call of jsonErrorCalls) {
    assert.match(call, /code:/, `jsonError call missing code: ${call}`);
  }
});

// --- Source-pattern: GET /api/v1/me/schedule — auth only, own id only

test("GET /api/v1/me/schedule requires auth but no permission code, and never reads a userId from the request", () => {
  const source = src(ME_SCHEDULE_ROUTE);
  assert.match(source, /requireApiUser\(req\)/, "must require an authenticated ApiUser");
  assert.doesNotMatch(source, /requirePermission\(/, "must not gate on a permission code — auth-only per the contract");
  assert.doesNotMatch(source, /searchParams\.get\("userId"\)/, "must never accept a userId from the query string");
  assert.doesNotMatch(source, /body\.userId|req\.json\(\)/, "must never accept a userId from a request body");
  assert.match(source, /userId:\s*auth\.user\.id/, "must load only the authenticated caller's own schedule");
});

test("GET /api/v1/me/schedule rejects unknown query params and validates month format", () => {
  const source = src(ME_SCHEDULE_ROUTE);
  assert.match(source, /rejectUnknownParams\(/);
  assert.match(source, /\/\^\\d\{4\}-\\d\{2\}\$\//, "must validate month as YYYY-MM");
});

test("every error response in me/schedule/route.ts carries a code", () => {
  const source = src(ME_SCHEDULE_ROUTE);
  const jsonErrorCalls = source.match(/jsonError\([^;]*?\);/g) ?? [];
  assert.ok(jsonErrorCalls.length > 0, "must have jsonError calls to check");
  for (const call of jsonErrorCalls) {
    assert.match(call, /code:/, `jsonError call missing code: ${call}`);
  }
});

// --- Wiring sanity: all four handlers require an authenticated ApiUser first

test("all handlers across the four route files require an authenticated ApiUser before anything else", () => {
  for (const file of [GRID_ROUTE, USER_ROUTE, BULK_ROUTE, ME_SCHEDULE_ROUTE]) {
    const source = src(file);
    const authIdx = source.indexOf("requireApiUser(req)");
    const earlyReturn = source.indexOf("if (auth.response) return auth.response;");
    assert.ok(authIdx >= 0, `${file} must call requireApiUser(req)`);
    assert.ok(earlyReturn > authIdx, `${file} must early-return auth.response`);
  }
});
