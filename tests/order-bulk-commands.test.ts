import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  MAX_BULK_ORDER_IDS,
  bulkAssignOrderCommand,
  bulkChangeOrderStatusCommand,
  parseBulkAssignmentBody,
  parseBulkOrderIds,
  parseBulkStatusBody,
  runBulkOrderCommands,
} from "../lib/orders/order-bulk-commands";
import { OrderCommandError } from "../lib/orders/order-commands";

test("bulk request parser rejects empty, duplicate and oversized ID lists", () => {
  assert.equal(parseBulkOrderIds([]).ok, false);
  assert.equal(parseBulkOrderIds(["order-a", "order-a"]).ok, false);
  assert.equal(parseBulkOrderIds(Array.from({ length: MAX_BULK_ORDER_IDS + 1 }, (_, i) => `o-${i}`)).ok, false);
  assert.deepEqual(parseBulkOrderIds([" order-a ", "order-b"]), {
    ok: true,
    orderIds: ["order-a", "order-b"],
  });
});

test("status parser validates status and duration while preserving input order", () => {
  assert.deepEqual(parseBulkStatusBody({
    orderIds: ["a", "b"],
    status: "IN_PROGRESS",
    durationMinutes: 90,
  }), {
    ok: true,
    orderIds: ["a", "b"],
    status: "IN_PROGRESS",
    durationMinutes: 90,
  });
  assert.equal(parseBulkStatusBody({ orderIds: ["a"], status: "NOT_A_STATUS" }).ok, false);
  assert.equal(parseBulkStatusBody({ orderIds: ["a"], status: "IN_PROGRESS", durationMinutes: 30.5 }).ok, false);
});

test("assignment parser requires an explicit string or null target", () => {
  assert.deepEqual(parseBulkAssignmentBody({ orderIds: ["a"], assignedToId: null }), {
    ok: true,
    orderIds: ["a"],
    assignedToId: null,
  });
  assert.deepEqual(parseBulkAssignmentBody({ orderIds: ["a"], assignedToId: " staff-a " }), {
    ok: true,
    orderIds: ["a"],
    assignedToId: "staff-a",
  });
  assert.equal(parseBulkAssignmentBody({ orderIds: ["a"] }).ok, false);
  assert.equal(parseBulkAssignmentBody({ orderIds: ["a"], assignedToId: "" }).ok, false);
});

test("bulk runner continues after failures and returns deterministic per-ID results", async () => {
  const result = await runBulkOrderCommands(["a", "b", "c"], async (orderId) => {
    if (orderId !== "b") return;
    throw new OrderCommandError("Танд энэ засварын хуудсыг засах эрх байхгүй.", 403, "ORDER_EDIT_FORBIDDEN");
  });
  assert.deepEqual(result.succeeded, ["a", "c"]);
  assert.deepEqual(result.failed, [{
    orderId: "b",
    code: "ORDER_EDIT_FORBIDDEN",
    message: "Танд энэ засварын хуудсыг засах эрх байхгүй.",
  }]);
});

const actor = {
  id: "staff-a",
  tenantId: "tenant-a",
  isOwner: false,
  branchId: "branch-a",
  assignableBranchIds: [],
  role: { permissions: ["orders.edit", "orders.editOwn", "orders.assign"] },
};

test("status adapter invokes the shared command once per ID and preserves command failures", async () => {
  const calls: string[] = [];
  const result = await bulkChangeOrderStatusCommand({
    actor,
    orderIds: ["duration", "transition", "ok"],
    nextStatus: "IN_PROGRESS",
    durationMinutes: 90,
    scope: "branch-a",
  }, {
    changeOrderStatusCommand: async ({ orderId }) => {
      calls.push(orderId);
      if (orderId === "duration") {
        throw new OrderCommandError("duration required", 422, "DURATION_REQUIRED");
      }
      if (orderId === "transition") {
        throw new OrderCommandError("invalid transition", 422, "INVALID_STATUS_TRANSITION");
      }
    },
  });
  assert.deepEqual(calls, ["duration", "transition", "ok"]);
  assert.deepEqual(result.succeeded, ["ok"]);
  assert.deepEqual(result.failed.map(({ orderId, code }) => ({ orderId, code })), [
    { orderId: "duration", code: "DURATION_REQUIRED" },
    { orderId: "transition", code: "INVALID_STATUS_TRANSITION" },
  ]);
});

test("assignment adapter invokes the shared command once per ID and preserves eligibility/scope failures", async () => {
  const calls: string[] = [];
  const result = await bulkAssignOrderCommand({
    actor,
    orderIds: ["ineligible", "cross-tenant", "ok"],
    assignedToId: "staff-b",
    scope: "branch-a",
  }, {
    assignOrderCommand: async ({ orderId }) => {
      calls.push(orderId);
      if (orderId === "ineligible") {
        throw new OrderCommandError("assignee ineligible", 422, "ASSIGNEE_INELIGIBLE");
      }
      if (orderId === "cross-tenant") {
        throw new OrderCommandError("order not found", 404, "ORDER_NOT_FOUND");
      }
    },
  });
  assert.deepEqual(calls, ["ineligible", "cross-tenant", "ok"]);
  assert.deepEqual(result.succeeded, ["ok"]);
  assert.deepEqual(result.failed.map(({ orderId, code }) => ({ orderId, code })), [
    { orderId: "ineligible", code: "ASSIGNEE_INELIGIBLE" },
    { orderId: "cross-tenant", code: "ORDER_NOT_FOUND" },
  ]);
});

test("routes retain the permission gates and shared-command adapters", () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const statusRoute = readFileSync(resolve(testDir, "../app/api/v1/orders/bulk/status/route.ts"), "utf8");
  const assignRoute = readFileSync(resolve(testDir, "../app/api/v1/orders/bulk/assign/route.ts"), "utf8");
  const bulkCommands = readFileSync(resolve(testDir, "../lib/orders/order-bulk-commands.ts"), "utf8");
  const orderCommands = readFileSync(resolve(testDir, "../lib/orders/order-commands.ts"), "utf8");

  assert.match(statusRoute, /requirePermission\(auth\.user, "orders\.edit"\)/);
  assert.match(statusRoute, /orders\.editOwn/);
  assert.match(statusRoute, /bulkChangeOrderStatusCommand\(/);
  assert.match(assignRoute, /requirePermission\(auth\.user, "orders\.assign"\)/);
  assert.match(assignRoute, /bulkAssignOrderCommand\(/);
  assert.match(bulkCommands, /executeStatus\(\{/);
  assert.match(bulkCommands, /executeAssignment\(\{/);
  assert.match(bulkCommands, /changeOrderStatusCommand/);
  assert.match(bulkCommands, /assignOrderCommand/);
  assert.match(orderCommands, /if \(input\.assignedToId !== undefined && !canAssignOrders\(actor\)\)/);
});
