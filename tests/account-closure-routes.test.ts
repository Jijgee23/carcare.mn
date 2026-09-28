import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";
const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const CUSTOMER = ["close/request-otp", "deactivate", "delete"].map(
  (r) => `app/api/v1/app/account/${r}/route.ts`,
);
let handlers: Array<(req: Request) => Promise<Response>> = [];

before(async () => {
  handlers = await Promise.all([
    import("../app/api/v1/app/account/close/request-otp/route").then((m) => m.POST),
    import("../app/api/v1/app/account/deactivate/route").then((m) => m.POST),
    import("../app/api/v1/app/account/delete/route").then((m) => m.POST),
  ]);
});

test("customer closure routes require a bearer token", async () => {
  for (const h of handlers) {
    const res = await h(new Request("http://x", { method: "POST", body: "{}" }));
    assert.equal(res.status, 401);
  }
});

test("deactivate/delete verify an ACCOUNT_CLOSE otp against the account's own phone", () => {
  for (const f of CUSTOMER.slice(1)) {
    const s = src(f);
    assert.match(s, /verifyPhoneOtp\(\{\s*phone:\s*account\.phone,\s*type:\s*"ACCOUNT_CLOSE"/);
  }
});

test("wrong/expired otp returns 422 with code OTP_INVALID, not 401", () => {
  for (const f of CUSTOMER.slice(1)) {
    const s = src(f);
    assert.match(s, /jsonError\(422,[\s\S]*?\{\s*code:\s*"OTP_INVALID"\s*\}\)/);
  }
});

test("delete anonymizes in one transaction and unlinks tenant customers", () => {
  const s = src("lib/account-closure/customer.ts");
  assert.match(s, /\$transaction/);
  assert.match(s, /accountTombstone/);
  assert.match(s, /customer\.updateMany\([\s\S]*accountId:\s*null/);
  assert.match(s, /appointment\.updateMany\([\s\S]*accountId:\s*null/);
  assert.match(s, /feedback\.updateMany\([\s\S]*accountId:\s*null/);
  assert.match(s, /device\.deleteMany/);
  assert.match(s, /notification\.deleteMany/);
  assert.match(s, /accountVehicle\.deleteMany/);
});

const STAFF = ["close/request-otp", "deactivate", "delete"].map((r) => `app/api/v1/me/${r}/route.ts`);

test("staff closure routes require auth", async () => {
  const hs = await Promise.all([
    import("../app/api/v1/me/close/request-otp/route").then((m) => m.POST),
    import("../app/api/v1/me/deactivate/route").then((m) => m.POST),
    import("../app/api/v1/me/delete/route").then((m) => m.POST),
  ]);
  for (const h of hs) assert.equal((await h(new Request("http://x", { method: "POST", body: "{}" }))).status, 401);
});

test("staff routes act only on auth.user.id with ACCOUNT_CLOSE otp and audit", () => {
  for (const f of STAFF.slice(1)) {
    const s = src(f);
    assert.match(s, /auth\.user\.id/);
    assert.match(s, /type:\s*"ACCOUNT_CLOSE"/);
    assert.match(s, /logAudit/);
    assert.match(s, /LAST_OWNER/);
  }
});

test("staff deactivate/delete routes audit only after the lib call succeeds, not before", () => {
  for (const f of STAFF.slice(1)) {
    const s = src(f);
    // The route must not import/call assertNotLastOwner itself — the check
    // lives inside deactivateStaffUser/deleteStaffUser now, so it runs once.
    assert.doesNotMatch(s, /assertNotLastOwner/);
    // logAudit must come after the deactivate/delete lib call in source
    // order, so a LAST_OWNER throw (caught above it) skips the audit.
    const libCallIdx = s.search(/await\s+(deactivateStaffUser|deleteStaffUser)\(/);
    const auditIdx = s.indexOf("await logAudit(");
    assert.ok(libCallIdx >= 0 && auditIdx >= 0, "expected both the lib call and logAudit");
    assert.ok(libCallIdx < auditIdx, `expected lib call before logAudit in ${f}`);
  }
});

test("staff deactivate/delete routes compute the audit summary (with the person's name) before the lib call", () => {
  for (const f of STAFF.slice(1)) {
    const s = src(f);
    const summaryIdx = s.search(/const summary = `[^`]*\$\{auth\.user\.(lastName|firstName)\}/);
    const libCallIdx = s.search(/await\s+(deactivateStaffUser|deleteStaffUser)\(/);
    assert.ok(summaryIdx >= 0, `expected a name-bearing summary computed in ${f}`);
    assert.ok(summaryIdx < libCallIdx, `expected summary computed before the lib call in ${f}`);
  }
});

test("staff closure revokes sessions and guards the last owner", () => {
  const s = src("lib/account-closure/staff.ts");
  assert.match(s, /revokeAllForUser|refreshToken\.deleteMany/);
  assert.match(s, /userSession\.deleteMany/);
  assert.match(s, /isOwner:\s*true/);
  assert.match(s, /userTombstone/);
});

test("employees core owner counts exclude deactivated/tombstoned owners", () => {
  const s = src("lib/employees/core.ts");
  const ownerCountBlocks = s.match(/db\.user\.count\(\{\s*where:\s*\{[^}]*isOwner:\s*true[^}]*\}/g) ?? [];
  assert.ok(ownerCountBlocks.length >= 2, "expected owner-count queries in toggleEmployeeActive and deleteEmployee");
  for (const block of ownerCountBlocks) {
    assert.match(block, /deactivatedAt:\s*null/);
    assert.match(block, /deletedAt:\s*null/);
  }
});
