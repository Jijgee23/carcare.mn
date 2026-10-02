import assert from "node:assert/strict";
import { test } from "node:test";

test("segments without hours are not shifts", async () => {
  const { rowShiftStats } = await import("../app/dashboard/employees/schedule/schedule-ui");
  const work = { segments: [{ startTime: "09:00", endTime: "18:00" }] };
  const off = { segments: [{ startTime: null, endTime: null }] };
  const stats = rowShiftStats([work, work, work, work, work, off, off]);
  assert.equal(stats.shiftCount, 5);
  assert.equal(stats.hours, 45);
});
