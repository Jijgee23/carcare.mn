import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPostpaidAggregateWhere,
  buildPostpaidHistoryWhere,
  buildPostpaidVisibleOrdersWhere,
  parsePostpaidQuery,
  serializePostpaidVehicleAggregates,
  type PostpaidQuery,
} from "../lib/orders/order-postpaid-query";

function query(raw = "") {
  const parsed = parsePostpaidQuery(new URLSearchParams(raw));
  assert.equal(parsed.ok, true, parsed.ok ? undefined : parsed.message);
  return (parsed as { ok: true; value: PostpaidQuery }).value;
}

function scope(readWhere: Record<string, unknown> = {}, workingBranchId?: string) {
  return {
    tenantId: "tenant-a",
    workingBranchId,
    readWhere,
  };
}

test("parses postpaid filters, aliases and business dates", () => {
  const parsed = query(
    "vehicleId=vehicle-a&paymentStatus=PARTIAL&dateFrom=2026-09-01" +
      "&dateTo=2026-09-30&page=2&pageSize=25",
  );
  assert.deepEqual(parsed, {
    vehicleId: "vehicle-a",
    paymentStatus: "PARTIAL",
    dateFrom: "2026-09-01",
    dateTo: "2026-09-30",
    page: 2,
    pageSize: 25,
    skip: 25,
    take: 25,
  });
  assert.equal(query("limit=7").pageSize, 7);
  assert.equal(query("pageSize=8&limit=7").pageSize, 8);
});

test("rejects invalid payment/date/range/pagination input", () => {
  for (const raw of [
    "paymentStatus=PARTIALLY_PAID",
    "dateFrom=2026-02-30",
    "dateTo=not-a-date",
    "dateFrom=2026-10-01&dateTo=2026-09-30",
    "page=0",
    "page=1.5",
    "pageSize=101",
    "pageSize=8&limit=bad",
    "limit=not-a-number",
    "page=9007199254740991&pageSize=2",
  ]) {
    assert.equal(parsePostpaidQuery(new URLSearchParams(raw)).ok, false, raw);
  }
});

test("history scope keeps tenant, working branch and viewOwn conjunctive", () => {
  const where = buildPostpaidHistoryWhere(query("vehicleId=vehicle-attacker"), {
    tenantId: "tenant-authoritative",
    workingBranchId: "branch-allowed",
    readWhere: { assignedToId: "user-own" },
  });
  assert.equal(where.tenantId, "tenant-authoritative");
  assert.equal(where.isPostpaid, true);
  assert.equal(where.branchId, "branch-allowed");
  assert.equal(where.vehicleId, "vehicle-attacker");
  assert.deepEqual(where.AND, [{ assignedToId: "user-own" }]);
});

test("empty access remains an empty-result invariant for links and aggregates", () => {
  const options = scope({ id: { in: [] } }, "branch-a");
  assert.deepEqual(buildPostpaidVisibleOrdersWhere(options).AND, [{ id: { in: [] } }]);
  assert.deepEqual(buildPostpaidAggregateWhere(options).AND, [{ id: { in: [] } }]);
  assert.deepEqual(buildPostpaidAggregateWhere(options).status, { not: "CANCELLED" });
  assert.equal(buildPostpaidAggregateWhere(options).tenantId, "tenant-a");
  assert.equal(buildPostpaidAggregateWhere(options).branchId, "branch-a");
});

test("date filters use Asia/Ulaanbaatar day boundaries and aggregates are all-time", () => {
  const history = buildPostpaidHistoryWhere(
    query("dateFrom=2026-09-01&dateTo=2026-09-01&paymentStatus=PAID"),
    scope(),
  );
  const range = history.scheduledAt as { gte: Date; lt: Date };
  assert.equal(range.gte.toISOString(), "2026-08-31T16:00:00.000Z");
  assert.equal(range.lt.toISOString(), "2026-09-01T16:00:00.000Z");
  assert.equal(history.paymentStatus, "PAID");
  assert.equal(buildPostpaidAggregateWhere(scope()).scheduledAt, undefined);
});

test("vehicle aggregates compute totals/balance and default cancelled-only vehicles to zero", () => {
  const rows = serializePostpaidVehicleAggregates(
    [
      {
        vehicle: { id: "vehicle-a", plate: "1234ABC", make: "Toyota", model: "Prius" },
        customer: { id: "customer-a", fullName: "Jane Doe", phone: "9911" },
      },
      {
        vehicle: { id: "vehicle-cancelled", plate: "5678ABC", make: "Honda", model: "Fit" },
        customer: null,
      },
    ],
    [
      {
        vehicleId: "vehicle-a",
        _count: { _all: 2 },
        _sum: { totalAmount: "100.50", paidAmount: "40.25" },
      },
    ],
  );
  assert.deepEqual(rows[0], {
    id: "vehicle-a",
    plate: "1234ABC",
    make: "Toyota",
    model: "Prius",
    customer: { id: "customer-a", fullName: "Jane Doe", phone: "9911" },
    orderCount: 2,
    totalAmount: "100.5",
    paidAmount: "40.25",
    balanceAmount: "60.25",
  });
  assert.deepEqual(rows[1], {
    id: "vehicle-cancelled",
    plate: "5678ABC",
    make: "Honda",
    model: "Fit",
    customer: null,
    orderCount: 0,
    totalAmount: "0",
    paidAmount: "0",
    balanceAmount: "0",
  });
});
