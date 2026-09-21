import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

test("expected finish must be strictly after the active start", async () => {
  const { isExpectedFinishAfterStart } = await import("../lib/orders/order-schedule-commands");
  const start = new Date("2030-01-07T02:00:00.000Z");
  assert.equal(isExpectedFinishAfterStart(new Date(start.getTime() + 1), start), true);
  assert.equal(isExpectedFinishAfterStart(start, start), false);
  assert.equal(isExpectedFinishAfterStart(new Date(start.getTime() - 1), start), false);
});

test("reschedule rejects only times before the supplied comparison clock", async () => {
  const { isScheduleTimeInPast } = await import("../lib/orders/order-schedule-commands");
  const now = Date.parse("2030-01-07T02:00:00.000Z");
  assert.equal(isScheduleTimeInPast(new Date(now - 1), now), true);
  assert.equal(isScheduleTimeInPast(new Date(now), now), false);
  assert.equal(isScheduleTimeInPast(new Date(now + 1), now), false);
});

test("business-local parsing rejects impossible calendar values and preserves Ulaanbaatar boundaries", async () => {
  const { parseBusinessLocalDateTime } = await import("../lib/booking-time");
  assert.equal(Number.isNaN(parseBusinessLocalDateTime("2030-02-30T10:00").getTime()), true);
  assert.equal(Number.isNaN(parseBusinessLocalDateTime("2031-02-29T10:00").getTime()), true);
  assert.equal(Number.isNaN(parseBusinessLocalDateTime("2030-01-01T24:00").getTime()), true);
  assert.equal(Number.isNaN(parseBusinessLocalDateTime("2030-01-01T10:60").getTime()), true);
  assert.equal(parseBusinessLocalDateTime("2032-02-29T00:00").toISOString(), "2032-02-28T16:00:00.000Z");
  assert.equal(parseBusinessLocalDateTime("2030-12-31T23:59:59").toISOString(), "2030-12-31T15:59:59.000Z");
});

test("schedule commands use the locked shared scheduling primitives", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "lib", "orders", "order-schedule-commands.ts"),
    "utf8",
  );
  assert.ok(src.includes("export async function reviseExpectedFinishCommand"));
  assert.ok(src.includes("export async function rescheduleOrderCommand"));
  assert.ok(src.includes("withOrderTransaction("));
  assert.ok(src.includes("moveLinkedAppointmentOrder("));
  assert.ok(src.includes("confirmNeeded: \"true\""));
  assert.ok(src.includes("getOpenOrderTimeBookings(tx, order.id)"));
});

test("reschedule delegates to the single S14 transaction/lock-order primitive", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "lib", "orders", "order-schedule-commands.ts"),
    "utf8",
  );
  const start = src.indexOf("export async function rescheduleOrderCommand");
  assert.ok(start >= 0);
  const body = src.slice(start);
  assert.ok(body.includes("moveLinkedAppointmentOrder("));
  assert.ok(body.includes("allowUnconfirmedOrderMove: true"));
  assert.ok(body.includes("actor: input.actor"));
  const linked = fs.readFileSync(path.join(__dirname, "..", "lib", "linked-reschedule.ts"), "utf8");
  assert.ok(linked.includes("input.newTime.getTime() < Date.now()"));
  assert.ok(linked.includes("canEditOrder(input.actor, order)"));
  assert.ok(linked.includes("order.branchId !== input.scope"));
  assert.ok(linked.includes("appt.branchId !== order.branchId"));
  assert.ok(linked.includes("appt.branchId !== input.scope"));
  assert.ok(linked.includes("FOR UPDATE"));
  assert.ok(linked.includes('"serviceOrderId" = ${order.id}'));
  assert.equal(linked.includes("order.appointment ? await rawTx.$queryRaw"), false);
  assert.ok(linked.includes("await tx.branch.findFirst("));
  assert.equal(linked.includes("getBranchSlotMinutes("), false);
  assert.ok(linked.includes("await tx.serviceOrder.update("));
  assert.ok(linked.includes("await updateOpenOrderTimeBookingSchedule("));
});

test("reschedule preserves active linked appointment notification data without moving a non-confirmed appointment", () => {
  const linked = fs.readFileSync(path.join(__dirname, "..", "lib", "linked-reschedule.ts"), "utf8");
  const command = fs.readFileSync(path.join(__dirname, "..", "lib", "orders", "order-schedule-commands.ts"), "utf8");
  assert.ok(linked.includes("appointmentId: appt?.id ?? null"));
  assert.ok(linked.includes("appointmentAccountId: appt?.accountId ?? null"));
  assert.ok(linked.includes("appointmentStatus: appt?.status ?? null"));
  assert.ok(linked.includes("if (appt?.status === \"CONFIRMED\") await tx.appointment.update"));
  assert.ok(linked.includes("appt?.status === \"CONFIRMED\" ? appt.estimatedDurationMinutes : null"));
  assert.ok(command.includes("await notifyRescheduleChange("));
});

test("linked reschedule hours warning uses the confirmation-required contract", () => {
  const linked = fs.readFileSync(path.join(__dirname, "..", "lib", "linked-reschedule.ts"), "utf8");
  const warningStart = linked.indexOf("if (hoursError && !input.confirmed)");
  const warningEnd = linked.indexOf("const endAt =", warningStart);
  assert.ok(warningStart >= 0 && warningEnd > warningStart);
  const warning = linked.slice(warningStart, warningEnd);
  assert.match(
    warning,
    /\{ confirmNeeded: "true" \},\s*409,\s*"CONFIRMATION_REQUIRED"/,
  );
});

test("expected-finish notification re-reads the tenant-scoped appointment after commit", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "lib", "orders", "order-schedule-commands.ts"), "utf8");
  const lookup = src.indexOf("prisma.appointment.findFirst(");
  const notify = src.indexOf("notifyExpectedFinishChange({");
  assert.ok(lookup >= 0 && notify > lookup);
  const lookupBody = src.slice(lookup, notify);
  assert.ok(lookupBody.includes("tenantId: input.actor.tenantId"));
  assert.ok(lookupBody.includes('status: { in: ["PENDING", "CONFIRMED"] }'));
  assert.ok(lookupBody.includes("accountId: { not: null }"));
});

test("API adapters use working-branch scope and the shared commands", () => {
  const expected = fs.readFileSync(
    path.join(__dirname, "..", "app", "api", "v1", "orders", "[id]", "expected-finish", "route.ts"),
    "utf8",
  );
  const schedule = fs.readFileSync(
    path.join(__dirname, "..", "app", "api", "v1", "orders", "[id]", "schedule", "route.ts"),
    "utf8",
  );
  for (const src of [expected, schedule]) {
    assert.ok(src.includes("resolveWorkingBranch(req, auth.user)"));
    assert.ok(src.includes("requireActiveSubscriptionApi(auth.user)"));
    assert.ok(src.includes("orders.edit"));
  }
  assert.ok(expected.includes("reviseExpectedFinishCommand("));
  assert.ok(schedule.includes("rescheduleOrderCommand("));
  assert.equal(expected.includes("new Date(raw)"), false);
  assert.equal(schedule.includes("new Date(raw)"), false);
  assert.ok(expected.includes("parseBusinessLocalDateTime("));
  assert.ok(schedule.includes("parseBusinessLocalDateTime("));
});
