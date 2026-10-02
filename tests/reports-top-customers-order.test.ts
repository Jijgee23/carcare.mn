import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("top customers groupBy excludes null sums and breaks ties by customerId", () => {
  const src = readFileSync("lib/reports.ts", "utf8");
  const start = src.indexOf('by: ["customerId"]');
  assert.ok(start >= 0);
  const body = src.slice(start, src.indexOf("take: 5", start));
  assert.match(body, /totalAmount: \{ not: null \}/);
  assert.match(body, /_sum: \{ totalAmount: "desc" \}/);
  assert.match(body, /customerId: "asc"/);
});

test("job durations exclude zero-minute (pending->completed) rows in both averages", () => {
  const src = readFileSync("lib/reports.ts", "utf8");
  assert.match(src, /\.filter\(\(mins\) => mins > 0\)/);
  assert.match(src, /if \(mins <= 0\) continue;/);
  assert.doesNotMatch(src, /mins >= 0/);
});
