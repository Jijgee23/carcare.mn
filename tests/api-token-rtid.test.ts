import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";

// P8-B1 / D-180 — the access JWT embeds the RefreshToken id (`refreshTokenId`)
// so `/me/sessions`, password-change and revoke-others can identify "this
// device" without ever seeing the raw refresh token or its hash. Covers the
// sign/verify roundtrip and backward compatibility with tokens issued before
// this claim existed.

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

let signApiToken: typeof import("../lib/auth/api-token").signApiToken;
let verifyApiToken: typeof import("../lib/auth/api-token").verifyApiToken;

before(async () => {
  ({ signApiToken, verifyApiToken } = await import("../lib/auth/api-token"));
});

function src(relPath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relPath), "utf8");
}

test("signApiToken embeds refreshTokenId and verifyApiToken round-trips it", async () => {
  const token = await signApiToken({
    userId: "u1",
    tenantId: "t1",
    isOwner: false,
    refreshTokenId: "rt-123",
  });
  const payload = await verifyApiToken(token);
  assert.ok(payload);
  assert.equal(payload?.refreshTokenId, "rt-123");
  assert.equal(payload?.userId, "u1");
  assert.equal(payload?.tenantId, "t1");
});

test("a token signed without refreshTokenId still verifies, with refreshTokenId null (backward compat)", async () => {
  const token = await signApiToken({
    userId: "u2",
    tenantId: "t2",
    isOwner: true,
  });
  const payload = await verifyApiToken(token);
  assert.ok(payload);
  assert.equal(payload?.refreshTokenId, null);
});

test("a non-string refreshTokenId claim (tampered/odd payload) parses to null, not thrown through", async () => {
  // parse() coerces anything that isn't a string to null — verified via a
  // token signed with an object masquerading as refreshTokenId.
  const token = await signApiToken({
    userId: "u3",
    tenantId: "t3",
    isOwner: false,
    // @ts-expect-error — deliberately wrong shape to exercise parse()'s guard
    refreshTokenId: { not: "a string" },
  });
  const payload = await verifyApiToken(token);
  assert.ok(payload);
  assert.equal(payload?.refreshTokenId, null);
});

test("getApiUserFromRequest exposes refreshTokenId from the verified payload, nullable", () => {
  const source = src("../lib/auth/api-token.ts");
  assert.match(source, /refreshTokenId:\s*payload\.refreshTokenId\s*\?\?\s*null/);
});

test("the access JWT never carries the raw refresh token or its hash — only issueRefreshToken/rotateRefreshToken's returned `id`", () => {
  const apiLogin = src("../lib/auth/api-login.ts");
  const issueIdx = apiLogin.indexOf("issueRefreshToken(");
  const signIdx = apiLogin.indexOf("signApiToken(");
  assert.ok(issueIdx >= 0 && signIdx > issueIdx, "refresh token must be issued before the access token is signed, so its id is available");
  assert.match(apiLogin, /refreshTokenId,/, "signApiToken call must pass refreshTokenId");
  assert.doesNotMatch(apiLogin, /refreshTokenId:\s*refreshToken\b/, "must not sign the raw token in as the id");

  const refreshRoute = src("../app/api/v1/auth/refresh/route.ts");
  assert.match(refreshRoute, /refreshTokenId:\s*result\.id/, "refresh must sign the ROTATED token's own id, not the old one");
});

test("issueRefreshToken and rotateRefreshToken return an `id` distinct from the raw token/hash", () => {
  const source = src("../lib/auth/refresh-token.ts");
  assert.match(source, /id:\s*row\.id,\s*token:\s*raw/);
  assert.match(source, /id:\s*newId,/);
});

test("rotation treats a deliberately revoked token as invalid, not as reuse (D-179 keeps the current device)", () => {
  const source = src("../lib/auth/refresh-token.ts");
  const deliberate = source.indexOf("if (existing.revokedAt && !existing.replacedById)");
  const reuse = source.indexOf("if (existing.revokedAt) {");
  assert.ok(deliberate >= 0, "must short-circuit revoked-but-never-rotated tokens");
  assert.ok(reuse > deliberate, "the revoke-all reuse branch must come after, i.e. only rotated tokens trigger it");
  assert.match(source.slice(deliberate, reuse), /reason: "invalid"/);
});
