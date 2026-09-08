import assert from "node:assert/strict";
import test from "node:test";
import { peakOccupancy } from "../lib/schedule-capacity";
import { buildDaySlots } from "../lib/appointment-slots";
import { buildBranchSchedule, type ScheduleOrder, type ScheduleAppointment } from "../lib/branch-schedule";
import { isSlotAvailable, resolveTakenAppointmentIntervals } from "../lib/category-duration";
import type { PrismaTransactionClient } from "../lib/prisma";

const at = (time: string) => new Date(`2030-01-07T${time}:00+08:00`);
const scope = { tenantId: "tenant", branchId: "branch" };
const appointment = (over: Partial<ScheduleAppointment> = {}): ScheduleAppointment => ({
  ...scope, id: "appointment", status: "CONFIRMED", requestedAt: at("10:00"),
  estimatedDurationMinutes: 60, serviceOrderId: null, ...over,
});
const order = (over: Partial<ScheduleOrder> = {}): ScheduleOrder => ({
  ...scope, id: "order", status: "IN_PROGRESS", scheduledAt: at("10:00"),
  startedAt: at("10:00"), estimatedDurationMinutes: 60,
  expectedFinishAt: at("11:00"), occupiesCapacity: true, ...over,
});
const project = (orders: ScheduleOrder[], appointments: ScheduleAppointment[] = []) =>
  buildBranchSchedule({ ...scope, orders, appointments, now: at("10:30"), rangeStart: at("09:00"), rangeEnd: at("18:00") });

