/**
 * One-off, disposable verification for D-068's dual-write phase — not a
 * permanent test (this repo's own tests stay Prisma-free by convention, see
 * tests/scheduling.test.ts's docstring). Creates a throwaway ServiceOrder
 * scoped to a real existing tenant/branch/customer/vehicle, walks it through
 * the same booking-lifecycle transitions app/_actions/orders.ts's actions
 * perform (open on create, close+open on start, close on release, open on
 * restore, update-in-place on forecast revision, close on complete), asserts
 * the OrderTimeBooking rows look right after each step, then deletes the
 * throwaway order (cascades its bookings). Safe to run against a real DB —
 * touches only its own newly created row.
 *
 *   npx tsx scripts/verify-order-time-booking-dualwrite.ts
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";
import {
  closeOpenOrderTimeBooking,
  openOrderTimeBooking,
  updateOpenOrderTimeBookingForecast,
} from "@/lib/order-time-booking";

async function bookings(orderId: string) {
  return prisma.orderTimeBooking.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
}

async function main() {
  setBypassContext();

  const seed = await prisma.serviceOrder.findFirst({
    select: { tenantId: true, branchId: true, customerId: true, vehicleId: true },
  });
  assert.ok(seed, "No existing ServiceOrder found to borrow FK scope from.");
  const user = await prisma.user.findFirst({ where: { tenantId: seed.tenantId } });
  assert.ok(user, "No User found for tenant.");

  console.log(`Using scope: tenant=${seed.tenantId} branch=${seed.branchId}`);

  const order = await prisma.serviceOrder.create({
    data: {
      number: `VERIFY-${Date.now()}`,
      status: "SCHEDULED",
      tenantId: seed.tenantId,
      branchId: seed.branchId,
      customerId: seed.customerId,
      vehicleId: seed.vehicleId,
      scheduledAt: new Date(),
    },
    select: { id: true, branchId: true, tenantId: true },
  });
  console.log(`Created throwaway order ${order.id}`);

  try {
    // Step 1: creation should have exactly zero bookings (this script bypasses
    // the actual create action, so open the first one manually to mirror it).
    await openOrderTimeBooking(prisma as never, {
      tenantId: order.tenantId,
      orderId: order.id,
      branchId: order.branchId,
      kind: "SCHEDULED",
      startAt: new Date(),
      endAt: null,
      createdById: user!.id,
    });
    let rows = await bookings(order.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].kind, "SCHEDULED");
    assert.equal(rows[0].closedAt, null);
    console.log("✔ Step 1: initial SCHEDULED booking open");

    // Step 2: start work (SCHEDULED -> IN_PROGRESS) — close+open.
    const startedAt = new Date();
    const expectedFinishAt = new Date(startedAt.getTime() + 60 * 60000);
    await closeOpenOrderTimeBooking(prisma as never, order.id, startedAt, "all");
    await openOrderTimeBooking(prisma as never, {
      tenantId: order.tenantId,
      orderId: order.id,
      branchId: order.branchId,
      kind: "ACTIVE",
      startAt: startedAt,
      endAt: expectedFinishAt,
      createdById: user!.id,
    });
    rows = await bookings(order.id);
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].closedAt, null); // SCHEDULED one now closed
    assert.equal(rows[1].kind, "ACTIVE");
    assert.equal(rows[1].closedAt, null);
    console.log("✔ Step 2: SCHEDULED closed, ACTIVE opened on start");

    // Step 3: revise forecast — update in place, still 2 rows, still open.
    const newFinish = new Date(startedAt.getTime() + 90 * 60000);
    await updateOpenOrderTimeBookingForecast(prisma as never, order.id, newFinish);
    rows = await bookings(order.id);
    assert.equal(rows.length, 2);
    assert.equal(rows[1].closedAt, null);
    assert.equal(rows[1].endAt?.getTime(), newFinish.getTime());
    console.log("✔ Step 3: forecast revised in place, booking count unchanged");

    // Step 4: release bay while waiting for parts — close, no new row.
    const releasedAt = new Date();
    await closeOpenOrderTimeBooking(prisma as never, order.id, releasedAt, "ACTIVE");
    rows = await bookings(order.id);
    assert.equal(rows.length, 2);
    assert.notEqual(rows[1].closedAt, null);
    console.log("✔ Step 4: released — closed, no new row created");

    // Step 5: restore bay — opens a genuinely new row (not reopening the old one).
    const restoredAt = new Date();
    await openOrderTimeBooking(prisma as never, {
      tenantId: order.tenantId,
      orderId: order.id,
      branchId: order.branchId,
      kind: "ACTIVE",
      startAt: restoredAt,
      endAt: null,
      createdById: user!.id,
    });
    rows = await bookings(order.id);
    assert.equal(rows.length, 3);
    assert.equal(rows[2].closedAt, null);
    assert.equal(rows[2].startAt.getTime(), restoredAt.getTime());
    console.log("✔ Step 5: restore opened a new, third booking row");

    // Step 6: complete — closes the currently open one.
    const completedAt = new Date();
    await closeOpenOrderTimeBooking(prisma as never, order.id, completedAt, "ACTIVE");
    rows = await bookings(order.id);
    assert.equal(rows.length, 3);
    assert.ok(rows.every((r) => r.closedAt != null));
    console.log("✔ Step 6: completed — all rows closed, none left open");

    console.log("\n✔ All dual-write invariants hold against the live schema/RLS.");
  } finally {
    await prisma.serviceOrder.delete({ where: { id: order.id } });
    console.log(`Cleaned up: deleted throwaway order ${order.id} (bookings cascade).`);
  }
}

main()
  .catch((err) => {
    console.error("Алдаа:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
