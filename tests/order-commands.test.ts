import assert from "node:assert/strict";
import { before, test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

let commands: typeof import("../lib/orders/order-commands");

before(async () => {
  commands = await import("../lib/orders/order-commands");
});

const actor = {
  id: "staff-a",
  tenantId: "tenant-a",
  isOwner: false,
  branchId: "branch-a",
  assignableBranchIds: ["branch-b"],
  role: { permissions: ["orders.view", "orders.edit", "orders.assign"] },
};

test("status transition matrix accepts only declared transitions", () => {
  assert.equal(commands.isAllowedOrderStatusTransition("SCHEDULED", "IN_PROGRESS"), true);
  assert.equal(commands.isAllowedOrderStatusTransition("IN_PROGRESS", "COMPLETED"), true);
  assert.equal(commands.isAllowedOrderStatusTransition("COMPLETED", "CANCELLED"), false);
  assert.equal(commands.isAllowedOrderStatusTransition("CANCELLED", "SCHEDULED"), false);
  assert.equal(commands.isAllowedOrderStatusTransition("SCHEDULED", "NOT_A_STATUS" as never), false);
});

test("assignment-only and notes-only patches do not represent status changes", () => {
  assert.equal(commands.hasRequestedStatusChange(undefined), false);
  assert.equal(commands.hasRequestedStatusChange(null), false);
  assert.equal(commands.hasRequestedStatusChange("IN_PROGRESS"), true);
});

test("status notifications only target active appointments", () => {
  assert.equal(commands.isActiveOrderNotificationAppointmentStatus("PENDING"), true);
  assert.equal(commands.isActiveOrderNotificationAppointmentStatus("CONFIRMED"), true);
  assert.equal(commands.isActiveOrderNotificationAppointmentStatus("CANCELLED"), false);
  assert.equal(commands.isActiveOrderNotificationAppointmentStatus("REJECTED"), false);
  assert.equal(commands.isActiveOrderNotificationAppointmentStatus("NO_SHOW"), false);
});

test("whole-order cancellation only restores linked PART stock", () => {
  assert.equal(commands.isStockBackedOrderItem("PART", "service-a"), true);
  assert.equal(commands.isStockBackedOrderItem("PART", null), false);
  assert.equal(commands.isStockBackedOrderItem("LABOR", "service-a"), false);
});

test("whole-order cancellation recomputes the order total after cancelling items", () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../lib/orders/order-commands.ts"),
    "utf8",
  );
  const start = source.indexOf('} else if (nextStatus === "CANCELLED")');
  const end = source.indexOf("if (nextStatus != null) await logAudit", start);
  assert.notEqual(start, -1);
  assert.match(source.slice(start, end), /serviceItem\.updateMany/);
  assert.match(source.slice(start, end), /recomputeOrderTotal\(tx, orderId\)/);
});

test("assignment-only commands use assign permission while mixed patches retain edit gating", () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../lib/orders/order-commands.ts"),
    "utf8",
  );
  assert.match(source, /const editsOrderFields = nextStatus != null \|\| input\.notes !== undefined/);
  assert.match(source, /if \(input\.assignedToId !== undefined && !canAssignOrders\(actor\)\)/);
  assert.match(
    source,
    /const editsOrderFields = nextStatus != null \|\| input\.notes !== undefined[\s\S]{0,120}if \(editsOrderFields\) assertCanEdit\(actor, order\);[\s\S]{0,120}if \(input\.assignedToId !== undefined && !canAssignOrders\(actor\)\)/,
  );
});

