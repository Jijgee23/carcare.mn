import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

import { buildAppointmentBookedByStaffBody } from "../lib/appointments/appointment-booked-by-staff-notification";

test("buildAppointmentBookedByStaffBody: branch name + Asia/Ulaanbaatar date/time, Mongolian wording", () => {
  // 2026-09-28T00:00:00Z is 2026-09-28 08:00 in Asia/Ulaanbaatar (UTC+8).
  const requestedAt = new Date("2026-09-28T00:00:00.000Z");
  const body = buildAppointmentBookedByStaffBody("Толгойт салбар", requestedAt);
  assert.equal(body, "Толгойт салбар таны нэр дээр 2026.09.28 08:00-д цаг бүртгэлээ.");
});

test("buildAppointmentBookedByStaffBody: uses the explicit business time zone regardless of host TZ", () => {
  const originalTz = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const requestedAt = new Date("2026-09-28T00:00:00.000Z");
    const body = buildAppointmentBookedByStaffBody("Хан-Уул салбар", requestedAt);
    assert.match(body, /08:00/);
  } finally {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  }
});
