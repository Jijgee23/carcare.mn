import assert from "node:assert/strict";
import { test } from "node:test";
import { maskOwnerPhone } from "../lib/pii-mask";

test("keeps first 2 and last 2 digits", () => {
  assert.equal(maskOwnerPhone("99385882"), "99••••82");
});

test("strips non-digits and masks the middle of longer numbers", () => {
  assert.equal(maskOwnerPhone("+976 9938-5882"), "97•••••••82");
});

test("short input is fully hidden, never echoed", () => {
  assert.equal(maskOwnerPhone("1234"), "••••");
  assert.equal(maskOwnerPhone("12"), "••");
  assert.equal(maskOwnerPhone("12345"), "•••••");
  assert.equal(maskOwnerPhone("123456"), "••••••");
  assert.equal(maskOwnerPhone("1234567"), "12•••67");
});

test("empty / nullish input yields empty string", () => {
  assert.equal(maskOwnerPhone(""), "");
  assert.equal(maskOwnerPhone(null), "");
  assert.equal(maskOwnerPhone(undefined), "");
  assert.equal(maskOwnerPhone("abc"), "");
});
