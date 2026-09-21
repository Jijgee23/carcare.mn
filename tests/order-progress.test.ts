import assert from "node:assert/strict";
import test from "node:test";
import { summarizeOrderProgress } from "../lib/orders/order-progress";

test("counts actionable items and completed work", () => {
  assert.deepEqual(
    summarizeOrderProgress([
      { kind: "LABOR", status: "COMPLETED" },
      { kind: "DIAGNOSTIC", status: "IN_PROGRESS" },
      { kind: "FEE", status: "PENDING" },
    ]),
    { total: 3, completed: 1 },
  );
});

test("excludes parts and cancelled items from both counts", () => {
  assert.deepEqual(
    summarizeOrderProgress([
      { kind: "PART", status: "COMPLETED" },
      { kind: "PART", status: "CANCELLED" },
      { kind: "LABOR", status: "CANCELLED" },
      { kind: "DIAGNOSTIC", status: "COMPLETED" },
    ]),
    { total: 1, completed: 1 },
  );
});

test("returns zeroes for an order with no actionable items", () => {
  assert.deepEqual(
    summarizeOrderProgress([
      { kind: "PART", status: "PENDING" },
      { kind: "LABOR", status: "CANCELLED" },
    ]),
    { total: 0, completed: 0 },
  );
});