test("assignment audits keep the committed assignee display name inside the command", () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../lib/orders/order-commands.ts"),
    "utf8",
  );
  assert.match(source, /firstName:\s*true,\s*lastName:\s*true/);
  assert.match(source, /assigneeDisplayName = \[assignee\.lastName, assignee\.firstName\]/);
  assert.match(source, /summary: input\.assignedToId \? `Хариуцагч: \$\{assigneeDisplayName/);
  assert.match(source, /SELECT id, "roleId" FROM "User"[\s\S]*FOR UPDATE/);
});

test("effective working branch scope is enforced", () => {
  const scopedActor = { ...actor, workingBranchId: "branch-a" };
  assert.equal(commands.isOrderBranchInScope(scopedActor, "branch-a"), true);
  assert.equal(commands.isOrderBranchInScope(scopedActor, "branch-b"), false);
  assert.equal(commands.isOrderBranchInScope(scopedActor, "branch-b", "branch-b"), true);
  assert.equal(commands.isOrderBranchInScope(scopedActor, "branch-c", "branch-b"), false);
});

test("assignee must be active, same tenant, assignable and branch eligible", () => {
  const base = {
    isActive: true,
    tenantId: "tenant-a",
    isOwner: false,
    branchId: "branch-a",
    assignableBranchIds: [],
    role: { permissions: ["orders.assignable"] },
  };
  assert.equal(commands.isAssigneeEligible(base, "tenant-a", "branch-a"), true);
  assert.equal(commands.isAssigneeEligible({ ...base, branchId: "branch-b" }, "tenant-a", "branch-a"), false);
  assert.equal(commands.isAssigneeEligible({ ...base, isActive: false }, "tenant-a", "branch-a"), false);
  assert.equal(commands.isAssigneeEligible({ ...base, tenantId: "tenant-b" }, "tenant-a", "branch-a"), false);
  assert.equal(commands.isAssigneeEligible({ ...base, role: { permissions: [] } }, "tenant-a", "branch-a"), false);
  assert.equal(commands.isAssigneeEligible({ ...base, role: { permissions: ["orders.assignable"], isActive: false } }, "tenant-a", "branch-a"), false);
  assert.equal(
    commands.isAssigneeEligible({ ...base, branchId: "branch-b", assignableBranchIds: ["branch-a"] }, "tenant-a", "branch-a"),
    true,
  );
});

test("duration parser rejects malformed and out-of-range values", () => {
  assert.deepEqual(commands.parseCommandDuration(undefined), { ok: true, minutes: null });
  assert.equal(commands.parseCommandDuration(30).ok, true);
  assert.equal(commands.parseCommandDuration(0).ok, false);
  assert.equal(commands.parseCommandDuration(721).ok, false);
  assert.equal(commands.parseCommandDuration(30.5).ok, false);
});

test("action duration adapter preserves hours/minutes validation", () => {
  assert.deepEqual(commands.parseActionDuration("1", "30"), { ok: true, minutes: 90 });
  assert.equal(commands.parseActionDuration("", "").ok, true);
  assert.equal(commands.parseActionDuration("1", "60").ok, false);
});

test("web order mutations lock edit-own and validate assignees in the write transaction", () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../app/_actions/orders.ts"),
    "utf8",
  );
  const createCommandSource = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../lib/orders/order-create-command.ts"),
    "utf8",
  );
  const updateStart = source.indexOf("export async function updateOrderAction");
  const updateBody = source.slice(updateStart, source.indexOf("// --- STATUS CHANGE", updateStart));
  assert.match(updateBody, /assignedToId: true/);
  assert.match(updateBody, /if \(!canEditOrder\(user, fresh\)\)/);
  assert.match(updateBody, /validateOrderAssignee\(tx/);
  assert.match(createCommandSource, /validateOrderAssignee\(scopedTx/);
});

test("clearing and restoring a schedule updates booking rows and capacity", () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../app/_actions/orders.ts"),
    "utf8",
  );
  const updateStart = source.indexOf("export async function updateOrderAction");
  const updateBody = source.slice(updateStart, source.indexOf("// --- STATUS CHANGE", updateStart));
  assert.match(updateBody, /closeOpenOrderTimeBooking\(tx, id, new Date\(\), "SCHEDULED"\)/);
  assert.match(updateBody, /openOrderTimeBooking\(tx, \{/);
  assert.match(updateBody, /occupiesCapacity: data\.scheduledAt != null/);
});

test("bulk assignment requires orders.assign and does not expose unexpected errors", () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../app/_actions/orders.ts"),
    "utf8",
  );
  const start = source.indexOf("export async function bulkAssignOrderAction");
  const body = source.slice(start, source.indexOf("// --- EXPECTED FINISH", start));
  assert.match(body, /authorizeAssign\(\)/);
  assert.doesNotMatch(body, /authorize\("edit"\)/);
  assert.match(body, /Серверийн алдаа гарлаа\./);
});

test("web decimal parsing is strict and caught", () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../app/_actions/orders.ts"),
    "utf8",
  );
  const start = source.indexOf("function parseDecimal");
  const body = source.slice(start, source.indexOf("async function authorize", start));
  assert.match(body, /new Prisma\.Decimal\(cleaned\)/);
  assert.match(body, /try \{/);
  assert.match(body, /catch \{/);
  assert.doesNotMatch(body, /Number\.parseFloat/);
});
