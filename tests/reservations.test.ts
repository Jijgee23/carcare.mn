import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "../app/generated/prisma/client";
import { reserveAppointmentInTransaction, ReservationError } from "../lib/appointment-reservations";
import { bookingDateKey, bookingDayBounds } from "../lib/booking-time";

const now = new Date("2030-01-07T09:00:00+08:00");
const input = { tenantId: "tenant", branchId: "branch", accountId: "account", categoryIds: ["category"], requestedAt: new Date("2030-01-07T10:00:00+08:00") };
function fixture(opts: { duration?: number; closed?: boolean; full?: boolean; missingBranch?: boolean; invalidCategory?: boolean; foreignVehicle?: boolean } = {}) {
  const calls: string[] = [];
  let saved: Prisma.AppointmentCreateArgs["data"] | undefined;
  const tx = {
    $queryRaw: async () => { calls.push("lock"); return opts.missingBranch ? [] : [{ id: "branch" }]; },
    branch: {
      findFirst: async () => { calls.push("branch"); return { id: "branch", slotMinutes: 30, slotCapacity: 1,
        openTime: "10:00", closeTime: "12:00", schedules: opts.closed ? [{ weekday: "MON", isOpen: false }] : [],
        tenant: { suspended: false, acceptsOnlineBooking: true } }; },
      findUnique: async () => ({ slotMinutes: 30, slotCapacity: 1 }),
    },
    category: { findMany: async (args: { select: { durationMinutes?: boolean } }) => args.select.durationMinutes
      ? [{ id: "category", durationMinutes: opts.duration ?? 60 }]
      : opts.invalidCategory ? [] : [{ id: "category" }] },
    branchCategoryDuration: { findMany: async () => [] },
    accountVehicle: { findFirst: async () => opts.foreignVehicle ? null : { id: "vehicle" } },
    customer: { findFirst: async () => null },
    appointment: {
      findMany: async () => { calls.push("capacity"); return opts.full ? [{ requestedAt: input.requestedAt,
        estimatedDurationMinutes: 60, categoryId: "category", categories: [] }] : []; },
      create: async (args: Prisma.AppointmentCreateArgs) => { calls.push("insert"); saved = args.data;
        return { id: "new", status: args.data.status, requestedAt: args.data.requestedAt }; },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, calls, saved: () => saved };
}
test("reservation locks before reading capacity and inserting a saved estimate", async () => {
  const f = fixture();
  await reserveAppointmentInTransaction(f.tx, input, now);
  assert.deepEqual(f.calls, ["lock", "branch", "capacity", "insert"]);
  assert.equal(f.saved()?.estimatedDurationMinutes, 60);
  assert.equal(f.saved()?.status, "PENDING");
});
test("full branch returns conflict without inserting", async () => {
  const f = fixture({ full: true });
  await assert.rejects(reserveAppointmentInTransaction(f.tx, input, now), (e: unknown) => e instanceof ReservationError && e.status === 409);
  assert.equal(f.saved(), undefined);
});
test("duration must fit before closing", async () => {
  const f = fixture({ duration: 150 });
  await assert.rejects(reserveAppointmentInTransaction(f.tx, input, now), ReservationError);
  assert.equal(f.saved(), undefined);
});
test("closed weekday cannot be booked", async () => {
  const f = fixture({ closed: true });
  await assert.rejects(reserveAppointmentInTransaction(f.tx, input, now), ReservationError);
});
test("past times and times off the slot grid are rejected", async () => {
  for (const requestedAt of [now, new Date("2030-01-07T10:15:00+08:00")]) {
    const f = fixture();
    await assert.rejects(reserveAppointmentInTransaction(f.tx, { ...input, requestedAt }, now), ReservationError);
    assert.equal(f.saved(), undefined);
  }
});
test("foreign branch, category, vehicle and customer are rejected", async () => {
  for (const [opts, extra] of [
    [{ missingBranch: true }, {}], [{ invalidCategory: true }, {}],
    [{ foreignVehicle: true }, { accountVehicleId: "foreign" }], [{}, { customerId: "foreign" }],
  ] as const) {
    const f = fixture(opts);
    await assert.rejects(reserveAppointmentInTransaction(f.tx, { ...input, ...extra }, now), ReservationError);
    assert.equal(f.saved(), undefined);
  }
});
test("staff booking saves the same estimate and confirmation metadata", async () => {
  const f = fixture();
  await reserveAppointmentInTransaction(f.tx, { ...input, staffUserId: "staff" }, now);
  assert.equal(f.saved()?.status, "CONFIRMED");
  assert.equal(f.saved()?.respondedById, "staff");
  assert.equal(f.saved()?.estimatedDurationMinutes, 60);
});
test("category duplicates count only once and empty selection saves slot fallback", async () => {
  const f = fixture();
  await reserveAppointmentInTransaction(f.tx, { ...input, categoryIds: ["category", "category"] }, now);
  assert.equal(f.saved()?.estimatedDurationMinutes, 60);
  const empty = fixture();
  await reserveAppointmentInTransaction(empty.tx, { ...input, categoryIds: [] }, now);
  assert.equal(empty.saved()?.estimatedDurationMinutes, 30);
});
test("booking day boundaries are independent of the server timezone", () => {
  assert.equal(bookingDateKey(new Date("2030-01-06T17:00:00Z")), "2030-01-07");
  assert.equal(bookingDayBounds("2030-01-07").start.toISOString(), "2030-01-06T16:00:00.000Z");
  assert.throws(() => bookingDayBounds("2030-02-30"), RangeError);
});
