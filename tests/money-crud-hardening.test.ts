import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { periodEndDate } from "../lib/subscription";

// Web hardening S5/S6.

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
// Ulaanbaatar wall-clock time → UTC instant.
const ub = (iso: string) => new Date(`${iso}+08:00`);

test("periodEndDate clamps to the last day of the target month (UB time)", () => {
  assert.deepEqual(periodEndDate(ub("2026-01-31T10:00:00"), "MONTH"), ub("2026-02-28T10:00:00"));
  assert.deepEqual(periodEndDate(ub("2028-01-31T10:00:00"), "MONTH"), ub("2028-02-29T10:00:00"));
  assert.deepEqual(periodEndDate(ub("2026-03-31T10:00:00"), "MONTH"), ub("2026-04-30T10:00:00"));
  assert.deepEqual(periodEndDate(ub("2026-11-30T10:00:00"), "QUARTER"), ub("2027-02-28T10:00:00"));
  assert.deepEqual(periodEndDate(ub("2028-02-29T10:00:00"), "YEAR"), ub("2029-02-28T10:00:00"));
  assert.deepEqual(periodEndDate(ub("2026-05-15T10:00:00"), "MONTH"), ub("2026-06-15T10:00:00"));
});

test("periodEndDate uses the UB calendar day, not UTC: 00:30 UB on the 1st", () => {
  // 2026-03-01 00:30 UB is still 2026-02-28 in UTC.
  assert.deepEqual(periodEndDate(ub("2026-03-01T00:30:00"), "MONTH"), ub("2026-04-01T00:30:00"));
});

test("order total recompute also refreshes payment status", () => {
  const src = read("../lib/orders/order-item-commands.ts");
  const fn = src.slice(src.indexOf("export async function recomputeOrderTotal"));
  assert.match(fn.slice(0, fn.indexOf("\n}\n")), /recomputeOrderPaymentTotals\(tx, order\.tenantId, order\)/);
});

test("cancelling an order with a PAID payment is refused before any write", () => {
  const src = read("../lib/orders/order-commands.ts");
  const guard = src.indexOf('"Энэ засварын хуудсанд төлбөр төлөгдсөн тул цуцлах боломжгүй.');
  const firstWrite = src.indexOf("await tx.serviceOrder.update({ where: { id: orderId }, data: updates })");
  assert.ok(guard > 0 && firstWrite > guard);
});

test("deleting an order restores stock before the cascade delete", () => {
  const src = read("../lib/orders/order-commands.ts");
  const fn = src.slice(src.indexOf("export async function deleteOrderCommand"));
  const restore = fn.indexOf('reason: "ORDER_DELETE"');
  const del = fn.indexOf("tx.serviceOrder.delete(");
  assert.ok(restore > 0 && del > restore);
});

test("vehicle resolve serialises on the plate with an advisory lock before reading", () => {
  const src = read("../lib/vehicles.ts");
  const fn = src.slice(src.indexOf("export async function resolveVehicleForOwner"));
  const lock = fn.indexOf("pg_advisory_xact_lock");
  const read1 = fn.indexOf("client.vehicle.findFirst");
  assert.ok(lock > 0 && read1 > lock);
});

test("web bulk appointment category enforces the shared id cap", () => {
  assert.match(read("../app/_actions/appointments.ts"), /ids\.length > MAX_BULK_APPOINTMENT_IDS/);
});
