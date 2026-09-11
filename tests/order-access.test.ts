import assert from "node:assert/strict";
import test from "node:test";
import {
  canAssignOrders,
  canChangeOrderItemStatus,
  canEditOrder,
  canViewOrder,
  orderEditScope,
  orderReadWhere,
  orderViewScope,
  type OrderAccessUser,
} from "../lib/auth/order-access";

const order = (assignedToId: string | null) => ({ assignedToId });
const user = (permissions: string[] = [], isOwner = false): OrderAccessUser => ({
  id: "u1",
  isOwner,
  role: { permissions },
});

test("owner has branch view/edit and assignment access", () => {
  const me = user([], true);
  assert.equal(orderViewScope(me), "branch");
  assert.equal(orderEditScope(me), "branch");
  assert.equal(canViewOrder(me, order(null)), true);
  assert.equal(canEditOrder(me, order("other")), true);
  assert.equal(canAssignOrders(me), true);
  assert.equal(canAssignOrders(user(["orders.assignable"])), false);
  assert.equal(canAssignOrders(user(["orders.assign"])), true);
});

test("no role has no order access and returns an empty read filter", () => {
  const me = { id: "u1", isOwner: false, role: null };
  assert.equal(orderViewScope(me), "none");
  assert.equal(orderEditScope(me), "none");
  assert.deepEqual(orderReadWhere(me), { id: { in: [] } });
  assert.equal(canViewOrder(me, order("u1")), false);
  assert.equal(canEditOrder(me, order("u1")), false);
});

test("own view/edit only matches assigned orders", () => {
  const me = user(["orders.viewOwn", "orders.editOwn"]);
  assert.equal(orderViewScope(me), "own");
  assert.equal(orderEditScope(me), "own");
  assert.deepEqual(orderReadWhere(me), { assignedToId: "u1" });
  assert.equal(canViewOrder(me, order("u1")), true);
  assert.equal(canViewOrder(me, order(null)), false);
  assert.equal(canEditOrder(me, order("other")), false);
});

test("legacy view/edit permissions remain branch-wide", () => {
  const me = user(["orders.view", "orders.edit"]);
  assert.equal(orderViewScope(me), "branch");
  assert.equal(orderEditScope(me), "branch");
  assert.deepEqual(orderReadWhere(me), {});
  assert.equal(canViewOrder(me, order(null)), true);
});

test("edit is clamped by view and cannot exceed it", () => {
  const editOnly = user(["orders.edit"]);
  assert.equal(orderViewScope(editOnly), "none");
  assert.equal(orderEditScope(editOnly), "none");
  const ownViewBranchEdit = user(["orders.viewOwn", "orders.edit"]);
  assert.equal(orderViewScope(ownViewBranchEdit), "own");
  assert.equal(orderEditScope(ownViewBranchEdit), "own");
  assert.equal(canEditOrder(ownViewBranchEdit, order("other")), false);
});

test("item status requires standalone permission and effective edit access", () => {
  const me = user(["orders.viewOwn", "orders.itemStatus"]);
  assert.equal(canChangeOrderItemStatus(me, order("u1")), false);
  const editor = user(["orders.viewOwn", "orders.editOwn", "orders.itemStatus"]);
  assert.equal(canChangeOrderItemStatus(editor, order("u1")), true);
  assert.equal(canChangeOrderItemStatus(editor, order("other")), false);
});
