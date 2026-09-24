import assert from "node:assert/strict";
import { before, test } from "node:test";

// Web hardening S1. The staff API access JWT and the web session JWT can
// share a secret (API_TOKEN_SECRET falls back to SESSION_SECRET), so they are
// separated by a signing tag. A web session without `sid` cannot be checked
// for revocation and is refused. Cron secrets compare in constant time.

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";
delete process.env.API_TOKEN_SECRET;

let apiToken: typeof import("../lib/auth/api-token");
let session: typeof import("../lib/auth/session");
let cron: typeof import("../lib/cron-auth");

before(async () => {
  [apiToken, session, cron] = await Promise.all([
    import("../lib/auth/api-token"),
    import("../lib/auth/session"),
    import("../lib/cron-auth"),
  ]);
});

test("an API access token is not accepted as a web session", async () => {
  const token = await apiToken.signApiToken({ userId: "u1", tenantId: "t1", isOwner: true });
  assert.ok(await apiToken.verifyApiToken(token), "sanity: verifies as an API token");
  assert.equal(await session.verifySession(token), null);
});

test("a web session is not accepted as an API access token", async () => {
  const token = await session.signSession({ userId: "u1", tenantId: "t1", isOwner: true, sid: "s1" });
  assert.ok(await session.verifySession(token), "sanity: verifies as a session");
  assert.equal(await apiToken.verifyApiToken(token), null);
});

test("a web session without sid is refused", async () => {
  const token = await session.signSession({ userId: "u1", tenantId: "t1", isOwner: false });
  assert.equal(await session.verifySession(token), null);
});

test("a web session with sid round-trips it", async () => {
  const token = await session.signSession({ userId: "u1", tenantId: "t1", isOwner: false, sid: "s1" });
  assert.equal((await session.verifySession(token))?.sid, "s1");
});

function cronRequest(auth?: string): Request {
  return new Request("http://localhost/api/cron/x", {
    headers: auth ? { authorization: auth } : {},
  });
}

test("cron secret: correct bearer passes, wrong, shorter, longer or missing is 401", () => {
  process.env.CRON_SECRET = "cron-secret-value";
  assert.equal(cron.verifyCronSecret(cronRequest("Bearer cron-secret-value")), null);
  for (const auth of ["Bearer cron-secret-valuX", "Bearer cron", "Bearer cron-secret-value-extra", undefined]) {
    assert.equal(cron.verifyCronSecret(cronRequest(auth))?.status, 401, String(auth));
  }
});

test("cron secret: unset CRON_SECRET fails closed with 500", () => {
  delete process.env.CRON_SECRET;
  assert.equal(cron.verifyCronSecret(cronRequest("Bearer anything"))?.status, 500);
});
