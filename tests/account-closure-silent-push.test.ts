import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";

// Silent (data-only) push on account/user closure — verifies the FCM
// message shape (no `notification`, background/content-available headers)
// behaviourally via the exported pure builder, and verifies the four
// closure functions read tokens before `$transaction` and notify after it
// via source-pattern checks (same style as tests/account-closure-routes.test.ts
// and tests/customer-broadcast.test.ts — these modules pull in Prisma/Firebase
// admin at import time so a live import isn't worth the setup here).

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

function src(relPath: string): string {
  return readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), relPath),
    "utf8",
  );
}

let push: typeof import("../lib/push");

before(async () => {
  push = await import("../lib/push");
});

// --- buildSilentMessage shape ------------------------------------------

test("buildSilentMessage has no notification key", () => {
  const msg = push.buildSilentMessage(["tok1"], { type: "account_closed", reason: "deleted" });
  assert.equal((msg as Record<string, unknown>).notification, undefined);
  assert.deepEqual(msg.data, { type: "account_closed", reason: "deleted" });
  assert.deepEqual(msg.tokens, ["tok1"]);
});

test("buildSilentMessage sets android high priority", () => {
  const msg = push.buildSilentMessage(["tok1"], { type: "account_closed", reason: "deactivated" });
  assert.deepEqual(msg.android, { priority: "high" });
});

test("buildSilentMessage sets APNs background push-type and content-available", () => {
  const msg = push.buildSilentMessage(["tok1"], { type: "account_closed", reason: "deleted" });
  assert.deepEqual(msg.apns.headers, { "apns-push-type": "background", "apns-priority": "5" });
  assert.deepEqual(msg.apns.payload, { aps: { "content-available": 1 } });
});

test("sendPushToTokens (loud) still builds a message with a notification block — unaffected by the refactor", () => {
  const moduleSource = src("../lib/push.ts");
  const start = moduleSource.indexOf("export async function sendPushToTokens");
  const end = moduleSource.indexOf("export async function sendSilentPushToTokens");
  const section = moduleSource.slice(start, end);
  assert.match(section, /notification:\s*\{\s*title:\s*payload\.title,\s*body:\s*payload\.body\s*\}/);
  assert.match(section, /apns-priority["']?:\s*"10"/);
});

test("sendSilentPushToTokens builds its message via buildSilentMessage, no notification/title/body", () => {
  const moduleSource = src("../lib/push.ts");
  const start = moduleSource.indexOf("export async function sendSilentPushToTokens");
  assert.ok(start >= 0);
  const section = moduleSource.slice(start);
  assert.match(section, /buildSilentMessage\(batch,\s*data\)/);
});

test("sendPushToTokens and sendSilentPushToTokens share the same chunking/retry/stale-cleanup helper", () => {
  const moduleSource = src("../lib/push.ts");
  const helperOccurrences = moduleSource.match(/sendMessagesToTokens\(/g) ?? [];
  // one definition + two call sites
  assert.equal(helperOccurrences.length, 3);
  assert.match(moduleSource, /STALE_TOKEN_ERRORS/);
  assert.match(moduleSource, /RETRYABLE_ERRORS/);
});

// --- lib/account-closure/notify.ts --------------------------------------

test("notifyAccountClosed sends the exact account_closed contract and swallows errors", () => {
  const s = src("../lib/account-closure/notify.ts");
  assert.match(s, /sendSilentPushToTokens\(tokens,\s*\{\s*type:\s*"account_closed",\s*reason\s*\}\)/);
  assert.match(s, /try\s*\{[\s\S]*catch\s*\(err\)\s*\{/);
  assert.doesNotMatch(s, /catch[\s\S]*\bthrow\b/, "the catch block must not rethrow");
});

// --- the four closure functions: read tokens before $transaction, notify after ---

function assertReadsBeforeNotifiesAfterTransaction(
  moduleSource: string,
  fnName: string,
  tokenGetter: RegExp,
  expectedReason: "deleted" | "deactivated",
) {
  const start = moduleSource.indexOf(`export async function ${fnName}`);
  assert.ok(start >= 0, `expected to find ${fnName}`);
  const nextExportIdx = moduleSource.indexOf("\nexport ", start + 10);
  const body = moduleSource.slice(start, nextExportIdx >= 0 ? nextExportIdx : undefined);

  const tokensIdx = body.search(tokenGetter);
  const transactionIdx = body.indexOf("$transaction");
  const notifyIdx = body.indexOf("notifyAccountClosed(");

  assert.ok(tokensIdx >= 0, `${fnName} must read tokens`);
  assert.ok(transactionIdx > tokensIdx, `${fnName} must read tokens before $transaction`);
  assert.ok(notifyIdx > transactionIdx, `${fnName} must notify after $transaction`);
  assert.match(
    body.slice(notifyIdx),
    new RegExp(`notifyAccountClosed\\(tokens,\\s*"${expectedReason}"\\)`),
    `${fnName} must notify with reason "${expectedReason}"`,
  );
}

test("deactivateAccount reads account tokens before the transaction and notifies 'deactivated' after", () => {
  const s = src("../lib/account-closure/customer.ts");
  assertReadsBeforeNotifiesAfterTransaction(
    s,
    "deactivateAccount",
    /getFirebaseTokensForAccount\(accountId\)/,
    "deactivated",
  );
});

test("deleteAccount reads account tokens before the transaction and notifies 'deleted' after", () => {
  const s = src("../lib/account-closure/customer.ts");
  assertReadsBeforeNotifiesAfterTransaction(
    s,
    "deleteAccount",
    /getFirebaseTokensForAccount\(accountId\)/,
    "deleted",
  );
});

test("deactivateStaffUser reads user tokens before the transaction and notifies 'deactivated' after", () => {
  const s = src("../lib/account-closure/staff.ts");
  assertReadsBeforeNotifiesAfterTransaction(
    s,
    "deactivateStaffUser",
    /getFirebaseTokensForUser\(userId\)/,
    "deactivated",
  );
});

test("deleteStaffUser reads user tokens before the transaction and notifies 'deleted' after", () => {
  const s = src("../lib/account-closure/staff.ts");
  assertReadsBeforeNotifiesAfterTransaction(
    s,
    "deleteStaffUser",
    /getFirebaseTokensForUser\(userId\)/,
    "deleted",
  );
});

test("staff closure functions call assertNotLastOwner before reading tokens or notifying", () => {
  const s = src("../lib/account-closure/staff.ts");
  for (const fnName of ["deactivateStaffUser", "deleteStaffUser"]) {
    const start = s.indexOf(`export async function ${fnName}`);
    const nextExportIdx = s.indexOf("\nexport ", start + 10);
    const body = s.slice(start, nextExportIdx >= 0 ? nextExportIdx : undefined);
    const assertIdx = body.indexOf("assertNotLastOwner(userId)");
    const tokensIdx = body.indexOf("getFirebaseTokensForUser(userId)");
    assert.ok(assertIdx >= 0 && tokensIdx > assertIdx, `${fnName} must check assertNotLastOwner before reading tokens`);
  }
});
