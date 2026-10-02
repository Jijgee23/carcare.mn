import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = readFileSync(
  new URL("../app/api/v1/app/appointments/route.ts", import.meta.url),
  "utf8",
);

test("GET appointments selects intakeRecordedAt for both order shapes", () => {
  assert.equal(src.match(/intakeRecordedAt: true/g)?.length, 2);
  assert.ok(!/intakePhotos|intakeNotes/.test(src), "must not select intake photos/notes");
});

test("serviceOrder and walk-in shapes emit hasIntake", () => {
  assert.match(src, /hasIntake: a\.serviceOrder\.intakeRecordedAt != null/);
  assert.match(src, /hasIntake: o\.intakeRecordedAt != null/);
});
