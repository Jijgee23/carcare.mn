import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

function selectBody(source: string, name: string) {
  const match = source.match(
    new RegExp(`const ${name} = \\{([\\s\\S]*?)\\} satisfies Prisma\\.ServiceOrderSelect;`),
  );
  assert.ok(match, `expected ${name} to be declared as a ServiceOrderSelect`);
  return match[1];
}

test("orders list and detail responses select scheduling fields", async () => {
  const list = await readFile(new URL("../app/api/v1/orders/route.ts", import.meta.url), "utf8");
  const detail = await readFile(new URL("../app/api/v1/orders/[id]/route.ts", import.meta.url), "utf8");

  for (const [label, source, name] of [
    ["orders list", list, "ORDER_SELECT"],
    ["order detail", detail, "ORDER_DETAIL_SELECT"],
  ] as const) {
    const select = selectBody(source, name);
    assert.match(select, /expectedFinishAt:\s*true/, `${label} must expose expectedFinishAt`);
    assert.match(select, /estimatedDurationMinutes:\s*true/, `${label} must expose estimatedDurationMinutes`);
  }
});

test("order detail item responses pin lifecycle, cancellation, and diagnostic links", async () => {
  const detail = await readFile(new URL("../app/api/v1/orders/[id]/route.ts", import.meta.url), "utf8");
  const select = selectBody(detail, "ORDER_DETAIL_SELECT");
  for (const field of [
    "startedAt",
    "completedAt",
    "cancelledAt",
    "cancelledById",
    "diagnosticTemplateId",
    "diagnosticReportId",
  ]) {
    assert.match(select, new RegExp(`items:[\\s\\S]*?${field}:\\s*true`), `detail items must expose ${field}`);
  }
  assert.match(
    select,
    /items:[\s\S]*?cancelledBy:\s*\{\s*select:\s*\{\s*id:\s*true,\s*firstName:\s*true,\s*lastName:\s*true\s*\}/,
    "detail items must expose minimal cancellation actor identity",
  );
});

test("legacy payment response keeps detail scheduling fields and item status", async () => {
  const payment = await readFile(
    new URL("../app/api/v1/orders/[id]/payment/route.ts", import.meta.url),
    "utf8",
  );
  const select = selectBody(payment, "ORDER_DETAIL_SELECT");
  assert.match(select, /expectedFinishAt:\s*true/);
  assert.match(select, /estimatedDurationMinutes:\s*true/);
  assert.match(
    select,
    /items:\s*\{[\s\S]*?select:\s*\{[\s\S]*?status:\s*true[\s\S]*?\}\s*,?\s*\}/,
    "legacy payment item responses must include status",
  );
});
