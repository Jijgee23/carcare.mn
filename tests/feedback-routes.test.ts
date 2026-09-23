import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";

// P7-B2 — GET/POST /api/v1/feedback, GET /api/v1/feedback/[id],
// POST /api/v1/feedback/[id]/replies.
//
// These routes transitively import `lib/subscription-server.ts`-adjacent
// server-only modules via `@/lib/api` in some sibling suites; here they only
// pull in `@/lib/api` + `@/lib/feedback-staff` + `@/lib/list-query-params` +
// `@/lib/pagination`, none of which are `server-only`-gated, so a plain
// dynamic import works (mirrors tests/reports-routes.test.ts, which imports
// its routes directly for the same reason).
//
// Behavioural coverage here is limited to the auth gate (401 without a
// token — no DB access needed to observe that). Everything downstream of
// auth (tenant scoping, validation, no-status/no-ADMIN) is covered by
// source-pattern assertions, matching the reports/employees suites' split
// between "runs for real" and "reads correctly from source" coverage.

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

function src(relPath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relPath), "utf8");
}

let GET_LIST: typeof import("../app/api/v1/feedback/route").GET;
let POST_CREATE: typeof import("../app/api/v1/feedback/route").POST;
let GET_ONE: typeof import("../app/api/v1/feedback/[id]/route").GET;
let POST_REPLY: typeof import("../app/api/v1/feedback/[id]/replies/route").POST;

before(async () => {
  [{ GET: GET_LIST, POST: POST_CREATE }, { GET: GET_ONE }, { POST: POST_REPLY }] = await Promise.all([
    import("../app/api/v1/feedback/route"),
    import("../app/api/v1/feedback/[id]/route"),
    import("../app/api/v1/feedback/[id]/replies/route"),
  ]);
});

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

// --- behavioural: auth gate ---------------------------------------------------

test("GET /api/v1/feedback without auth returns 401", async () => {
  const res = await GET_LIST(new Request("http://x/api/v1/feedback"));
  assert.equal(res.status, 401);
});

test("GET /api/v1/feedback still 401s with an unknown param (auth runs first)", async () => {
  const res = await GET_LIST(new Request("http://x/api/v1/feedback?bogus=1"));
  assert.equal(res.status, 401);
});

test("POST /api/v1/feedback without auth returns 401", async () => {
  const res = await POST_CREATE(new Request("http://x/api/v1/feedback", { method: "POST" }));
  assert.equal(res.status, 401);
});

test("GET /api/v1/feedback/[id] without auth returns 401", async () => {
  const res = await GET_ONE(new Request("http://x/api/v1/feedback/abc"), ctx("abc"));
  assert.equal(res.status, 401);
});

test("POST /api/v1/feedback/[id]/replies without auth returns 401", async () => {
  const res = await POST_REPLY(
    new Request("http://x/api/v1/feedback/abc/replies", { method: "POST" }),
    ctx("abc"),
  );
  assert.equal(res.status, 401);
});

// --- source-pattern: gate order, param rejection, tenant scoping -------------

test("GET /api/v1/feedback authenticates, rejects unknown params, then paginates before listing", () => {
  const source = src("../app/api/v1/feedback/route.ts");
  const getFn = source.slice(
    source.indexOf("export async function GET"),
    source.indexOf("export async function POST"),
  );
  const auth = getFn.indexOf("requireApiUser(req)");
  const early = getFn.indexOf("if (auth.response) return auth.response;");
  const unknown = getFn.indexOf("rejectUnknownParams(");
  const paginate = getFn.indexOf("parsePagination(");
  const list = getFn.indexOf("listStaffFeedback(");
  assert.ok(auth >= 0 && early > auth, "must auth before anything else");
  assert.ok(unknown > early, "unknown-param rejection must run after auth");
  assert.ok(paginate > unknown, "pagination parsing must run after unknown-param rejection");
  assert.ok(list > paginate, "listStaffFeedback must run after pagination parsing");
  assert.doesNotMatch(getFn, /requirePermission/, "D-176: feedback API is auth-only, no permission gate");
});

test("GET /api/v1/feedback scopes listStaffFeedback by the caller's own tenant, not a client-supplied tenantId", () => {
  const source = src("../app/api/v1/feedback/route.ts");
  assert.match(source, /listStaffFeedback\(actor,/);
  assert.doesNotMatch(source, /tenantId:\s*searchParams|tenantId:\s*body/);
});

test("POST /api/v1/feedback reads multipart form-data and delegates to createStaffFeedback", () => {
  const source = src("../app/api/v1/feedback/route.ts");
  const postFn = source.slice(source.indexOf("export async function POST"));
  assert.match(postFn, /req\.formData\(\)/);
  assert.match(postFn, /createStaffFeedback\(actor, formData\)/);
});

test("GET /api/v1/feedback/[id] scopes the lookup by the caller's own tenant and 404s when missing", () => {
  const source = src("../app/api/v1/feedback/[id]/route.ts");
  assert.match(source, /getStaffFeedbackWithThread\(actor, id\)/);
  assert.match(source, /jsonError\(404,[^)]*NOT_FOUND/);
  assert.doesNotMatch(source, /requirePermission/, "D-176: feedback API is auth-only");
});

test("POST /api/v1/feedback/[id]/replies never accepts authorType or status from the request body", () => {
  const source = src("../app/api/v1/feedback/[id]/replies/route.ts");
  const code = source.slice(source.indexOf("export async function POST"));
  assert.doesNotMatch(code, /body\.authorType|body\.author\b|body\.status/);
  assert.match(source, /addStaffFeedbackReply\(actor, id, message\)/);
});

test("no PATCH/PUT status handler exists anywhere under app/api/v1/feedback", () => {
  const list = src("../app/api/v1/feedback/route.ts");
  const one = src("../app/api/v1/feedback/[id]/route.ts");
  const replies = src("../app/api/v1/feedback/[id]/replies/route.ts");
  for (const source of [list, one, replies]) {
    assert.doesNotMatch(source, /export async function PATCH/);
    assert.doesNotMatch(source, /export async function PUT/);
  }
  // And there is no separate status sub-route.
  assert.throws(() => src("../app/api/v1/feedback/[id]/status/route.ts"));
});
