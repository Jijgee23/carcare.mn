import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";

// P8-B0 — password core (lib/account/password.ts), extracted from
// `app/_actions/profile.ts`'s `changePasswordAction`. Covers current-password
// verification, reuse rejection, D-179 revocation-on-success, and D-181
// rate-limiting of failed current-password attempts (shared `consumeRateLimit`
// primitive, in-memory — each test uses a distinct actor id so the 5/15min
// bucket never leaks between tests).

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

let changePassword: typeof import("../lib/account/password").changePassword;
let hashPassword: typeof import("../lib/auth/password").hashPassword;

before(async () => {
  [{ changePassword }, { hashPassword }] = await Promise.all([
    import("../lib/account/password"),
    import("../lib/auth/password"),
  ]);
});

function src(relPath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relPath), "utf8");
}

type FakeSession = { id: string; userId: string; revokedAt: Date | null };
type FakeToken = { id: string; userId: string; revokedAt: Date | null };

function makeFakeDb(seed: { sessions?: FakeSession[]; tokens?: FakeToken[] } = {}) {
  const sessions = seed.sessions ?? [];
  const tokens = seed.tokens ?? [];
  let newHash: string | null = null;

  const db = {
    user: {
      async update({ data }: { data: { passwordHash: string } }) {
        newHash = data.passwordHash;
        return {};
      },
    },
    userSession: {
      findMany: async () => sessions,
      findUnique: async () => null,
      count: async () => sessions.length,
      async updateMany({ where }: { where: { userId: string; revokedAt: null; id?: { not: string } } }) {
        let count = 0;
        for (const s of sessions) {
          if (s.userId !== where.userId) continue;
          if (s.revokedAt !== null) continue;
          if (where.id && s.id === where.id.not) continue;
          s.revokedAt = new Date();
          count++;
        }
        return { count };
      },
    },
    refreshToken: {
      findMany: async () => tokens,
      findUnique: async () => null,
      count: async () => tokens.length,
      async updateMany({ where }: { where: { userId: string; revokedAt: null; id?: { not: string } } }) {
        let count = 0;
        for (const t of tokens) {
          if (t.userId !== where.userId) continue;
          if (t.revokedAt !== null) continue;
          if (where.id && t.id === where.id.not) continue;
          t.revokedAt = new Date();
          count++;
        }
        return { count };
      },
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
      return fn(db);
    },
    _sessions: sessions,
    _tokens: tokens,
    _getNewHash: () => newHash,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db as any;
}

let actorSeq = 0;
async function actorWith(password: string) {
  actorSeq += 1;
  return { id: `pw-actor-${actorSeq}`, tenantId: "t1", passwordHash: await hashPassword(password) };
}

// --- field validation ---------------------------------------------------------

test("changePassword rejects an empty current password without touching the DB", async () => {
  const actor = await actorWith("correct-horse");
  const db = makeFakeDb();
  const result = await changePassword(db, actor, {
    currentPassword: "",
    newPassword: "newpassword1",
    confirmPassword: "newpassword1",
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.fieldErrors?.currentPassword);
});

test("changePassword rejects a new password under 8 chars and a mismatched confirm", async () => {
  const actor = await actorWith("correct-horse");
  const db = makeFakeDb();
  const result = await changePassword(db, actor, {
    currentPassword: "correct-horse",
    newPassword: "short",
    confirmPassword: "other",
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.fieldErrors?.newPassword);
  assert.ok(!result.ok && result.fieldErrors?.confirmPassword);
});

// --- current-password / reuse rules -------------------------------------------

test("changePassword rejects a wrong current password with a field error (first few attempts)", async () => {
  const actor = await actorWith("correct-horse");
  const db = makeFakeDb();
  const result = await changePassword(db, actor, {
    currentPassword: "wrong-password",
    newPassword: "newpassword1",
    confirmPassword: "newpassword1",
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.fieldErrors?.currentPassword === "Одоогийн нууц үг буруу.");
  assert.equal(db._getNewHash(), null, "must not touch the hash on a failed attempt");
});

test("changePassword rejects reusing the current password as the new one", async () => {
  const actor = await actorWith("correct-horse");
  const db = makeFakeDb();
  const result = await changePassword(db, actor, {
    currentPassword: "correct-horse",
    newPassword: "correct-horse",
    confirmPassword: "correct-horse",
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.fieldErrors?.newPassword === "Шинэ нууц үг өмнөхөөс өөр байх ёстой.");
});

test("changePassword succeeds with a correct current password and a fresh new one", async () => {
  const actor = await actorWith("correct-horse");
  const db = makeFakeDb();
  const result = await changePassword(db, actor, {
    currentPassword: "correct-horse",
    newPassword: "newpassword1",
    confirmPassword: "newpassword1",
  });
  assert.equal(result.ok, true);
  assert.ok(db._getNewHash());
});

test("changePassword on an unactivated account (no passwordHash) returns a plain message, no crash", async () => {
  const actor = { id: "pw-noactivate", tenantId: "t1", passwordHash: null };
  const db = makeFakeDb();
  const result = await changePassword(db, actor, {
    currentPassword: "anything",
    newPassword: "newpassword1",
    confirmPassword: "newpassword1",
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && /идэвхжээгүй/.test(result.message ?? ""));
});

// --- D-179: revocation on success ---------------------------------------------

test("changePassword revokes all OTHER active sessions/tokens but keeps the current ones (D-179)", async () => {
  const actor = await actorWith("correct-horse");
  const sessions: FakeSession[] = [
    { id: "sess-current", userId: actor.id, revokedAt: null },
    { id: "sess-other", userId: actor.id, revokedAt: null },
    { id: "sess-foreign", userId: "someone-else", revokedAt: null },
  ];
  const tokens: FakeToken[] = [
    { id: "tok-current", userId: actor.id, revokedAt: null },
    { id: "tok-other", userId: actor.id, revokedAt: null },
  ];
  const db = makeFakeDb({ sessions, tokens });

  const result = await changePassword(
    db,
    actor,
    { currentPassword: "correct-horse", newPassword: "newpassword1", confirmPassword: "newpassword1" },
    { currentSessionId: "sess-current", currentRefreshTokenId: "tok-current" },
  );

  assert.equal(result.ok, true);
  assert.equal(sessions.find((s) => s.id === "sess-current")!.revokedAt, null, "current session kept");
  assert.notEqual(sessions.find((s) => s.id === "sess-other")!.revokedAt, null, "other session revoked");
  assert.equal(sessions.find((s) => s.id === "sess-foreign")!.revokedAt, null, "foreign user's session untouched");
  assert.equal(tokens.find((t) => t.id === "tok-current")!.revokedAt, null, "current token kept");
  assert.notEqual(tokens.find((t) => t.id === "tok-other")!.revokedAt, null, "other token revoked");
});

test("changePassword revokes ALL other sessions/tokens when no current id is given", async () => {
  const actor = await actorWith("correct-horse");
  const sessions: FakeSession[] = [{ id: "sess-a", userId: actor.id, revokedAt: null }];
  const db = makeFakeDb({ sessions });
  const result = await changePassword(db, actor, {
    currentPassword: "correct-horse",
    newPassword: "newpassword1",
    confirmPassword: "newpassword1",
  });
  assert.equal(result.ok, true);
  assert.notEqual(sessions[0].revokedAt, null);
});

// --- D-181: rate limit on failed current-password attempts --------------------

test("changePassword rate-limits after 5 failed current-password attempts, then blocks with RATE_LIMITED", async () => {
  const actor = await actorWith("correct-horse");
  const db = makeFakeDb();
  const attempt = () =>
    changePassword(db, actor, {
      currentPassword: "wrong-password",
      newPassword: "newpassword1",
      confirmPassword: "newpassword1",
    });

  for (let i = 0; i < 5; i++) {
    const r = await attempt();
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.fieldErrors?.currentPassword, `attempt ${i + 1} should be a plain wrong-password error`);
  }

  const sixth = await attempt();
  assert.equal(sixth.ok, false);
  assert.ok(!sixth.ok && sixth.code === "RATE_LIMITED", "6th failed attempt must be rate-limited");
  assert.ok(!sixth.ok && sixth.message);
});

test("changePassword does not consume the rate-limit budget on a successful attempt", async () => {
  const actor = await actorWith("correct-horse");
  const db = makeFakeDb();
  // 4 failures, then a success — the budget should not have been spent on
  // the success, so a 5th failure afterwards must still be a plain error.
  for (let i = 0; i < 4; i++) {
    await changePassword(db, actor, {
      currentPassword: "wrong-password",
      newPassword: "newpassword1",
      confirmPassword: "newpassword1",
    });
  }
  const success = await changePassword(db, actor, {
    currentPassword: "correct-horse",
    newPassword: "another-new-pass",
    confirmPassword: "another-new-pass",
  });
  assert.equal(success.ok, true);
});

// --- source-pattern: web action delegates to the core -------------------------

test("app/_actions/profile.ts delegates changePasswordAction to lib/account/password instead of reimplementing it", () => {
  const source = src("../app/_actions/profile.ts");
  assert.match(source, /from "@\/lib\/account\/password"/);
  assert.match(source, /changePassword\(/);
  const fn = source.slice(source.indexOf("export async function changePasswordAction"));
  assert.doesNotMatch(fn, /verifyPassword\(/, "changePasswordAction must not reimplement password verification");
  assert.doesNotMatch(fn, /hashPassword\(/, "changePasswordAction must not reimplement the hash update");
  assert.match(fn, /logAudit\(/, "changePasswordAction must still log the audit entry after a successful core call");
});

test("lib/account/password.ts has no framework imports (use server/logAudit) and no JWT/access-token code", () => {
  const source = src("../lib/account/password.ts");
  assert.doesNotMatch(source, /^"use server";/m);
  assert.doesNotMatch(source, /^import.*logAudit/m);
  assert.doesNotMatch(
    source,
    /^import.*(jose|jsonwebtoken|signSession|verifySession)/im,
    "must not touch JWT/access-token code (out of scope for P8-B0)",
  );
});
