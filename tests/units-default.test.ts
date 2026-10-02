import assert from "node:assert/strict";
import { test } from "node:test";

test("default unit: GOODS → ширхэг, others → хүн/цаг", async () => {
  const { defaultUnitNameFor } = await import("../lib/units");
  assert.equal(defaultUnitNameFor("GOODS"), "ширхэг");
  assert.equal(defaultUnitNameFor("LABOR"), "хүн/цаг");
  assert.equal(defaultUnitNameFor("DIAGNOSTIC"), "хүн/цаг");
});
