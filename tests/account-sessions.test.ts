import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";

// P8-B0 — unified session core (lib/account/sessions.ts), extracted from
// `app/_actions/sessions.ts` and the inline queries in
// `app/dashboard/profile/page.tsx`. Covers D-178 (unified list, chain
// dedupe, no tokenHash), foreign-id scoping (404-equivalent), and the
// web-action/page delegation.

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

let listAccountSessions: typeof import("../lib/account/sessions").listAccountSessions;
let revokeAccountSession: typeof import("../lib/account/sessions").revokeAccountSession;
let revokeOtherAccountSessions: typeof import("../lib/account/sessions").revokeOtherAccountSessions;

before(async () => {
  ({ listAccountSessions, revokeAccountSession, revokeOtherAccountSessions } = await import(
    "../lib/account/sessions"
  ));
});

function src(relPath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relPath), "utf8");
}

type Row = {
  id: string;
  userId: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastSeenAt?: Date;
  lastUsedAt?: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById?: string | null;
};

function row(id: string, userId: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    userId,
    userAgent: "Mozilla/5.0 Chrome/1 Windows",
    ip: "1.2.3.4",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-02T00:00:00Z"),
    lastUsedAt: new Date("2026-01-02T00:00:00Z"),
    expiresAt: new Date("2099-01-01T00:00:00Z"),
    revokedAt: null,
    replacedById: null,
    ...overrides,
  };
}

function matchesWhere(r: Row, where: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (k === "OR") {
      const clauses = v as Record<string, unknown>[];
      if (!clauses.some((c) => matchesWhere(r, c))) return false;
      continue;
    }
    const actual = (r as Record<string, unknown>)[k];
    if (v !== null && typeof v === "object") {
      const cond = v as Record<string, unknown>;
      if ("gt" in cond && !(actual instanceof Date && actual.getTime() > (cond.gt as Date).getTime())) return false;
      if ("lte" in cond && !(actual instanceof Date && actual.getTime() <= (cond.lte as Date).getTime())) return false;
      if ("not" in cond && actual === cond.not) return false;
      if ("in" in cond && !(cond.in as unknown[]).includes(actual)) return false;
      continue;
    }
    if (actual !== v) return false;
  }
  return true;
}

function makeTable(rows: Row[], sortKey: "lastSeenAt" | "lastUsedAt") {
  return {
    async findMany({ where, take }: { where: Record<string, unknown>; take?: number }) {
      let out = rows.filter((r) => matchesWhere(r, where));
      out = out.sort((a, b) => (b[sortKey]?.getTime() ?? 0) - (a[sortKey]?.getTime() ?? 0));
      if (take != null) out = out.slice(0, take);
      return out.map((r) => ({ ...r }));
    },
    async findUnique({ where }: { where: { id: string } }) {
      const r = rows.find((x) => x.id === where.id);
      return r ? { ...r } : null;
    },
    async count({ where }: { where: Record<string, unknown> }) {
      return rows.filter((r) => matchesWhere(r, where)).length;
    },
    async updateMany({ where, data }: { where: Record<string, unknown>; data: { revokedAt: Date } }) {
      let count = 0;
      for (const r of rows) {
        if (matchesWhere(r, where)) {
          r.revokedAt = data.revokedAt;
          count++;
        }
      }
      return { count };
    },
  };
}

