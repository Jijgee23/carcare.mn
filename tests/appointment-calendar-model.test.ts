import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBranchSchedule,
  type ScheduleAppointment,
  type ScheduleOrder,
} from "../lib/branch-schedule";
import { bookingDayBounds } from "../lib/booking-time";
import {
  buildCalendarDayModel,
  type CalendarAppointmentRow,
} from "../lib/appointments/calendar-day-model";

// Mirrors tests/scheduling.test.ts's fixture conventions (D-110's own tests
// live there) so this file stays consistent with the semantics it must not
// diverge from.
const at = (time: string) => new Date(`2030-01-07T${time}:00+08:00`);
const scope = { tenantId: "tenant", branchId: "branch" };
const { start: dayStart, end: dayEnd } = bookingDayBounds("2030-01-07");

const scheduleAppointment = (over: Partial<ScheduleAppointment> = {}): ScheduleAppointment => ({
  ...scope,
  id: "appt-1",
  status: "CONFIRMED",
  requestedAt: at("10:00"),
  estimatedDurationMinutes: 60,
  serviceOrderId: null,
  ...over,
});

const scheduleOrder = (over: Partial<ScheduleOrder> = {}): ScheduleOrder => ({
  ...scope,
  id: "order-1",
  status: "IN_PROGRESS",
  scheduledAt: at("10:00"),
  startedAt: at("10:00"),
  estimatedDurationMinutes: 60,
  expectedFinishAt: at("11:00"),
  occupiesCapacity: true,
  ...over,
});

// The API row shape (see lib/branch-schedule-loader.ts's
// BranchScheduleAppointmentRow) reduced to the fields calendar-day-model.ts
// actually reads.
const apptRow = (over: Partial<CalendarAppointmentRow> = {}): CalendarAppointmentRow => ({
  id: "appt-1",
  status: "CONFIRMED",
  requestedAt: at("10:00"),
  serviceOrderId: null,
  account: { name: "Бат", phone: "99001122" },
  customer: null,
  feeAmount: null,
  feeQpayInvoiceId: null,
  feeUnderpaidAmount: null,
  payment: null,
  ...over,
});

function project(input: {
  appointments?: ScheduleAppointment[];
  orders?: ScheduleOrder[];
  rangeStart?: Date;
  rangeEnd?: Date;
  now?: Date;
}) {
  const rangeStart = input.rangeStart ?? at("09:00");
  const rangeEnd = input.rangeEnd ?? at("18:00");
  const { intervals, issues } = buildBranchSchedule({
    ...scope,
    appointments: input.appointments ?? [],
    orders: input.orders ?? [],
    now: input.now ?? at("09:30"),
    rangeStart,
    rangeEnd,
  });
  return { intervals, issues, rangeStart, rangeEnd };
}

function model(input: {
  appointmentRows: CalendarAppointmentRow[];
  intervals: ReturnType<typeof project>["intervals"];
  issues: ReturnType<typeof project>["issues"];
  rangeStart: Date;
  rangeEnd: Date;
  slotCapacity?: number;
}) {
  return buildCalendarDayModel({
    branchId: scope.branchId,
    branchName: "Төв салбар",
    dateKey: "2030-01-07",
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    intervals: input.intervals,
    issues: input.issues,
    appointments: input.appointmentRows,
    slotCapacity: input.slotCapacity ?? 1,
  });
}

