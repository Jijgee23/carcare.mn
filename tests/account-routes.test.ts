import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";

// P8-B1 — PATCH /api/v1/me, POST /api/v1/me/password, GET /api/v1/me/sessions,
// DELETE /api/v1/me/sessions/[id], POST /api/v1/me/sessions/revoke-others.
//
// Same split as tests/feedback-routes.test.ts: behavioural coverage is the
// auth gate (401 without a token, no DB needed to observe that); everything
// downstream (self-only scoping via `auth.user.id`, foreign-id 404,
// delegation to lib/account/**, no secret fields, rate-limit mapping) is
// covered by source-pattern assertions against the route files themselves.

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

function src(relPath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relPath), "utf8");
}

let PATCH_ME: typeof import("../app/api/v1/me/route").PATCH;
let GET_ME: typeof import("../app/api/v1/me/route").GET;
let POST_PASSWORD: typeof import("../app/api/v1/me/password/route").POST;
let GET_SESSIONS: typeof import("../app/api/v1/me/sessions/route").GET;
let DELETE_SESSION: typeof import("../app/api/v1/me/sessions/[id]/route").DELETE;
let POST_REVOKE_OTHERS: typeof import("../app/api/v1/me/sessions/revoke-others/route").POST;

before(async () => {
  [
    { PATCH: PATCH_ME, GET: GET_ME },
    { POST: POST_PASSWORD },
    { GET: GET_SESSIONS },
    { DELETE: DELETE_SESSION },
    { POST: POST_REVOKE_OTHERS },
  ] = await Promise.all([
    import("../app/api/v1/me/route"),
    import("../app/api/v1/me/password/route"),
    import("../app/api/v1/me/sessions/route"),
    import("../app/api/v1/me/sessions/[id]/route"),
    import("../app/api/v1/me/sessions/revoke-others/route"),
  ]);
});

function idCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

// --- behavioural: auth gate ---------------------------------------------------

test("GET /api/v1/me without auth returns 401 (unchanged)", async () => {
  const res = await GET_ME(new Request("http://x/api/v1/me"));
  assert.equal(res.status, 401);
});

test("PATCH /api/v1/me without auth returns 401", async () => {
  const res = await PATCH_ME(
    new Request("http://x/api/v1/me", { method: "PATCH", body: "{}" }),
  );
  assert.equal(res.status, 401);
});

test("POST /api/v1/me/password without auth returns 401", async () => {
  const res = await POST_PASSWORD(
    new Request("http://x/api/v1/me/password", { method: "POST", body: "{}" }),
  );
  assert.equal(res.status, 401);
});

test("GET /api/v1/me/sessions without auth returns 401", async () => {
  const res = await GET_SESSIONS(new Request("http://x/api/v1/me/sessions"));
  assert.equal(res.status, 401);
});

test("GET /api/v1/me/sessions still 401s with an unknown param (auth runs first)", async () => {
  const res = await GET_SESSIONS(new Request("http://x/api/v1/me/sessions?bogus=1"));
  assert.equal(res.status, 401);
});

test("DELETE /api/v1/me/sessions/[id] without auth returns 401", async () => {
  const res = await DELETE_SESSION(
    new Request("http://x/api/v1/me/sessions/abc?source=web", { method: "DELETE" }),
    idCtx("abc"),
  );
  assert.equal(res.status, 401);
});

test("POST /api/v1/me/sessions/revoke-others without auth returns 401", async () => {
  const res = await POST_REVOKE_OTHERS(
    new Request("http://x/api/v1/me/sessions/revoke-others", { method: "POST" }),
  );
  assert.equal(res.status, 401);
});

// --- source-pattern: self-only scoping, delegation, no secrets ---------------

