import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUDIT_PAGE_SIZE,
  auditPagination,
  buildAuditWhere,
  parseAuditPage,
  validateAuditRangeParams,
} from "../lib/audit-query";

test("buildAuditWhere always scopes by tenantId, with no other filters by default", () => {
  const where = buildAuditWhere("t1", {});
  assert.deepEqual(where, { tenantId: "t1" });
});

test("buildAuditWhere applies action filter", () => {
  const where = buildAuditWhere("t1", { action: "CREATE" });
  assert.equal(where.action, "CREATE");
});

test("buildAuditWhere applies entity filter", () => {
  const where = buildAuditWhere("t1", { entity: "Customer" });
  assert.equal(where.entity, "Customer");
});

test("buildAuditWhere applies userId filter", () => {
  const where = buildAuditWhere("t1", { userId: "u9" });
  assert.equal(where.userId, "u9");
});

test("buildAuditWhere applies q as an OR over summary/entityId", () => {
  const where = buildAuditWhere("t1", { q: "hello" });
  assert.deepEqual(where.OR, [
    { summary: { contains: "hello", mode: "insensitive" } },
    { entityId: { contains: "hello" } },
  ]);
});

test("buildAuditWhere applies from/to as inclusive local-day createdAt bounds", () => {
  const where = buildAuditWhere("t1", { from: "2026-01-01", to: "2026-01-31" });
  const createdAt = where.createdAt as { gte: Date; lte: Date };
  assert.equal(createdAt.gte.toISOString().slice(0, 10), "2025-12-31");
  assert.equal(createdAt.lte.getHours(), 23);
  assert.equal(createdAt.lte.getMinutes(), 59);
});

test("buildAuditWhere combines every filter together", () => {
  const where = buildAuditWhere("t1", {
    q: "x",
    action: "DELETE",
    entity: "Vehicle",
    userId: "u1",
    from: "2026-01-01",
  });
  assert.equal(where.tenantId, "t1");
  assert.equal(where.action, "DELETE");
  assert.equal(where.entity, "Vehicle");
  assert.equal(where.userId, "u1");
  assert.ok(where.OR);
  assert.ok(where.createdAt);
});

test("parseAuditPage defaults to 1 and floors invalid/negative input", () => {
  assert.equal(parseAuditPage(undefined), 1);
  assert.equal(parseAuditPage("0"), 1);
  assert.equal(parseAuditPage("-5"), 1);
  assert.equal(parseAuditPage("abc"), 1);
  assert.equal(parseAuditPage("3"), 3);
});

test("auditPagination computes skip/take at the fixed page size", () => {
  assert.equal(AUDIT_PAGE_SIZE, 50);
  assert.deepEqual(auditPagination(1), { page: 1, skip: 0, take: 50, pageSize: 50 });
  assert.deepEqual(auditPagination(3), { page: 3, skip: 100, take: 50, pageSize: 50 });
});

test("validateAuditRangeParams accepts absent from/to", () => {
  assert.equal(validateAuditRangeParams({}), null);
});

test("validateAuditRangeParams rejects a malformed date", () => {
  const err = validateAuditRangeParams({ from: "2026/01/01" });
  assert.ok(err);
  assert.equal(err?.field, "from");
});

test("validateAuditRangeParams rejects to before from", () => {
  const err = validateAuditRangeParams({ from: "2026-02-01", to: "2026-01-01" });
  assert.ok(err);
  assert.equal(err?.field, "to");
});

test("validateAuditRangeParams accepts from == to", () => {
  assert.equal(validateAuditRangeParams({ from: "2026-01-01", to: "2026-01-01" }), null);
});
