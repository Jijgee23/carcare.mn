import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";

// P7-B2 — staff feedback extraction (lib/feedback-staff.ts). Pure-function
// coverage for the parts that don't need a real Prisma client (validation,
// DTO shaping), plus source-pattern checks mirroring
// tests/employees-routes.test.ts / tests/reports-routes.test.ts:
//   - the web action file delegates to lib/feedback-staff.ts instead of
//     reimplementing the Prisma calls it used to make inline;
//   - the reopen rule (RESOLVED/DISMISSED -> IN_REVIEW on reply) lives in
//     the core, keyed off the two statuses, not re-derived per caller;
//   - replies are always authored "SUBMITTER" — the core never accepts an
//     author/status from its caller.

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

function src(relPath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relPath), "utf8");
}

let parseStaffFeedbackInput: typeof import("../lib/feedback-staff").parseStaffFeedbackInput;
let toFeedbackDto: typeof import("../lib/feedback-staff").toFeedbackDto;
let toFeedbackMessageDto: typeof import("../lib/feedback-staff").toFeedbackMessageDto;

before(async () => {
  ({ parseStaffFeedbackInput, toFeedbackDto, toFeedbackMessageDto } = await import("../lib/feedback-staff"));
});

// --- parseStaffFeedbackInput -------------------------------------------------

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

test("parseStaffFeedbackInput rejects an unknown type", () => {
  assert.equal(parseStaffFeedbackInput(fd({ type: "NOT_A_TYPE", message: "12345" })), null);
});

test("parseStaffFeedbackInput rejects a message under 5 chars", () => {
  assert.equal(parseStaffFeedbackInput(fd({ type: "BUG", message: "abcd" })), null);
});

test("parseStaffFeedbackInput rejects a message over 2000 chars", () => {
  assert.equal(parseStaffFeedbackInput(fd({ type: "BUG", message: "a".repeat(2001) })), null);
});

test("parseStaffFeedbackInput accepts a valid BUG report and trims/truncates pageUrl/userAgent", () => {
  const long = "x".repeat(600);
  const out = parseStaffFeedbackInput(
    fd({ type: "BUG", message: "  something is broken  ", pageUrl: long, userAgent: long }),
  );
  assert.ok(out);
  assert.equal(out!.type, "BUG");
  assert.equal(out!.message, "something is broken");
  assert.equal(out!.pageUrl.length, 500);
  assert.equal(out!.userAgent.length, 500);
});

for (const type of ["BUG", "SUGGESTION", "OTHER"]) {
  test(`parseStaffFeedbackInput accepts type ${type}`, () => {
    const out = parseStaffFeedbackInput(fd({ type, message: "valid message" }));
    assert.ok(out);
    assert.equal(out!.type, type);
  });
}

// --- DTO shaping -------------------------------------------------------------

test("toFeedbackDto excludes tenantId/userId/accountId (no cross-tenant leakage in the API shape)", () => {
  const dto = toFeedbackDto({
    id: "f1",
    tenantId: "t1",
    userId: "u1",
    accountId: null,
    type: "BUG",
    message: "m",
    screenshotUrl: null,
    pageUrl: null,
    userAgent: null,
    status: "NEW",
    adminNote: null,
    resolvedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  assert.deepEqual(Object.keys(dto).sort(), [
    "adminNote",
    "createdAt",
    "id",
    "message",
    "pageUrl",
    "resolvedAt",
    "screenshotUrl",
    "status",
    "type",
  ]);
  assert.equal(dto.createdAt, "2026-01-01T00:00:00.000Z");
});

test("toFeedbackMessageDto shapes id/author/message/createdAt only", () => {
  const dto = toFeedbackMessageDto({
    id: "m1",
    feedbackId: "f1",
    tenantId: "t1",
    author: "SUBMITTER",
    message: "hello",
    createdAt: new Date("2026-01-02T00:00:00Z"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  assert.deepEqual(dto, {
    id: "m1",
    author: "SUBMITTER",
    message: "hello",
    createdAt: "2026-01-02T00:00:00.000Z",
  });
});

// --- source-pattern: web action delegates to the core ------------------------

test("app/_actions/feedback.ts delegates staff submit/reply to lib/feedback-staff instead of reimplementing them", () => {
  const source = src("../app/_actions/feedback.ts");
  assert.match(source, /from "@\/lib\/feedback-staff"/);
  assert.match(source, /createStaffFeedback\(/);
  assert.match(source, /addStaffFeedbackReply\(/);

  const submitFn = source.slice(
    source.indexOf("export async function submitStaffFeedback"),
    source.indexOf("export async function submitAccountFeedback"),
  );
  assert.doesNotMatch(submitFn, /prisma\.feedback\.create/, "submitStaffFeedback must not reimplement the Prisma create");

  const replyFn = source.slice(source.indexOf("export async function addSubmitterFeedbackReply"));
  assert.doesNotMatch(replyFn, /prisma\.feedbackMessage\.create/, "addSubmitterFeedbackReply must not reimplement the Prisma create");
  assert.doesNotMatch(
    replyFn.replace(/\n/g, " "),
    /RESOLVED.*DISMISSED|DISMISSED.*RESOLVED/,
    "the reopen rule must live in the core, not be re-derived in the action",
  );
});

test("lib/feedback-staff.ts owns the reopen rule (RESOLVED/DISMISSED -> IN_REVIEW)", () => {
  const source = src("../lib/feedback-staff.ts");
  assert.match(source, /RESOLVED/);
  assert.match(source, /DISMISSED/);
  assert.match(source, /IN_REVIEW/);
});

test("addStaffFeedbackReply always authors SUBMITTER and never reads a caller-supplied author/status", () => {
  const source = src("../lib/feedback-staff.ts");
  const fn = source.slice(
    source.indexOf("export async function addStaffFeedbackReply"),
    source.indexOf("export async function getStaffFeedbackWithThread"),
  );
  assert.match(fn, /author:\s*"SUBMITTER"/);
  assert.doesNotMatch(fn, /author:\s*body\.|author:\s*actor\.|status:\s*body\./);
});

test("createStaffFeedback and listStaffFeedback/getStaffFeedbackWithThread scope every query by actor.tenantId", () => {
  const source = src("../lib/feedback-staff.ts");
  assert.match(source, /tenantId:\s*actor\.tenantId/);
  // findFirst (not findUnique) enforces tenant scoping for the by-id lookups.
  assert.match(source, /findFirst\(\{\s*\n\s*where:\s*\{\s*id,\s*tenantId:\s*actor\.tenantId/);
});
