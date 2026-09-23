import assert from "node:assert/strict";
import { before, test } from "node:test";

// P7-B0 — `parseRange`/`fmt`/`validateReportRangeParams` moved to
// `lib/reports.ts`. Unlike the employees/schedule routes, this module has no
// "server-only" import barrier (verified: it only reaches `lib/prisma.ts`,
// which does not import "server-only"), so it can be imported directly.

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

let fmt: typeof import("../lib/reports").fmt;
let parseRange: typeof import("../lib/reports").parseRange;
let validateReportRangeParams: typeof import("../lib/reports").validateReportRangeParams;
let MAX_REPORT_RANGE_DAYS: typeof import("../lib/reports").MAX_REPORT_RANGE_DAYS;

before(async () => {
  ({ fmt, parseRange, validateReportRangeParams, MAX_REPORT_RANGE_DAYS } = await import(
    "../lib/reports"
  ));
});

// --- fmt: local-date semantics (UTC+8 edge — must not slip a day via UTC)

test("fmt formats using local getFullYear/getMonth/getDate, not toISOString", () => {
  // 2026-01-01T00:30:00 local time. In UTC+8 this is 2025-12-31T16:30:00Z —
  // if fmt used toISOString() this would wrongly format as 2025-12-31.
  const d = new Date(2026, 0, 1, 0, 30, 0);
  assert.equal(fmt(d), "2026-01-01");
});

test("fmt zero-pads month and day", () => {
  const d = new Date(2026, 8, 5); // September 5 — month index 8
  assert.equal(fmt(d), "2026-09-05");
});

// --- parseRange

test("parseRange defaults to this-month when no params given", () => {
  const range = parseRange({});
  assert.equal(range.key, "this-month");
  const now = new Date();
  assert.equal(range.from.getDate(), 1);
  assert.equal(range.from.getMonth(), now.getMonth());
});

test("parseRange builds a custom range from from/to, end-of-day inclusive on `to`", () => {
  const range = parseRange({ from: "2026-01-01", to: "2026-01-31" });
  assert.equal(range.key, "custom");
  assert.equal(fmt(range.from), "2026-01-01");
  assert.equal(fmt(range.to), "2026-01-31");
  assert.equal(range.to.getHours(), 23);
  assert.equal(range.to.getMinutes(), 59);
});

test("parseRange treats either from-only or to-only as custom", () => {
  assert.equal(parseRange({ from: "2026-01-01" }).key, "custom");
  assert.equal(parseRange({ to: "2026-01-31" }).key, "custom");
});

// --- validateReportRangeParams

test("validateReportRangeParams accepts absent from/to", () => {
  assert.equal(validateReportRangeParams({}), null);
  assert.equal(validateReportRangeParams({ from: null, to: null }), null);
});

test("validateReportRangeParams accepts a valid from<=to pair", () => {
  assert.equal(validateReportRangeParams({ from: "2026-01-01", to: "2026-01-31" }), null);
  assert.equal(validateReportRangeParams({ from: "2026-01-01", to: "2026-01-01" }), null);
});

test("validateReportRangeParams rejects a malformed date", () => {
  const err = validateReportRangeParams({ from: "2026/01/01", to: "2026-01-31" });
  assert.ok(err);
  assert.equal(err!.field, "from");
});

test("validateReportRangeParams rejects from > to", () => {
  const err = validateReportRangeParams({ from: "2026-02-01", to: "2026-01-01" });
  assert.ok(err);
  assert.equal(err!.field, "to");
});

test(`validateReportRangeParams rejects a span over ${"MAX_REPORT_RANGE_DAYS"}`, () => {
  const err = validateReportRangeParams({ from: "2025-01-01", to: "2026-06-01" });
  assert.ok(err);
  assert.equal(err!.field, "to");
});

test("validateReportRangeParams accepts a span exactly at the max", () => {
  // MAX_REPORT_RANGE_DAYS days inclusive, starting 2026-01-01.
  const to = new Date(2026, 0, 1 + (MAX_REPORT_RANGE_DAYS - 1));
  const toStr = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(
    to.getDate(),
  ).padStart(2, "0")}`;
  assert.equal(validateReportRangeParams({ from: "2026-01-01", to: toStr }), null);
});

test("validateReportRangeParams rejects one span-day over the max", () => {
  const to = new Date(2026, 0, 1 + MAX_REPORT_RANGE_DAYS);
  const toStr = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(
    to.getDate(),
  ).padStart(2, "0")}`;
  const err = validateReportRangeParams({ from: "2026-01-01", to: toStr });
  assert.ok(err);
});
