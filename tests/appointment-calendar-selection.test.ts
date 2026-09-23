// P2-B10: behavioral tests for `selectAppointmentIntervals` and
// `SCHEDULE_ISSUE_LABEL` (lib/appointments/calendar-selection.ts) — the
// pure selection rule and label data lifted out of
// app/dashboard/appointments/calendar/day-rows.tsx's `buildDayRows` so
// lib/appointments/calendar-day-model.ts stops re-expressing them.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  selectAppointmentIntervals,
  SCHEDULE_ISSUE_LABEL,
} from "../lib/appointments/calendar-selection";

type Appt = { id: string; serviceOrderId: string | null };

test("selects appointment-source rows, sorted by start time", () => {
  const { rows } = selectAppointmentIntervals<Appt>({
    intervals: [
      { source: "appointment", id: "a2", startMs: 200, endMs: 300, uncertain: false, role: "primary" },
      { source: "appointment", id: "a1", startMs: 100, endMs: 200, uncertain: false, role: "primary" },
    ],
    issues: [],
    appointments: [
      { id: "a1", serviceOrderId: null },
      { id: "a2", serviceOrderId: null },
    ],
  });
  assert.deepEqual(rows.map((r) => r.appt?.id), ["a1", "a2"]);
});

test("excludes order-source rows that have no linked appointment", () => {
  const { rows } = selectAppointmentIntervals<Appt>({
    intervals: [
      { source: "order", id: "order-1", startMs: 100, endMs: 200, uncertain: false, role: "primary" },
    ],
    issues: [],
    appointments: [],
  });
  assert.equal(rows.length, 0);
});

test("resolves an order-sourced interval back to its linked appointment (D-076 suppression case)", () => {
  const { rows } = selectAppointmentIntervals<Appt>({
    intervals: [
      { source: "order", id: "order-1", startMs: 100, endMs: 200, uncertain: false, role: "primary" },
    ],
    issues: [],
    appointments: [{ id: "appt-1", serviceOrderId: "order-1" }],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].appt?.id, "appt-1");
  assert.equal(rows[0].id, "order-1"); // raw row id stays the order id; caller resolves appt.id itself
});

test("only appointment-source issues are kept, keyed by appointment:<id>", () => {
  const { issueBySourceId } = selectAppointmentIntervals<Appt>({
    intervals: [],
    issues: [
      { source: "appointment", id: "a1", reason: "missing-estimate" },
      { source: "order", id: "o1", reason: "missing-order" },
    ],
    appointments: [],
  });
  assert.equal(issueBySourceId.size, 1);
  assert.equal(issueBySourceId.get("appointment:a1")?.reason, "missing-estimate");
  assert.equal(issueBySourceId.has("order:o1"), false);
});

test("SCHEDULE_ISSUE_LABEL has one label per ScheduleIssue reason", () => {
  const reasons = [
    "missing-estimate",
    "unknown-occupancy",
    "missing-order",
    "linked-order-not-occupying",
    "missing-start",
    "invalid-interval",
    "payment-expired",
  ] as const;
  for (const reason of reasons) {
    assert.equal(typeof SCHEDULE_ISSUE_LABEL[reason], "string");
    assert.ok(SCHEDULE_ISSUE_LABEL[reason].length > 0);
  }
});

test("day-rows.tsx (buildDayRows) and calendar-day-model.ts both import the shared selection module, not a local copy", () => {
  const dayRowsSrc = fs.readFileSync(
    path.join(__dirname, "..", "app", "dashboard", "appointments", "calendar", "day-rows.tsx"),
    "utf8",
  );
  const modelSrc = fs.readFileSync(
    path.join(__dirname, "..", "lib", "appointments", "calendar-day-model.ts"),
    "utf8",
  );
  assert.ok(dayRowsSrc.includes('from "@/lib/appointments/calendar-selection"'));
  assert.ok(dayRowsSrc.includes("selectAppointmentIntervals("));
  assert.ok(modelSrc.includes('from "@/lib/appointments/calendar-selection"'));
  assert.ok(modelSrc.includes("selectAppointmentIntervals("));
});
