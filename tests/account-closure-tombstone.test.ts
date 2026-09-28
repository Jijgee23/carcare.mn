import assert from "node:assert/strict";
import { test } from "node:test";
import { accountTombstone, userTombstone, isTombstonePhone } from "../lib/account-closure/tombstone";

const now = new Date("2026-09-28T00:00:00Z");

test("accountTombstone frees the phone and scrubs PII", () => {
  const t = accountTombstone("acc1", now);
  assert.equal(t.phone, "deleted:acc1");
  assert.equal(t.name, null);
  assert.equal(t.email, null);
  assert.equal(t.avatarUrl, null);
  assert.equal(t.isActive, false);
  assert.equal(t.deletedAt, now);
  assert.equal(t.deactivatedAt, null);
  assert.ok(isTombstonePhone(t.phone));
  assert.ok(!isTombstonePhone("99112233"));
});

test("userTombstone scrubs PII and credentials", () => {
  const t = userTombstone("u1", now);
  assert.equal(t.email, "deleted+u1@deleted.invalid");
  assert.equal(t.phone, "deleted:u1");
  assert.equal(t.firstName, "Устгагдсан");
  assert.equal(t.lastName, "ажилтан");
  assert.equal(t.passwordHash, null);
  assert.equal(t.verified, false);
  assert.equal(t.isActive, false);
  assert.equal(t.roleId, null);
  assert.equal(t.deletedAt, now);
});
