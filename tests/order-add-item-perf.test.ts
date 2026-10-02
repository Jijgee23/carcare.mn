import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

test("addOrderItemAction does not invalidate the whole services layout", () => {
  const src = readFileSync("app/_actions/orders.ts", "utf8");
  const start = src.indexOf("export async function addOrderItemAction");
  assert.ok(start >= 0);
  const next = src.indexOf("export async function", start + 10);
  const body = src.slice(start, next === -1 ? undefined : next);
  assert.ok(!body.includes('revalidatePath("/dashboard/services", "layout")'));
  assert.ok(body.includes("/dashboard/services/goods"));
  // labor/diagnostic lines change the "used" count shown on the labor list
  assert.ok(body.includes("/dashboard/services/labor"));
  assert.ok(!/created\.kind === "PART"\) \{\s*revalidatePath\(`\/dashboard\/services\/\$\{created/.test(body));
});
