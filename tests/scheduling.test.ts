import assert from "node:assert/strict";
import test from "node:test";
import { peakOccupancy } from "../lib/schedule-capacity";
import { buildDaySlots } from "../lib/appointment-slots";
import { buildBranchSchedule, type ScheduleOrder, type ScheduleAppointment } from "../lib/branch-schedule";
import { isSlotAvailable, resolveTakenAppointmentIntervals } from "../lib/category-duration";
import type { PrismaTransactionClient } from "../lib/prisma";
import { resolveEffectiveSchedule } from "../lib/branch-effective-schedule";
import { splitScheduleInterval } from "../lib/schedule-intervals";
import { calculateServiceItemDurationMinutes } from "../lib/service-duration";
import { resolveOrderEffectiveInterval, resolveOrderIntervals, type OrderTimeBookingLike } from "../lib/schedule-order-interval";

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
const project = (
  orders: ScheduleOrder[],
  appointments: ScheduleAppointment[] = [],
  fallbackDurationMinutes?: number,
) =>
  buildBranchSchedule({
    ...scope,
    orders,
    appointments,
    now: at("10:30"),
    rangeStart: at("09:00"),
    rangeEnd: at("18:00"),
    fallbackDurationMinutes,
  });

const scheduleBranch = {
  openTime: "09:00", closeTime: "18:00",
  schedules: [
    { weekday: "MON" as const, isOpen: true, openTime: "10:00", closeTime: "17:00" },
    { weekday: "TUE" as const, isOpen: false, openTime: null, closeTime: null },
  ],
};

