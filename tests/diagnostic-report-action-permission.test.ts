import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Web hardening S2 / K2. A standalone (no orderId) diagnostic report on the web
// must require diagnostics.create, like mobile POST /diagnostics/reports.
// Order-linked reports stay gated by canEditOrder.

const source = readFileSync(new URL("../app/_actions/diagnostic-reports.ts", import.meta.url), "utf8");
const action = source.slice(source.indexOf("export async function createReportAction"));

test("standalone report creation checks diagnostics.create before any DB work", () => {
  const gate = action.search(/if \(!orderId && !canCreatePerm\(user, "diagnostics"\)\)/);
  const firstQuery = action.indexOf("prisma.");
  assert.ok(gate > 0, "standalone permission gate is present");
  assert.ok(firstQuery > gate, "gate runs before the first query");
});

test("order-linked report creation keeps the canEditOrder gate", () => {
  assert.match(action, /if \(!canEditOrder\(user, order\)\)/);
});