test("PATCH /api/v1/me acts on auth.user.id only, never a body/param userId, and delegates to updateProfile", () => {
  const source = src("../app/api/v1/me/route.ts");
  const fn = source.slice(source.indexOf("export async function PATCH"), source.indexOf("export async function GET"));
  assert.match(fn, /updateProfile\(\s*prisma,\s*\{\s*id:\s*auth\.user\.id,\s*tenantId:\s*auth\.user\.tenantId\s*\}/);
  assert.doesNotMatch(fn, /userId:\s*body|id:\s*body\.id/);
});

test("PATCH /api/v1/me maps field errors to 422 VALIDATION and audits like the web action", () => {
  const source = src("../app/api/v1/me/route.ts");
  const fn = source.slice(source.indexOf("export async function PATCH"), source.indexOf("export async function GET"));
  assert.match(fn, /jsonError\(422,[^)]*\)/);
  assert.match(fn, /code:\s*"VALIDATION"/);
  assert.match(fn, /logAudit\(/);
  assert.match(fn, /summary:\s*"Профайл шинэчлэв"/);
});

test("PATCH /api/v1/me returns the same shape as GET /me (delegates to a shared response builder)", () => {
  const source = src("../app/api/v1/me/route.ts");
  const patchFn = source.slice(source.indexOf("export async function PATCH"), source.indexOf("export async function GET"));
  const getFn = source.slice(source.indexOf("export async function GET"));
  assert.match(patchFn, /buildMeResponse\(auth\.user\.id, auth\.user\.tenantId\)/);
  // GET's own inline shape still includes the same field set (unchanged).
  for (const field of ["id:", "email:", "firstName:", "lastName:", "phone:", "isOwner:", "role:", "tenant", "branch"]) {
    assert.match(getFn, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("POST /api/v1/me/password passes auth.user.refreshTokenId as currentRefreshTokenId (D-180 keeps this device alive)", () => {
  const source = src("../app/api/v1/me/password/route.ts");
  assert.match(source, /currentRefreshTokenId:\s*auth\.user\.refreshTokenId\s*\?\?\s*null/);
  assert.match(source, /changePassword\(\s*prisma,/);
});

test("POST /api/v1/me/password maps the core's RATE_LIMITED code to HTTP 429", () => {
  const source = src("../app/api/v1/me/password/route.ts");
  assert.match(source, /result\.code\s*===\s*"RATE_LIMITED"/);
  assert.match(source, /jsonError\(429,[^)]*code:\s*"RATE_LIMITED"/);
});

test("POST /api/v1/me/password never echoes passwordHash or any password field back", () => {
  const source = src("../app/api/v1/me/password/route.ts");
  // The only response body is `jsonOk({ ok: true })` — assert that literally,
  // so nothing (password-shaped or otherwise) can be echoed back.
  assert.match(source, /jsonOk\(\{\s*ok:\s*true\s*\}\)/);
  assert.doesNotMatch(source, /jsonOk\([^;]*password/i);
});

test("GET /api/v1/me/sessions delegates to listAccountSessions with the caller's own id and current-token context", () => {
  const source = src("../app/api/v1/me/sessions/route.ts");
  assert.match(source, /listAccountSessions\(prisma, auth\.user\.id,/);
  assert.match(source, /currentRefreshTokenId:\s*auth\.user\.refreshTokenId\s*\?\?\s*null/);
  // The route never touches raw Prisma session/token selects itself — no
  // tokenHash field can appear here because it never queries the tables
  // directly (covered structurally: only `listAccountSessions(` appears as
  // a data-access call, and its own no-tokenHash guarantee is covered by
  // tests/account-sessions.test.ts).
  assert.doesNotMatch(source, /findMany|findUnique/);
});

test("DELETE /api/v1/me/sessions/[id] requires an explicit source and 404s a foreign/missing id via revokeAccountSession's ownership check", () => {
  const source = src("../app/api/v1/me/sessions/[id]/route.ts");
  assert.match(source, /rawSource\s*!==\s*"web"\s*&&\s*rawSource\s*!==\s*"mobile"/);
  assert.match(source, /revokeAccountSession\(prisma, auth\.user\.id, source, id\)/);
  assert.match(source, /jsonError\(404,[^)]*NOT_FOUND/);
});

test("POST /api/v1/me/sessions/revoke-others delegates to revokeOtherAccountSessions scoped to the caller", () => {
  const source = src("../app/api/v1/me/sessions/revoke-others/route.ts");
  assert.match(source, /revokeOtherAccountSessions\(\s*prisma,\s*auth\.user\.id,/);
  assert.match(source, /currentRefreshTokenId:\s*auth\.user\.refreshTokenId\s*\?\?\s*null/);
});

test("none of the /me routes accept a userId/id override from the request body or params", () => {
  for (const file of [
    "../app/api/v1/me/route.ts",
    "../app/api/v1/me/password/route.ts",
    "../app/api/v1/me/sessions/route.ts",
    "../app/api/v1/me/sessions/[id]/route.ts",
    "../app/api/v1/me/sessions/revoke-others/route.ts",
  ]) {
    const source = src(file);
    assert.doesNotMatch(source, /body\.userId|params\.userId|searchParams\.get\("userId"\)/);
  }
});
