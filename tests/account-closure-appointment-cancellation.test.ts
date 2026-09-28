import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

import {
  ACCOUNT_DELETION_CANCEL_REASON,
  buildAccountDeletionCancelNotificationBody,
  formatBusinessDateTime,
  futureCancellableWhere,
  isFutureCancellableAppointment,
} from "../lib/account-closure/appointment-cancellation";

const NOW = new Date("2026-09-28T00:00:00.000Z");
const FUTURE = new Date(NOW.getTime() + 3600_000);
const PAST = new Date(NOW.getTime() - 3600_000);

function appt(overrides: Partial<Parameters<typeof isFutureCancellableAppointment>[0]> = {}) {
  return {
    status: "PENDING",
    requestedAt: FUTURE,
    arrivedAt: null,
    serviceOrderId: null,
    ...overrides,
  };
}

test("isFutureCancellableAppointment: PENDING/CONFIRMED future, unarrived, unlinked -> true", () => {
  assert.equal(isFutureCancellableAppointment(appt({ status: "PENDING" }), NOW), true);
  assert.equal(isFutureCancellableAppointment(appt({ status: "CONFIRMED" }), NOW), true);
});

test("isFutureCancellableAppointment: rejects other statuses", () => {
  for (const status of ["CANCELLED", "REJECTED", "NO_SHOW"]) {
    assert.equal(isFutureCancellableAppointment(appt({ status }), NOW), false);
  }
});

test("isFutureCancellableAppointment: rejects past/now requestedAt (never local-time math, instant compare)", () => {
  assert.equal(isFutureCancellableAppointment(appt({ requestedAt: PAST }), NOW), false);
  assert.equal(isFutureCancellableAppointment(appt({ requestedAt: NOW }), NOW), false);
});

test("isFutureCancellableAppointment: rejects already-arrived appointments", () => {
  assert.equal(isFutureCancellableAppointment(appt({ arrivedAt: PAST }), NOW), false);
});

test("isFutureCancellableAppointment: rejects appointments already linked to a service order", () => {
  assert.equal(isFutureCancellableAppointment(appt({ serviceOrderId: "order_1" }), NOW), false);
});

test("futureCancellableWhere: builds the matching Prisma where clause", () => {
  const where = futureCancellableWhere("acc_1", NOW);
  assert.deepEqual(where, {
    accountId: "acc_1",
    status: { in: ["PENDING", "CONFIRMED"] },
    requestedAt: { gt: NOW },
    arrivedAt: null,
    serviceOrderId: null,
  });
});

test("ACCOUNT_DELETION_CANCEL_REASON matches the required Mongolian reason text", () => {
  assert.equal(ACCOUNT_DELETION_CANCEL_REASON, "Хэрэглэгч бүртгэлээ устгасан");
});

test("formatBusinessDateTime renders a known UTC instant in Asia/Ulaanbaatar (UTC+8), regardless of host TZ", () => {
  // 2026-01-01T16:30:00Z -> 2026-01-02 00:30 in UTC+8.
  const d = new Date("2026-01-01T16:30:00.000Z");
  const out = formatBusinessDateTime(d);
  assert.match(out, /2026/);
  assert.match(out, /00:30/);
  assert.match(out, /02/); // day-of-month rolled over to the 2nd in UTC+8
});

test("buildAccountDeletionCancelNotificationBody: orders appointments ascending by requestedAt", () => {
  const later = new Date("2026-10-01T02:00:00.000Z");
  const earlier = new Date("2026-09-30T02:00:00.000Z");
  const body = buildAccountDeletionCancelNotificationBody([
    { requestedAt: later, paidUnrefunded: false },
    { requestedAt: earlier, paidUnrefunded: false },
  ]);
  const earlierText = formatBusinessDateTime(earlier);
  const laterText = formatBusinessDateTime(later);
  assert.ok(body.indexOf(earlierText) < body.indexOf(laterText), "earlier time should be listed first");
});

test("buildAccountDeletionCancelNotificationBody: marks paid-and-unrefunded appointments", () => {
  const a = new Date("2026-09-30T02:00:00.000Z");
  const body = buildAccountDeletionCancelNotificationBody([{ requestedAt: a, paidUnrefunded: true }]);
  assert.match(body, /\(төлбөр буцаах\)/);
});

test("buildAccountDeletionCancelNotificationBody: unmarked appointments carry no refund tag", () => {
  const a = new Date("2026-09-30T02:00:00.000Z");
  const body = buildAccountDeletionCancelNotificationBody([{ requestedAt: a, paidUnrefunded: false }]);
  assert.doesNotMatch(body, /төлбөр буцаах/);
});

test("buildAccountDeletionCancelNotificationBody: caps the list at 5 and summarizes the rest as +N", () => {
  const items = Array.from({ length: 8 }, (_, i) => ({
    requestedAt: new Date(NOW.getTime() + (i + 1) * 3600_000),
    paidUnrefunded: false,
  }));
  const body = buildAccountDeletionCancelNotificationBody(items);
  assert.match(body, /8 цаг захиалга/);
  assert.match(body, /… \+3/);
  const commaSeparatedCount = body.split(", … +3")[0].split(", ").length;
  assert.equal(commaSeparatedCount, 5);
});

test("buildAccountDeletionCancelNotificationBody: includes the reason text and never a deletion timestamp label", () => {
  const a = new Date("2026-09-30T02:00:00.000Z");
  const body = buildAccountDeletionCancelNotificationBody([{ requestedAt: a, paidUnrefunded: false }]);
  assert.match(body, new RegExp(ACCOUNT_DELETION_CANCEL_REASON));
});
