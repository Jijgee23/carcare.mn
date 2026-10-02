import { test } from "node:test";
import assert from "node:assert/strict";
import { intakeStagingSubdir } from "../lib/orders/order-intake";
import { isOwnStagedIntakePath } from "../lib/orders/order-intake-server";

const T = "tenant_1";
const U = "user_1";
const good = `/uploads/${intakeStagingSubdir(T, U)}/${"a".repeat(24)}.jpg`;

test("accepts a file saveUpload put in the user's own staging dir", () => {
  assert.equal(isOwnStagedIntakePath(good, T, U), true);
});

test("rejects another user's or tenant's staged file", () => {
  assert.equal(isOwnStagedIntakePath(good, T, "user_2"), false);
  assert.equal(isOwnStagedIntakePath(good, "tenant_2", U), false);
});

test("rejects traversal, foreign dirs and odd file names", () => {
  assert.equal(isOwnStagedIntakePath(`/uploads/${intakeStagingSubdir(T, U)}/../x/${"a".repeat(24)}.jpg`, T, U), false);
  assert.equal(isOwnStagedIntakePath(`/uploads/logos/${"a".repeat(24)}.jpg`, T, U), false);
  assert.equal(isOwnStagedIntakePath(`/uploads/${intakeStagingSubdir(T, U)}/evil.svg`, T, U), false);
  assert.equal(isOwnStagedIntakePath(good, "../x", U), false);
});