test("effective schedule applies exception, season, weekday, then default precedence", () => {
  const season = { name: "Summer", startsOn: "2030-01-01", endsOn: "2030-02-01", isActive: true,
    days: [{ weekday: "MON" as const, isOpen: true, openTime: "11:00", closeTime: "16:00" }] };
  const exception = { date: "2030-01-07", isOpen: true, openTime: "12:00", closeTime: "15:00", label: "Holiday opening" };
  assert.deepEqual(resolveEffectiveSchedule({ dateStr: "2030-01-07", branch: { ...scheduleBranch, scheduleSeasons: [season], scheduleExceptions: [exception] } }), {
    date: "2030-01-07", weekday: "MON", open: true, openTime: "12:00", closeTime: "15:00", source: "exception", label: "Holiday opening",
  });
  assert.equal(resolveEffectiveSchedule({ dateStr: "2030-01-14", branch: { ...scheduleBranch, scheduleSeasons: [season] } }).openTime, "11:00");
  assert.equal(resolveEffectiveSchedule({ dateStr: "2030-02-04", branch: scheduleBranch }).openTime, "10:00");
  assert.equal(resolveEffectiveSchedule({ dateStr: "2030-01-08", branch: scheduleBranch }).open, false);
});

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
const client = (rows: object[] = [], orderRows: object[] = [], capacity = 2) => ({
  branch: { findUnique: async () => ({ slotMinutes: 30, slotCapacity: capacity }) },
  appointment: { findMany: async () => rows },
  serviceOrder: { findMany: async () => orderRows },
  category: { findMany: async () => [{ id: "category", durationMinutes: 120 }] },
  branchCategoryDuration: { findMany: async () => [] },
}) as unknown as PrismaTransactionClient;
test("submission capacity agrees with slot picker for consecutive appointments", async () => {
  const rows = [10, 10.5].map((hour) => ({ requestedAt: new Date(2030, 0, 7, Math.floor(hour), hour % 1 * 60), categoryId: null, categories: [] }));
  assert.equal(await isSlotAvailable(client(rows), "branch", new Date(2030, 0, 7, 10), 60), true);
});
test("active orders share appointment capacity", async () => {
  const activeOrder = {
    id: "order-1", status: "IN_PROGRESS", scheduledAt: null,
    startedAt: new Date(2030, 0, 7, 10), estimatedDurationMinutes: 60,
    expectedFinishAt: new Date(2030, 0, 7, 11), occupiesCapacity: true,
  };
  const secondOrder = { ...activeOrder, id: "order-2" };
  assert.equal(
    await isSlotAvailable(client([], [activeOrder, secondOrder]), "branch", new Date(2030, 0, 7, 10), 60),
    false,
  );
});
// D-076: a client variant that also serves OrderTimeBooking rows, so a
// follow-up (kind: SCHEDULED, still open) can be exercised end-to-end
// through isSlotAvailable -> resolveTakenCapacityIntervals.
const clientWithBookings = (orderRows: object[], bookingRows: object[], capacity = 2) => ({
  branch: { findUnique: async () => ({ slotMinutes: 30, slotCapacity: capacity }) },
  appointment: { findMany: async () => [] },
  serviceOrder: { findMany: async () => orderRows },
  orderTimeBooking: { findMany: async (args: { where: unknown }) => {
    // Distinguish the two call shapes by presence of `orderId` in `where`.
    const where = args.where as { orderId?: { in: string[] }; branchId?: string };
    if (where.orderId) return bookingRows.filter((r) => where.orderId!.in.includes((r as { orderId: string }).orderId));
    return bookingRows; // followUpOrderIds lookup — test data has no extra out-of-scope orders
  } },
  category: { findMany: async () => [{ id: "category", durationMinutes: 120 }] },
  branchCategoryDuration: { findMany: async () => [] },
}) as unknown as PrismaTransactionClient;
test("D-076: a live customer cannot double-book a slot an IN_PROGRESS order's follow-up already claims", async () => {
  const activeOrder = {
    id: "order-1", status: "IN_PROGRESS", scheduledAt: null,
    startedAt: at("09:00"), estimatedDurationMinutes: 60,
    expectedFinishAt: at("10:00"), occupiesCapacity: true,
  };
  const bookings = [
    { orderId: "order-1", kind: "ACTIVE", startAt: at("09:00"), endAt: at("10:00"), closedAt: null },
    { orderId: "order-1", kind: "SCHEDULED", startAt: at("15:00"), endAt: at("16:00"), closedAt: null },
  ];
  // The follow-up's own window (15:00-16:00) must now be unavailable.
  assert.equal(
    await isSlotAvailable(clientWithBookings([activeOrder], bookings, 1), "branch", at("15:00"), 60),
    false,
  );
  // A window that overlaps neither the current work nor the follow-up stays free.
  assert.equal(
    await isSlotAvailable(clientWithBookings([activeOrder], bookings, 1), "branch", at("12:00"), 60),
    true,
  );
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
test("completed and explicitly released work clears its linked appointment quietly", () => {
  // A COMPLETED order is the normal, successful outcome — not an issue.
  // Appointment status has no terminal "done" state of its own, so the
  // ordinary same-day book -> convert -> finish path must not flag every
  // completed job as a "linked order not occupying" issue.
  const result = project([order({ status: "COMPLETED", occupiesCapacity: false })],
    [appointment({ serviceOrderId: "order" })]);
  assert.equal(result.intervals.length, 0);
  assert.ok(!result.issues.some((issue) => issue.reason === "linked-order-not-occupying"));
});
test("cancelled linked order still flags its appointment for attention", () => {
  const result = project([order({ status: "CANCELLED", occupiesCapacity: false })],
    [appointment({ serviceOrderId: "order" })]);
  assert.equal(result.intervals.length, 1);
  assert.equal(result.intervals[0].source, "appointment");
  assert.ok(result.issues.some((issue) => issue.reason === "linked-order-not-occupying"));
});
test("explicitly released waiting-for-parts order clears its linked appointment quietly", () => {
  // Freeing the bay while waiting on a part (setOrderCapacityAction) is a
  // normal, everyday choice, not a broken link — the order stays fully
  // visible on /dashboard/orders regardless.
  const result = project([order({ status: "POSTPONED", occupiesCapacity: false })],
    [appointment({ serviceOrderId: "order" })]);
  assert.equal(result.intervals.length, 0);
  assert.ok(!result.issues.some((issue) => issue.reason === "linked-order-not-occupying"));
});
test("completed car still in workspace continues to consume capacity", () => {
  assert.equal(project([order({ status: "COMPLETED" })]).intervals.length, 1);
});
test("waiting for parts consumes capacity only when it has not been released", () => {
  assert.equal(project([order({ status: "POSTPONED", occupiesCapacity: false })]).intervals.length, 0);
  assert.equal(project([order({ status: "POSTPONED" })]).intervals.length, 1);
});
test("overdue work keeps its saved finish boundary and requests a revised estimate", () => {
  const result = project([order({ expectedFinishAt: at("10:15") })]);
  assert.equal(result.intervals[0].endMs, at("10:15").getTime());
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
test("scheduled order without an estimate uses a bounded slot fallback but stays flagged", () => {
  const result = project(
    [order({
      status: "SCHEDULED",
      occupiesCapacity: false,
      scheduledAt: at("11:00"),
      startedAt: null,
      estimatedDurationMinutes: null,
      expectedFinishAt: null,
    })],
    [],
    45,
  );
  assert.equal(result.intervals[0].endMs, at("11:45").getTime());
  assert.equal(result.intervals[0].uncertain, true);
  assert.ok(result.issues.some((issue) => issue.reason === "missing-estimate"));
});
test("resolveOrderEffectiveInterval prefers OrderTimeBooking rows over scalars when given any", () => {
  const scalarOnly = order({ status: "IN_PROGRESS", startedAt: at("10:00"), expectedFinishAt: at("11:00") });
  const booking: OrderTimeBookingLike = { kind: "ACTIVE", startAt: at("12:00"), endAt: at("13:00"), closedAt: null };
  const resolved = resolveOrderEffectiveInterval(scalarOnly, [booking]);
  assert.equal(resolved.scheduled, false);
  assert.equal(resolved.start?.getTime(), at("12:00").getTime());
  assert.equal(resolved.end?.getTime(), at("13:00").getTime());
});
test("resolveOrderEffectiveInterval with bookings picks the most recent row (closed ones stay part of history)", () => {
  const scalarOnly = order({ status: "COMPLETED" });
  const closed: OrderTimeBookingLike = { kind: "ACTIVE", startAt: at("09:00"), endAt: at("10:00"), closedAt: at("10:00") };
  const latest: OrderTimeBookingLike = { kind: "ACTIVE", startAt: at("14:00"), endAt: at("15:00"), closedAt: at("15:00") };
  const resolved = resolveOrderEffectiveInterval(scalarOnly, [closed, latest]);
  assert.equal(resolved.start?.getTime(), at("14:00").getTime());
  assert.equal(resolved.end?.getTime(), at("15:00").getTime());
});
test("resolveOrderEffectiveInterval with an empty bookings array falls back to scalars unchanged", () => {
  const scalarOnly = order({ status: "IN_PROGRESS", startedAt: at("10:00"), expectedFinishAt: at("11:00") });
  const resolved = resolveOrderEffectiveInterval(scalarOnly, []);
  assert.equal(resolved.start?.getTime(), at("10:00").getTime());
  assert.equal(resolved.end?.getTime(), at("11:00").getTime());
});
test("resolveOrderEffectiveInterval with bookings still flags a corrupt end <= start as invalid", () => {
  const scalarOnly = order({ status: "IN_PROGRESS" });
  const bad: OrderTimeBookingLike = { kind: "ACTIVE", startAt: at("12:00"), endAt: at("11:00"), closedAt: null };
  const resolved = resolveOrderEffectiveInterval(scalarOnly, [bad]);
  assert.equal(resolved.invalid, true);
  assert.equal(resolved.end, null);
});
test("resolveOrderIntervals: a single open ACTIVE booking is current, no upcoming", () => {
  const scalarOnly = order({ status: "IN_PROGRESS" });
  const active: OrderTimeBookingLike = { kind: "ACTIVE", startAt: at("10:00"), endAt: at("11:00"), closedAt: null };
  const { current, upcoming } = resolveOrderIntervals(scalarOnly, [active]);
  assert.equal(current.start?.getTime(), at("10:00").getTime());
  assert.equal(current.scheduled, false);
  assert.equal(upcoming.length, 0);
});
test("resolveOrderIntervals: a single open SCHEDULED booking is current, no upcoming (D-068 return-time case)", () => {
  const scalarOnly = order({ status: "POSTPONED", occupiesCapacity: false });
  const scheduled: OrderTimeBookingLike = { kind: "SCHEDULED", startAt: at("14:00"), endAt: at("15:00"), closedAt: null };
  const { current, upcoming } = resolveOrderIntervals(scalarOnly, [scheduled]);
  assert.equal(current.start?.getTime(), at("14:00").getTime());
  assert.equal(current.scheduled, true);
  assert.equal(upcoming.length, 0);
});
test("resolveOrderIntervals: an open ACTIVE plus an open SCHEDULED follow-up — ACTIVE is current, SCHEDULED is upcoming", () => {
  const scalarOnly = order({ status: "IN_PROGRESS" });
  const active: OrderTimeBookingLike = { kind: "ACTIVE", startAt: at("09:00"), endAt: at("11:00"), closedAt: null };
  const followUp: OrderTimeBookingLike = { kind: "SCHEDULED", startAt: at("15:00"), endAt: at("16:00"), closedAt: null };
  const { current, upcoming } = resolveOrderIntervals(scalarOnly, [active, followUp]);
  assert.equal(current.start?.getTime(), at("09:00").getTime());
  assert.equal(current.scheduled, false);
  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0].start?.getTime(), at("15:00").getTime());
  assert.equal(upcoming[0].scheduled, true);
});
test("resolveOrderIntervals: a terminal order's only (closed) booking is still current, matching resolveOrderEffectiveInterval", () => {
  const scalarOnly = order({ status: "COMPLETED", occupiesCapacity: false });
  const closed: OrderTimeBookingLike = { kind: "ACTIVE", startAt: at("09:00"), endAt: at("10:00"), closedAt: at("10:00") };
  const { current, upcoming } = resolveOrderIntervals(scalarOnly, [closed]);
  assert.equal(current.start?.getTime(), at("09:00").getTime());
  assert.equal(current.end?.getTime(), at("10:00").getTime());
  assert.equal(upcoming.length, 0);
  // Must match resolveOrderEffectiveInterval exactly (thin-wrapper guarantee).
  const viaWrapper = resolveOrderEffectiveInterval(scalarOnly, [closed]);
  assert.deepEqual(current, viaWrapper);
});
test("resolveOrderIntervals: closed history wins current over an open future follow-up (the real POSTPONED-return-time shape)", () => {
  // This is the real shape of a released POSTPONED order with a return
  // time booked: closed ACTIVE (the work session that led to the release)
  // plus an open SCHEDULED (the return). "current" must resolve to the real
  // past session, not the not-yet-happened return — an open row's startAt
  // being later must never let it outrank actual closed history. The return
  // booking correctly surfaces as `upcoming` instead.
  const scalarOnly = order({ status: "POSTPONED", occupiesCapacity: false });
  const closedActive: OrderTimeBookingLike = { kind: "ACTIVE", startAt: at("08:00"), endAt: at("09:00"), closedAt: at("09:00") };
  const openScheduled: OrderTimeBookingLike = { kind: "SCHEDULED", startAt: at("14:00"), endAt: at("15:00"), closedAt: null };
  const { current, upcoming } = resolveOrderIntervals(scalarOnly, [closedActive, openScheduled]);
  assert.equal(current.start?.getTime(), at("08:00").getTime());
  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0].start?.getTime(), at("14:00").getTime());
});
test("buildBranchSchedule resolves an order's interval from orderBookings when supplied", () => {
  // Scalars alone would place this order at 10:00-11:00 (the order() default);
  // a passed-in booking row should override that with the real 12:00-13:00.
  const bookings = new Map([
    ["order", [{ kind: "ACTIVE" as const, startAt: at("12:00"), endAt: at("13:00"), closedAt: null }]],
  ]);
  const result = buildBranchSchedule({
    ...scope,
    orders: [order()],
    appointments: [],
    now: at("10:30"),
    rangeStart: at("09:00"),
    rangeEnd: at("18:00"),
    orderBookings: bookings,
  });
  assert.equal(result.intervals[0].startMs, at("12:00").getTime());
  assert.equal(result.intervals[0].endMs, at("13:00").getTime());
});
test("buildBranchSchedule falls back to scalars when orderBookings has no entry for an order", () => {
  const result = buildBranchSchedule({
    ...scope,
    orders: [order()],
    appointments: [],
    now: at("10:30"),
    rangeStart: at("09:00"),
    rangeEnd: at("18:00"),
    orderBookings: new Map(),
  });
  assert.equal(result.intervals[0].startMs, at("10:00").getTime());
  assert.equal(result.intervals[0].endMs, at("11:00").getTime());
});
test("D-076: an IN_PROGRESS order with an open follow-up projects two intervals — primary now, upcoming later", () => {
  const bookings = new Map([
    ["order", [
      { kind: "ACTIVE" as const, startAt: at("10:00"), endAt: at("11:00"), closedAt: null },
      { kind: "SCHEDULED" as const, startAt: at("15:00"), endAt: at("16:00"), closedAt: null },
    ]],
  ]);
  const result = buildBranchSchedule({
    ...scope,
    orders: [order({ status: "IN_PROGRESS" })],
    appointments: [],
    now: at("10:30"),
    rangeStart: at("09:00"),
    rangeEnd: at("18:00"),
    orderBookings: bookings,
  });
  assert.equal(result.intervals.length, 2);
  const primary = result.intervals.find((i) => i.role === "primary");
  const upcoming = result.intervals.find((i) => i.role === "upcoming");
  assert.equal(primary?.startMs, at("10:00").getTime());
  assert.equal(primary?.endMs, at("11:00").getTime());
  assert.equal(upcoming?.startMs, at("15:00").getTime());
  assert.equal(upcoming?.endMs, at("16:00").getTime());
  assert.equal(upcoming?.uncertain, false);
});
test("D-076: a COMPLETED order's follow-up still projects even though the order itself no longer counts for capacity", () => {
  // occupiesCapacity:false + COMPLETED means orderCanCountForCapacity is
  // false for the order's own current interval — but a still-open follow-up
  // booking (survived completion, per closeOpenOrderTimeBooking's "ACTIVE"-
  // only scoping) must still appear on the calendar and count for conflicts.
  // A real COMPLETED order always has closed history too (it was ACTIVE
  // before it finished) — included here so "current" resolves to that real
  // finish, not the later-but-not-yet-happened follow-up.
  const bookings = new Map([
    ["order", [
      { kind: "ACTIVE" as const, startAt: at("09:00"), endAt: at("10:00"), closedAt: at("10:00") },
      { kind: "SCHEDULED" as const, startAt: at("15:00"), endAt: at("16:00"), closedAt: null },
    ]],
  ]);
  const result = buildBranchSchedule({
    ...scope,
    orders: [order({ status: "COMPLETED", occupiesCapacity: false })],
    appointments: [],
    now: at("10:30"),
    rangeStart: at("09:00"),
    rangeEnd: at("18:00"),
    orderBookings: bookings,
  });
  assert.equal(result.intervals.length, 1);
  assert.equal(result.intervals[0].role, "upcoming");
  assert.equal(result.intervals[0].startMs, at("15:00").getTime());
  assert.equal(result.intervals[0].endMs, at("16:00").getTime());
});
test("D-076: retroactive fix — a released POSTPONED order's scheduled return time now actually appears on the calendar", () => {
  // Before this fix, orderCanCountForCapacity's early `continue` (status
  // POSTPONED + occupiesCapacity:false) skipped the order entirely,
  // so a booked return time never rendered at all — the "book a return
  // slot" feature (D-068 step 4) was visually broken since it shipped
  // earlier this session, until this same D-076 carve-out fixed it.
  const bookings = new Map([
    ["order", [
      { kind: "ACTIVE" as const, startAt: at("08:00"), endAt: at("09:00"), closedAt: at("09:00") },
      { kind: "SCHEDULED" as const, startAt: at("14:00"), endAt: at("15:00"), closedAt: null },
    ]],
  ]);
  const result = buildBranchSchedule({
    ...scope,
    orders: [order({ status: "POSTPONED", occupiesCapacity: false })],
    appointments: [],
    now: at("10:30"),
    rangeStart: at("09:00"),
    rangeEnd: at("18:00"),
    orderBookings: bookings,
  });
  assert.equal(result.intervals.length, 1);
  assert.equal(result.intervals[0].role, "upcoming");
  assert.equal(result.intervals[0].startMs, at("14:00").getTime());
  assert.equal(result.intervals[0].endMs, at("15:00").getTime());
});
test("D-076: an upcoming follow-up with no known duration is bounded by the branch slot fallback and flagged missing-estimate", () => {
  const bookings = new Map([
    ["order", [
      { kind: "ACTIVE" as const, startAt: at("10:00"), endAt: at("11:00"), closedAt: null },
      { kind: "SCHEDULED" as const, startAt: at("15:00"), endAt: null, closedAt: null },
    ]],
  ]);
  const result = buildBranchSchedule({
    ...scope,
    orders: [order({ status: "IN_PROGRESS" })],
    appointments: [],
    now: at("10:30"),
    rangeStart: at("09:00"),
    rangeEnd: at("18:00"),
    orderBookings: bookings,
    fallbackDurationMinutes: 45,
  });
  const upcoming = result.intervals.find((i) => i.role === "upcoming");
  assert.equal(upcoming?.startMs, at("15:00").getTime());
  assert.equal(upcoming?.endMs, at("15:45").getTime());
  assert.equal(upcoming?.uncertain, true);
  assert.ok(result.issues.some((i) => i.source === "order" && i.id === "order" && i.reason === "missing-estimate"));
});
test("scheduled carry-over fallback can continue into the next day", () => {
  const start = new Date("2030-01-06T23:50:00+08:00");
  const endOfDay = new Date("2030-01-07T00:00:00+08:00");
  const result = buildBranchSchedule({
    ...scope,
    orders: [order({
      status: "SCHEDULED",
      occupiesCapacity: false,
      scheduledAt: start,
      startedAt: null,
      estimatedDurationMinutes: null,
      expectedFinishAt: null,
    })],
    appointments: [],
    now: at("10:30"),
    rangeStart: endOfDay,
    rangeEnd: new Date("2030-01-07T23:59:00+08:00"),
    fallbackDurationMinutes: 30,
  });
  assert.equal(result.intervals.length, 1);
  assert.equal(result.intervals[0].startMs, endOfDay.getTime());
  assert.equal(result.intervals[0].endMs, new Date("2030-01-07T00:20:00+08:00").getTime());
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
test("cross-midnight order is represented on both business dates", () => {
  const segments = splitScheduleInterval(
    new Date("2030-01-07T23:00:00+08:00"),
    new Date("2030-01-08T02:00:00+08:00"),
  );
  assert.equal(segments.length, 2);
  assert.equal(segments[0].start.toISOString(), "2030-01-07T15:00:00.000Z");
  assert.equal(segments[0].end.toISOString(), "2030-01-07T16:00:00.000Z");
  assert.equal(segments[1].startsBeforeDay, true);
  assert.equal(segments[1].start.toISOString(), "2030-01-07T16:00:00.000Z");
  assert.equal(segments[1].end.toISOString(), "2030-01-07T18:00:00.000Z");
});
test("an exact-midnight finish does not create a zero-length next-day segment", () => {
  const segments = splitScheduleInterval(
    new Date("2030-01-07T23:00:00+08:00"),
    new Date("2030-01-08T00:00:00+08:00"),
  );
  assert.equal(segments.length, 1);
  assert.equal(segments[0].endsAfterDay, false);
  assert.equal(segments[0].end.toISOString(), "2030-01-07T16:00:00.000Z");
});
test("invalid order interval is surfaced and does not occupy the rest of the day", () => {
  const result = project([order({ expectedFinishAt: at("09:30"), startedAt: at("10:00") })]);
  assert.deepEqual(result.intervals, []);
  assert.ok(result.issues.some((issue) => issue.reason === "invalid-interval"));
});

test("an unpaid PENDING appointment past the 15-minute window releases its slot and drops out of the day calendar entirely", () => {
  const result = buildBranchSchedule({
    ...scope,
    orders: [],
    appointments: [appointment({
      status: "PENDING", feeAmount: 5000, payment: null,
      createdAt: new Date(at("10:30").getTime() - 16 * 60000),
    })],
    now: at("10:30"), rangeStart: at("09:00"), rangeEnd: at("18:00"),
  });
  assert.deepEqual(result.intervals, []);
  assert.ok(result.issues.some((issue) => issue.reason === "payment-expired"));
});
test("a PENDING appointment still inside the payment window keeps its slot", () => {
  const result = buildBranchSchedule({
    ...scope,
    orders: [],
    appointments: [appointment({
      status: "PENDING", feeAmount: 5000, payment: null,
      createdAt: new Date(at("10:30").getTime() - 5 * 60000),
    })],
    now: at("10:30"), rangeStart: at("09:00"), rangeEnd: at("18:00"),
  });
  assert.equal(result.intervals.length, 1);
});
test("a paid appointment never expires regardless of age", () => {
  const result = buildBranchSchedule({
    ...scope,
    orders: [],
    appointments: [appointment({
      status: "PENDING", feeAmount: 5000, payment: { status: "PAID" },
      createdAt: new Date(at("10:30").getTime() - 60 * 60000),
    })],
    now: at("10:30"), rangeStart: at("09:00"), rangeEnd: at("18:00"),
  });
  assert.equal(result.intervals.length, 1);
});
test("live availability check also releases an expired unpaid appointment's slot", async () => {
  const expiredRow = {
    requestedAt: new Date(2030, 0, 7, 10), categoryId: null, categories: [],
    status: "PENDING", feeAmount: 5000, feeUnderpaidAmount: null, payment: null,
    createdAt: new Date(new Date(2030, 0, 7, 10).getTime() - 20 * 60000),
  };
  assert.equal(
    await isSlotAvailable(client([expiredRow]), "branch", new Date(2030, 0, 7, 10), 60),
    true,
  );
});
test("live availability uses the slot fallback for an unestimated scheduled order", async () => {
  const scheduledOrder = {
    id: "scheduled-order", status: "SCHEDULED", scheduledAt: at("10:00"),
    startedAt: null, estimatedDurationMinutes: null, expectedFinishAt: null,
    occupiesCapacity: false,
  };
  assert.equal(
    await isSlotAvailable(client([], [scheduledOrder], 1), "branch", at("10:15"), 30),
    false,
  );
});

test("service item durations provide a whole-order estimate and ignore parts", () => {
  assert.equal(
    calculateServiceItemDurationMinutes([
      {
        kind: "LABOR",
        status: "PENDING",
        quantity: 1,
        service: {
          durationValue: "1.5",
          durationUnit: { name: "цаг", code: "ц" },
        },
        diagnosticTemplate: null,
      },
      {
        kind: "DIAGNOSTIC",
        status: "PENDING",
        quantity: 1,
        service: null,
        diagnosticTemplate: { durationMin: 30 },
      },
      {
        kind: "PART",
        status: "PENDING",
        quantity: 1,
        service: null,
        diagnosticTemplate: null,
      },
      {
        kind: "LABOR",
        status: "COMPLETED",
        quantity: 1,
        service: {
          durationValue: 8,
          durationUnit: { name: "цаг", code: "ц" },
        },
        diagnosticTemplate: null,
      },
    ]),
    120,
  );
});

test("an untimed work item keeps the estimate unresolved", () => {
  assert.equal(
    calculateServiceItemDurationMinutes([
      {
        kind: "LABOR",
        status: "PENDING",
        quantity: 1,
        service: null,
        diagnosticTemplate: null,
      },
    ]),
    null,
  );
});