test("known finish is distinct from open-ended (unknown finish)", () => {
  // Estimated duration present → resolveable, precise finish.
  const known = project({
    appointments: [scheduleAppointment({ id: "known", estimatedDurationMinutes: 60 })],
  });
  const knownModel = model({
    appointmentRows: [apptRow({ id: "known" })],
    intervals: known.intervals,
    issues: known.issues,
    rangeStart: known.rangeStart,
    rangeEnd: known.rangeEnd,
  });
  assert.equal(knownModel.blocks.length, 1);
  assert.equal(knownModel.blocks[0].finishKnown, true);
  assert.equal(knownModel.blocks[0].endsAtDayBoundary, false);

  // No estimated duration → uncertain/open-ended.
  const openEnded = project({
    appointments: [
      scheduleAppointment({ id: "open", estimatedDurationMinutes: null }),
    ],
  });
  const openModel = model({
    appointmentRows: [apptRow({ id: "open" })],
    intervals: openEnded.intervals,
    issues: openEnded.issues,
    rangeStart: openEnded.rangeStart,
    rangeEnd: openEnded.rangeEnd,
  });
  assert.equal(openModel.blocks.length, 1);
  assert.equal(openModel.blocks[0].finishKnown, false);
  // Uncertain appointments are clamped to the requested horizon (18:00), the
  // fixture's rangeEnd — so this also happens to land on the boundary; the
  // dedicated midnight-boundary test below isolates the flag from unknown-ness.
  assert.ok(
    openModel.blocks[0].issue === null || openModel.blocks[0].issue.reason === "missing-estimate",
  );
});

test("work ending exactly at the day boundary is flagged, not presented as a precise in-day finish", () => {
  // Order started well before close, in progress with no expected finish —
  // occupiesCapacity true keeps it from being "unknown occupancy", but with
  // no expectedFinishAt/estimate it still runs to the horizon (midnight here).
  const dayBounded = project({
    orders: [
      scheduleOrder({
        id: "runs-late",
        scheduledAt: at("20:00"),
        startedAt: at("20:00"),
        estimatedDurationMinutes: null,
        expectedFinishAt: null,
        occupiesCapacity: true,
      }),
    ],
    rangeStart: dayStart,
    rangeEnd: dayEnd,
    now: at("20:30"),
  });
  // This order has no linked appointment, so it never reaches the
  // appointments-only day view — assert the harness produced an interval at
  // all (order truth), then re-run as an appointment for the actual model
  // assertion below.
  assert.equal(dayBounded.intervals.length, 1);

  const apptDayBounded = project({
    appointments: [
      scheduleAppointment({
        id: "late-booking",
        requestedAt: at("23:30"),
        estimatedDurationMinutes: 90, // would run to 01:00 next day — clamped
      }),
    ],
    rangeStart: dayStart,
    rangeEnd: dayEnd,
  });
  const m = model({
    appointmentRows: [apptRow({ id: "late-booking", requestedAt: at("23:30") })],
    intervals: apptDayBounded.intervals,
    issues: apptDayBounded.issues,
    rangeStart: apptDayBounded.rangeStart,
    rangeEnd: apptDayBounded.rangeEnd,
  });
  assert.equal(m.blocks.length, 1);
  assert.equal(m.blocks[0].endsAtDayBoundary, true);
  // A 90-minute estimate from a known start IS a known finish — the clamp to
  // midnight must not silently flip finishKnown to false.
  assert.equal(m.blocks[0].finishKnown, true);
  assert.ok(m.blocks[0].accessibleLabel.includes("24:00"));
  assert.ok(!m.blocks[0].accessibleLabel.includes("01:00"));
});

test("capacity overflow marks lanes beyond slotCapacity and surfaces on the model", () => {
  const overlapping = project({
    appointments: [
      scheduleAppointment({ id: "a", requestedAt: at("10:00"), estimatedDurationMinutes: 60 }),
      scheduleAppointment({ id: "b", requestedAt: at("10:15"), estimatedDurationMinutes: 60 }),
      scheduleAppointment({ id: "c", requestedAt: at("10:30"), estimatedDurationMinutes: 60 }),
    ],
  });
  const m = model({
    appointmentRows: [
      apptRow({ id: "a", requestedAt: at("10:00") }),
      apptRow({ id: "b", requestedAt: at("10:15") }),
      apptRow({ id: "c", requestedAt: at("10:30") }),
    ],
    intervals: overlapping.intervals,
    issues: overlapping.issues,
    rangeStart: overlapping.rangeStart,
    rangeEnd: overlapping.rangeEnd,
    slotCapacity: 2,
  });
  assert.equal(m.blocks.length, 3);
  assert.equal(m.laneCount, 3);
  assert.equal(m.hasCapacityOverflow, true);
  const overflowBlocks = m.blocks.filter((b) => b.capacityOverflow);
  assert.equal(overflowBlocks.length, 1);
  assert.equal(overflowBlocks[0].laneIndex, 2);
  assert.ok(overflowBlocks[0].accessibleLabel.includes("хэтэрсэн"));
});

