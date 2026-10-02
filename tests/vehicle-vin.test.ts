import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

test("VIN: 17-char ISO or 13-char Japanese frame number", async () => {
  const { isValidVin } = await import("../lib/vehicles");
  assert.equal(isValidVin("JTDBR32E720123456"), true); // 17
  assert.equal(isValidVin("NZE121-1234567"), true); // frame no. with dash
  assert.equal(isValidVin("NZE1211234567"), true); // 13
  assert.equal(isValidVin("ZVW30-1234567"), true);
  assert.equal(isValidVin("GRS1800001234"), true);
  assert.equal(isValidVin("AB-12"), false);
  assert.equal(isValidVin("A-B-C1234567"), false);
  assert.equal(isValidVin("ABC"), false);
  assert.equal(isValidVin("JTDBR32E72012345I"), false); // I/O/Q not allowed in 17-char VIN
});
