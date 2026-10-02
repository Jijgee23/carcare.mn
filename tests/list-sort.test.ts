import assert from "node:assert/strict";
import test from "node:test";

test("parseSort whitelists keys and dirs", async () => {
  const { parseSort } = await import("../lib/list-sort");
  const fb = { key: "date", dir: "desc" } as const;
  assert.deepEqual(parseSort({ sort: "amount", dir: "asc" }, ["date", "amount"] as const, fb), { key: "amount", dir: "asc" });
  assert.deepEqual(parseSort({ sort: "evil", dir: "asc" }, ["date", "amount"] as const, fb), fb);
  assert.deepEqual(parseSort({ sort: "amount", dir: "sideways" }, ["date", "amount"] as const, fb), { key: "amount", dir: "desc" });
});

test("toggleSortHref flips direction on the active key and drops page", async () => {
  const { toggleSortHref } = await import("../lib/list-sort");
  const p = new URLSearchParams("q=x&page=3&sort=amount&dir=desc");
  assert.equal(toggleSortHref(p, "amount", { key: "amount", dir: "desc" }), "?q=x&sort=amount&dir=asc");
  assert.equal(toggleSortHref(p, "date", { key: "amount", dir: "desc" }), "?q=x&sort=date&dir=desc");
});

test("formatShortDateTime is compact and Ulaanbaatar-local", async () => {
  const { formatShortDateTime } = await import("../lib/list-sort");
  const now = new Date("2026-10-01T00:00:00Z");
  assert.equal(formatShortDateTime(new Date("2026-09-28T08:43:00Z"), now), "09.28 16:43");
  assert.equal(formatShortDateTime(new Date("2025-12-31T08:00:00Z"), now), "2025.12.31 16:00");
});
