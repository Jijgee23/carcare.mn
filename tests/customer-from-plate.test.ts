import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

// Route modules import `server-only` (not resolvable under plain tsx), so —
// matching tests/customers-list-route.test.ts — these are source assertions.

const read = (p: string) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

test("shared fn: rate limit -> resolve owner -> command, in that order", async () => {
  const src = await read("lib/customers/customer-from-plate.ts");
  const rl = src.indexOf("consumeRateLimit(`hur:${input.actor.id}`");
  const resolve = src.indexOf("resolveOwnerForPlate(");
  const cmd = src.indexOf("createCustomerCommand(");
  assert.ok(rl > 0 && resolve > rl && cmd > resolve);
  assert.match(src, /limit: 20, windowMs: 60_000/);
  assert.match(src, /429,\s*\n?\s*"RATE_LIMITED"/);
  assert.match(src, /404, "OWNER_NOT_FOUND"/);
  assert.match(src, /502, "HUR_UPSTREAM"/);
});

test("route and dashboard action both use the shared function", async () => {
  const route = await read("app/api/v1/customers/from-plate/route.ts");
  const action = await read("app/_actions/quick-create.ts");
  assert.match(route, /createCustomerFromPlate\(/);
  assert.match(action, /createCustomerFromPlate\(/);
  assert.doesNotMatch(action, /resolveOwnerForPlate|consumeRateLimit/);
  assert.match(route, /requirePermission\(auth\.user, "customers\.create"\)/);
  assert.match(route, /requireActiveSubscriptionApi/);
  assert.match(route, /export async function POST/);
  assert.match(route, /fieldErrors: \{ plate:/);
});

test("vehicles POST passes fromLookup as resolveOwnerRegnum", async () => {
  const src = await read("app/api/v1/vehicles/route.ts");
  assert.match(src, /resolveOwnerRegnum: fromLookup === true/);
});