test("consecutive jobs consume one place across a longer candidate", () => {
  assert.equal(peakOccupancy([{ startMs: 0, endMs: 30 }, { startMs: 30, endMs: 60 }], 0, 60), 1);
});
test("simultaneous jobs consume two places", () => {
  assert.equal(peakOccupancy([{ startMs: 0, endMs: 40 }, { startMs: 30, endMs: 60 }], 0, 60), 2);
});
test("jobs ending at candidate start or starting at its end don't overlap", () => {
  assert.equal(peakOccupancy([{ startMs: 0, endMs: 30 }, { startMs: 60, endMs: 90 }], 30, 60), 0);
});
test("peak occupancy is clipped to the candidate", () => {
  assert.equal(peakOccupancy([{ startMs: 0, endMs: 100 }, { startMs: 0, endMs: 10 }], 20, 30), 1);
});
test("invalid input cannot silently produce free capacity", () => {
  assert.throws(() => peakOccupancy([], 10, 10), RangeError);
  assert.throws(() => peakOccupancy([{ startMs: NaN, endMs: 30 }], 0, 60), RangeError);
});
test("slot picker leaves a second place available alongside consecutive jobs", () => {
  const local = (h: number, m = 0) => at(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  const result = buildDaySlots({ dateStr: "2030-01-07", open: true,
    openTime: "10:00", closeTime: "12:00", slotMinutes: 30, capacity: 2,
    appointmentMinutes: 60, now: local(9), taken: [
      { start: local(10), durationMinutes: 30 }, { start: local(10, 30), durationMinutes: 30 },
    ] });
  assert.equal(result.slots[0].remaining, 1);
  assert.equal(result.slots[0].available, true);
  assert.equal(result.slots.at(-1)?.time, "11:00");
});

// Only the query methods used by these helpers are stubbed. No Prisma runtime
// or database connection is imported by this suite.
const client = (rows: object[] = []) => ({
  branch: { findUnique: async () => ({ slotMinutes: 30, slotCapacity: 2 }) },
  appointment: { findMany: async () => rows },
  category: { findMany: async () => [{ id: "category", durationMinutes: 120 }] },
  branchCategoryDuration: { findMany: async () => [] },
}) as unknown as PrismaTransactionClient;
test("submission capacity agrees with slot picker for consecutive appointments", async () => {
  const rows = [10, 10.5].map((hour) => ({ requestedAt: new Date(2030, 0, 7, Math.floor(hour), hour % 1 * 60), categoryId: null, categories: [] }));
  assert.equal(await isSlotAvailable(client(rows), "branch", new Date(2030, 0, 7, 10), 60), true);
});
test("saved estimate takes precedence over a subsequently changed category", async () => {
  const [interval] = await resolveTakenAppointmentIntervals(client(), "branch", [{
    requestedAt: at("10:00"), estimatedDurationMinutes: 45, categoryId: "category", categories: [],
  }], 30);
  assert.equal(interval.durationMinutes, 45);
});
test("legacy duration fallback remains compatible until migration wiring", async () => {
  const [interval] = await resolveTakenAppointmentIntervals(client(), "branch", [{
    requestedAt: at("10:00"), categoryId: "category", categories: [],
  }], 30);
  assert.equal(interval.durationMinutes, 120);
});
test("linked appointment and order count once", () => {
  const result = project([order()], [appointment({ serviceOrderId: "order" })]);
  assert.equal(result.intervals.length, 1);
  assert.equal(result.intervals[0].source, "order");
});
test("walk-in without appointment consumes capacity", () => {
  assert.equal(project([order()]).intervals.length, 1);
});
test("completed and explicitly released work frees its linked reservation", () => {
  assert.equal(project([order({ status: "COMPLETED", occupiesCapacity: false })],
    [appointment({ serviceOrderId: "order" })]).intervals.length, 0);
});
test("completed car still in workspace continues to consume capacity", () => {
  assert.equal(project([order({ status: "COMPLETED" })]).intervals.length, 1);
});
test("waiting for parts consumes capacity only when it has not been released", () => {
  assert.equal(project([order({ status: "WAITING_PARTS", occupiesCapacity: false })]).intervals.length, 0);
  assert.equal(project([order({ status: "WAITING_PARTS" })]).intervals.length, 1);
});
test("overdue work blocks the remaining horizon and requests a revised estimate", () => {
  const result = project([order({ expectedFinishAt: at("10:15") })]);
  assert.equal(result.intervals[0].endMs, at("18:00").getTime());
  assert.equal(result.intervals[0].uncertain, true);
  assert.ok(result.issues.some((issue) => issue.reason === "overdue"));
});
test("unknown active occupancy is not treated as free", () => {
  const result = project([order({ occupiesCapacity: null })]);
  assert.equal(result.intervals[0].endMs, at("18:00").getTime());
  assert.ok(result.issues.some((issue) => issue.reason === "unknown-occupancy"));
});
test("scheduled order reserves future time even before physical occupancy", () => {
  const result = project([order({ status: "SCHEDULED", occupiesCapacity: false, startedAt: null, expectedFinishAt: null })]);
  assert.equal(result.intervals[0].endMs, at("11:00").getTime());
  assert.equal(result.intervals[0].uncertain, false);
});
test("missing linked order preserves reservation and raises an issue", () => {
  const result = project([], [appointment({ serviceOrderId: "missing" })]);
  assert.equal(result.intervals.length, 1);
  assert.ok(result.issues.some((issue) => issue.reason === "missing-order"));
});
test("cancelled and no-show appointments release reservations", () => {
  assert.equal(project([], [appointment({ status: "CANCELLED" }), appointment({ status: "NO_SHOW", id: "other" })]).intervals.length, 0);
});
test("projection excludes other branches and tenants", () => {
  const result = project([order({ tenantId: "other" }), order({ branchId: "other", id: "other" })],
    [appointment({ tenantId: "other" }), appointment({ branchId: "other", id: "other" })]);
  assert.deepEqual(result, { intervals: [], issues: [] });
});
test("carry-over active job from yesterday still occupies today", () => {
  const result = project([order({ startedAt: new Date("2030-01-06T16:00:00+08:00") })]);
  assert.equal(result.intervals[0].startMs, at("09:00").getTime());
});
test("new forecast changes capacity without moving the original appointment", () => {
  const original = appointment({ serviceOrderId: "order" });
  const result = project([order({ expectedFinishAt: at("12:00") })], [original]);
  assert.equal(result.intervals[0].endMs, at("12:00").getTime());
  assert.equal(original.requestedAt.getTime(), at("10:00").getTime());
  assert.equal(original.estimatedDurationMinutes, 60);
});