function makeFakeDb(sessions: Row[], tokens: Row[]) {
  const db = {
    user: { update: async () => ({}) },
    userSession: makeTable(sessions, "lastSeenAt"),
    refreshToken: makeTable(tokens, "lastUsedAt"),
    async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
      return fn(db);
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db as any;
}

// --- listAccountSessions: unified shape, dedupe, no tokenHash ----------------

test("listAccountSessions merges UserSession (web) and RefreshToken (mobile) rows, tagged by source", async () => {
  const sessions = [row("s1", "u1")];
  const tokens = [row("t1", "u1")];
  const db = makeFakeDb(sessions, tokens);
  const result = await listAccountSessions(db, "u1");
  const sources = result.active.map((s) => s.source).sort();
  assert.deepEqual(sources, ["mobile", "web"]);
});

test("listAccountSessions excludes RefreshToken rows that have been rotated (replacedById set)", async () => {
  const tokens = [
    row("t-old", "u1", { replacedById: "t-new" }),
    row("t-new", "u1", { replacedById: null }),
  ];
  const db = makeFakeDb([], tokens);
  const result = await listAccountSessions(db, "u1");
  assert.deepEqual(result.active.map((s) => s.id), ["t-new"]);
});

test("listAccountSessions never exposes tokenHash (or any raw-secret field) on a row", async () => {
  const tokens = [
    { ...row("t1", "u1"), tokenHash: "super-secret-hash" } as Row & { tokenHash: string },
  ];
  const db = makeFakeDb([], tokens);
  const result = await listAccountSessions(db, "u1");
  assert.equal(result.active.length, 1);
  assert.ok(!("tokenHash" in result.active[0]));
});

test("listAccountSessions marks `current` from currentSessionId/currentRefreshTokenId", async () => {
  const sessions = [row("s1", "u1"), row("s2", "u1")];
  const tokens = [row("t1", "u1")];
  const db = makeFakeDb(sessions, tokens);
  const result = await listAccountSessions(db, "u1", { currentSessionId: "s1", currentRefreshTokenId: "t1" });
  const byId = Object.fromEntries(result.active.map((s) => [s.id, s.current]));
  assert.equal(byId.s1, true);
  assert.equal(byId.s2, false);
  assert.equal(byId.t1, true);
  assert.equal(result.otherActiveCount, 1);
});

test("listAccountSessions splits active vs ended (revoked or expired) and paginates ended across both sources", async () => {
  const now = Date.now();
  const sessions = [
    row("s-active", "u1"),
    row("s-revoked", "u1", { revokedAt: new Date() }),
  ];
  const tokens = [
    row("t-expired", "u1", { expiresAt: new Date(now - 1000) }),
  ];
  const db = makeFakeDb(sessions, tokens);
  const result = await listAccountSessions(db, "u1", { pagination: { skip: 0, take: 10 } });
  assert.deepEqual(result.active.map((s) => s.id), ["s-active"]);
  assert.equal(result.endedTotal, 2);
  assert.deepEqual(result.ended.map((s) => s.id).sort(), ["s-revoked", "t-expired"]);
});

test("listAccountSessions scopes strictly by userId — another user's rows never appear", async () => {
  const sessions = [row("s-mine", "u1"), row("s-foreign", "u2")];
  const db = makeFakeDb(sessions, []);
  const result = await listAccountSessions(db, "u1");
  assert.deepEqual(result.active.map((s) => s.id), ["s-mine"]);
});

// --- revokeAccountSession: foreign-id scoping ---------------------------------

test("revokeAccountSession revokes a row the caller owns", async () => {
  const sessions = [row("s1", "u1")];
  const db = makeFakeDb(sessions, []);
  const result = await revokeAccountSession(db, "u1", "web", "s1");
  assert.deepEqual(result, { ok: true });
  assert.notEqual(sessions[0].revokedAt, null);
});

test("revokeAccountSession returns not_found for a row belonging to another user (never revokes it)", async () => {
  const sessions = [row("s1", "u2")];
  const db = makeFakeDb(sessions, []);
  const result = await revokeAccountSession(db, "u1", "web", "s1");
  assert.deepEqual(result, { ok: false, reason: "not_found" });
  assert.equal(sessions[0].revokedAt, null, "foreign row must stay untouched");
});

test("revokeAccountSession returns not_found for an id that does not exist, and for an empty id", async () => {
  const db = makeFakeDb([], []);
  assert.deepEqual(await revokeAccountSession(db, "u1", "web", "nope"), { ok: false, reason: "not_found" });
  assert.deepEqual(await revokeAccountSession(db, "u1", "web", ""), { ok: false, reason: "not_found" });
});

test("revokeAccountSession works for the mobile source (RefreshToken)", async () => {
  const tokens = [row("t1", "u1")];
  const db = makeFakeDb([], tokens);
  const result = await revokeAccountSession(db, "u1", "mobile", "t1");
  assert.deepEqual(result, { ok: true });
  assert.notEqual(tokens[0].revokedAt, null);
});

// --- revokeOtherAccountSessions: both tables, current kept --------------------

test("revokeOtherAccountSessions revokes other sessions AND tokens, keeping only the current ids", async () => {
  const sessions = [row("s-current", "u1"), row("s-other", "u1")];
  const tokens = [row("t-current", "u1"), row("t-other", "u1")];
  const db = makeFakeDb(sessions, tokens);
  const result = await revokeOtherAccountSessions(db, "u1", {
    currentSessionId: "s-current",
    currentRefreshTokenId: "t-current",
  });
  assert.equal(result.webRevoked, 1);
  assert.equal(result.mobileRevoked, 1);
  assert.equal(sessions.find((s) => s.id === "s-current")!.revokedAt, null);
  assert.notEqual(sessions.find((s) => s.id === "s-other")!.revokedAt, null);
});

// --- source-pattern: web action + page delegate to the core -------------------

test("app/_actions/sessions.ts delegates to lib/account/sessions instead of reimplementing revoke logic", () => {
  const source = src("../app/_actions/sessions.ts");
  assert.match(source, /from "@\/lib\/account\/sessions"/);
  assert.match(source, /revokeAccountSession\(/);
  assert.match(source, /revokeOtherAccountSessions\(/);
  assert.doesNotMatch(source, /prisma\.userSession\.updateMany|prisma\.refreshToken\.updateMany/);
});

test("app/dashboard/profile/page.tsx delegates its session list to lib/account/sessions instead of inline Prisma queries", () => {
  const source = src("../app/dashboard/profile/page.tsx");
  assert.match(source, /from "@\/lib\/account\/sessions"/);
  assert.match(source, /listAccountSessions\(/);
  assert.doesNotMatch(source, /prisma\.userSession\.findMany/, "must not reimplement the session query inline");
});

test("lib/account/sessions.ts has no framework imports (use server/redirect/cookies)", () => {
  const source = src("../lib/account/sessions.ts");
  assert.doesNotMatch(source, /^"use server";/m);
  assert.doesNotMatch(source, /^import.*(next\/navigation|next\/cache)/m);
});
