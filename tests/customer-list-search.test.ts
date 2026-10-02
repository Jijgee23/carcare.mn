import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

test("phone search ignores dashes and spaces", async () => {
  const { buildCustomerListWhere } = await import("../lib/customers/customer-list-query");
  const where = buildCustomerListWhere({ q: "9950-3223", page: 1, pageSize: 20, skip: 0, take: 20 }, { tenantId: "t1" });
  assert.deepEqual(where.tenantId, "t1");
  assert.ok(JSON.stringify(where.OR).includes('"phone":{"contains":"99503223"}'));
});

test("search also matches the customer's vehicle plates, upper-cased", async () => {
  const { buildCustomerListWhere } = await import("../lib/customers/customer-list-query");
  const where = buildCustomerListWhere({ q: "1111уаа", page: 1, pageSize: 20, skip: 0, take: 20 }, { tenantId: "t1" });
  assert.ok(
    JSON.stringify(where.OR).includes('"tenantVehicles":{"some":{"vehicle":{"plate":{"contains":"1111УАА"}}}}'),
  );
});

test("a query with no digits adds no phone clause", async () => {
  const { buildCustomerListWhere } = await import("../lib/customers/customer-list-query");
  const where = buildCustomerListWhere({ q: "Бат", page: 1, pageSize: 20, skip: 0, take: 20 }, { tenantId: "t1" });
  assert.ok(!JSON.stringify(where.OR).includes('"phone"'));
});