test("no overlap under capacity never flags overflow", () => {
  const sequential = project({
    appointments: [
      scheduleAppointment({ id: "a", requestedAt: at("09:00"), estimatedDurationMinutes: 30 }),
      scheduleAppointment({ id: "b", requestedAt: at("10:00"), estimatedDurationMinutes: 30 }),
    ],
  });
  const m = model({
    appointmentRows: [
      apptRow({ id: "a", requestedAt: at("09:00") }),
      apptRow({ id: "b", requestedAt: at("10:00") }),
    ],
    intervals: sequential.intervals,
    issues: sequential.issues,
    rangeStart: sequential.rangeStart,
    rangeEnd: sequential.rangeEnd,
    slotCapacity: 1,
  });
  assert.equal(m.hasCapacityOverflow, false);
  assert.ok(m.blocks.every((b) => !b.capacityOverflow));
});

test("D-110: a terminal (CANCELLED) linked order removes the appointment from the day view entirely", () => {
  const p = project({
    orders: [scheduleOrder({ id: "order-1", status: "CANCELLED", occupiesCapacity: false })],
    appointments: [scheduleAppointment({ id: "appt-1", serviceOrderId: "order-1" })],
  });
  const m = model({
    appointmentRows: [apptRow({ id: "appt-1", serviceOrderId: "order-1" })],
    intervals: p.intervals,
    issues: p.issues,
    rangeStart: p.rangeStart,
    rangeEnd: p.rangeEnd,
  });
  assert.equal(m.blocks.length, 0);
  assert.equal(m.legend.length, 0);
});

test("D-110: the same holds for a COMPLETED linked order", () => {
  const p = project({
    orders: [scheduleOrder({ id: "order-1", status: "COMPLETED", occupiesCapacity: false })],
    appointments: [scheduleAppointment({ id: "appt-1", serviceOrderId: "order-1" })],
  });
  const m = model({
    appointmentRows: [apptRow({ id: "appt-1", serviceOrderId: "order-1" })],
    intervals: p.intervals,
    issues: p.issues,
    rangeStart: p.rangeStart,
    rangeEnd: p.rangeEnd,
  });
  assert.equal(m.blocks.length, 0);
});

test("D-110: a MISSING linked order stays a retained issue on its appointment block", () => {
  const p = project({
    orders: [],
    appointments: [scheduleAppointment({ id: "appt-1", serviceOrderId: "missing-order" })],
  });
  const m = model({
    appointmentRows: [apptRow({ id: "appt-1", serviceOrderId: "missing-order" })],
    intervals: p.intervals,
    issues: p.issues,
    rangeStart: p.rangeStart,
    rangeEnd: p.rangeEnd,
  });
  assert.equal(m.blocks.length, 1);
  assert.equal(m.blocks[0].issue?.reason, "missing-order");
  assert.ok(m.blocks[0].accessibleLabel.includes("Анхаарах"));
  assert.ok(m.legend.some((e) => e.kind === "issue" && e.reason === "missing-order"));
});

test("legend contains only statuses and issues actually present that day", () => {
  const p = project({
    appointments: [
      scheduleAppointment({ id: "confirmed", status: "CONFIRMED" }),
      scheduleAppointment({
        id: "pending-noissue",
        status: "PENDING",
        requestedAt: at("13:00"),
        estimatedDurationMinutes: 30,
      }),
    ],
  });
  const m = model({
    appointmentRows: [
      apptRow({ id: "confirmed", status: "CONFIRMED" }),
      apptRow({
        id: "pending-noissue",
        status: "PENDING",
        requestedAt: at("13:00"),
      }),
    ],
    intervals: p.intervals,
    issues: p.issues,
    rangeStart: p.rangeStart,
    rangeEnd: p.rangeEnd,
  });
  const statusKinds = m.legend.filter((e) => e.kind === "status");
  assert.equal(statusKinds.length, 2);
  assert.ok(statusKinds.some((e) => e.kind === "status" && e.status === "CONFIRMED"));
  assert.ok(statusKinds.some((e) => e.kind === "status" && e.status === "PENDING"));
  // Nothing else appeared this day.
  assert.ok(!m.legend.some((e) => e.kind === "status" && e.status === "REJECTED"));
  assert.ok(!m.legend.some((e) => e.kind === "issue"));
});

test("accessible label carries the full block meaning: time, name, status, payment and issue", () => {
  const p = project({
    appointments: [
      scheduleAppointment({
        id: "appt-1",
        status: "CONFIRMED",
        requestedAt: at("10:00"),
        estimatedDurationMinutes: 60,
      }),
    ],
  });
  const m = model({
    appointmentRows: [
      apptRow({
        id: "appt-1",
        status: "CONFIRMED",
        requestedAt: at("10:00"),
        account: { name: "Болд", phone: "99112233" },
        feeAmount: 5000,
        feeQpayInvoiceId: null,
        feeUnderpaidAmount: null,
        payment: { status: "PAID" },
      }),
    ],
    intervals: p.intervals,
    issues: p.issues,
    rangeStart: p.rangeStart,
    rangeEnd: p.rangeEnd,
  });
  const label = m.blocks[0].accessibleLabel;
  assert.ok(label.includes("Болд"));
  assert.ok(label.includes("Баталгаажсан")); // CONFIRMED label
  assert.ok(label.includes("Төлбөр төлөгдсөн")); // PAID payment label
  assert.equal(m.blocks[0].paymentStatus, "PAID");
});

test("empty day produces an empty, well-formed model", () => {
  const p = project({});
  const m = model({
    appointmentRows: [],
    intervals: p.intervals,
    issues: p.issues,
    rangeStart: p.rangeStart,
    rangeEnd: p.rangeEnd,
    slotCapacity: 2,
  });
  assert.deepEqual(m.blocks, []);
  assert.deepEqual(m.legend, []);
  assert.equal(m.hasCapacityOverflow, false);
  assert.equal(m.laneCount, 2);
});

test("business-timezone day boundary (Asia/Ulaanbaatar, not host clock) is respected", () => {
  // 07:59 in +08:00 business time is still "the previous day" relative to a
  // dayStart/dayEnd computed via bookingDayBounds — this exercises the same
  // day-window construction the route uses (lib/booking-time.ts), not a
  // reimplementation, so this is really asserting the model doesn't fight it.
  const { start, end } = bookingDayBounds("2030-06-15");
  assert.equal(start.toISOString(), "2030-06-14T16:00:00.000Z"); // UTC+8 offset
  const p = project({
    appointments: [
      scheduleAppointment({
        id: "midday",
        requestedAt: new Date(start.getTime() + 10 * 60 * 60 * 1000), // 10:00 local
        estimatedDurationMinutes: 30,
      }),
    ],
    rangeStart: start,
    rangeEnd: end,
  });
  const m = model({
    appointmentRows: [
      apptRow({ id: "midday", requestedAt: new Date(start.getTime() + 10 * 60 * 60 * 1000) }),
    ],
    intervals: p.intervals,
    issues: p.issues,
    rangeStart: start,
    rangeEnd: end,
  });
  assert.equal(m.blocks.length, 1);
  assert.equal(m.rangeStart, start.toISOString());
  assert.equal(m.rangeEnd, end.toISOString());
});

test("invalid range (end <= start) is rejected rather than silently producing an empty day", () => {
  assert.throws(() =>
    buildCalendarDayModel({
      branchId: scope.branchId,
      branchName: null,
      dateKey: "2030-01-07",
      rangeStart: at("18:00"),
      rangeEnd: at("09:00"),
      intervals: [],
      issues: [],
      appointments: [],
      slotCapacity: 1,
    }),
  );
});
