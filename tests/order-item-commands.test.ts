import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

test("item decimal parser accepts exact finite non-negative decimals only", async () => {
  const commands = await import("../lib/orders/order-item-commands");
  assert.equal(commands.parseOrderItemDecimal("1,000"), null);
  assert.equal(commands.parseOrderItemDecimal("12.50")?.toString(), "12.5");
  assert.equal(commands.parseOrderItemDecimal("0")?.toString(), "0");
  assert.equal(commands.parseOrderItemDecimal("-1"), null);
  assert.equal(commands.parseOrderItemDecimal("Infinity"), null);
  assert.equal(commands.parseOrderItemDecimal({}), null);
  assert.equal(commands.parseOrderItemDecimal("1.234", 3)?.toString(), "1.234");
  assert.equal(commands.parseOrderItemDecimal("1.2345", 3), null);
  assert.equal(commands.parseOrderItemDecimal("12.34", 2)?.toString(), "12.34");
  assert.equal(commands.parseOrderItemDecimal("12.345", 2), null);
  assert.equal(commands.roundItemTotal(commands.parseOrderItemDecimal("1.005")!, commands.parseOrderItemDecimal("1")!).toString(), "1.01");
  assert.equal(commands.roundItemTotal(commands.parseOrderItemDecimal("1.004")!, commands.parseOrderItemDecimal("1")!).toString(), "1");
  const overflow = commands.roundItemTotal(commands.parseOrderItemDecimal("9999999999.995")!, commands.parseOrderItemDecimal("1")!);
  assert.equal(overflow.toString(), "10000000000");
  assert.equal(overflow.gt(commands.MAX_SERVICE_ORDER_TOTAL), true);
  commands.assertServiceOrderTotal(commands.MAX_SERVICE_ORDER_TOTAL);
  assert.throws(
    () => commands.assertServiceOrderTotal(overflow),
    (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "ORDER_TOTAL_TOO_LARGE",
  );
});

test("item status changes require an in-progress parent order", async () => {
  const commands = await import("../lib/orders/order-item-commands");
  assert.doesNotThrow(() => commands.assertOrderInProgressForItemStatus("IN_PROGRESS"));
  assert.throws(
    () => commands.assertOrderInProgressForItemStatus("SCHEDULED"),
    (error: unknown) => typeof error === "object" && error !== null
      && "code" in error && error.code === "ORDER_STATUS_INVALID"
      && "status" in error && error.status === 422,
  );
});

test("history pagination parser is strict, bounded, and safe", async () => {
  const commands = await import("../lib/orders/order-item-commands");
  assert.equal(commands.parseItemHistoryInteger(null, 1, commands.MAX_ITEM_HISTORY_PAGE), 1);
  assert.equal(commands.parseItemHistoryInteger("1e3", 1, commands.MAX_ITEM_HISTORY_PAGE), null);
  assert.equal(commands.parseItemHistoryInteger("0", 1, commands.MAX_ITEM_HISTORY_PAGE), null);
  assert.equal(commands.parseItemHistoryInteger(String(commands.MAX_ITEM_HISTORY_PAGE), 1, commands.MAX_ITEM_HISTORY_PAGE), commands.MAX_ITEM_HISTORY_PAGE);
  assert.equal(commands.parseItemHistoryInteger(String(commands.MAX_ITEM_HISTORY_PAGE + 1), 1, commands.MAX_ITEM_HISTORY_PAGE), null);
  const safeSkip = (commands.MAX_ITEM_HISTORY_PAGE - 1) * commands.MAX_ITEM_HISTORY_PAGE_SIZE;
  assert.equal(Number.isSafeInteger(safeSkip), true);
  assert.equal(safeSkip <= commands.MAX_ITEM_HISTORY_SKIP, true);
});

test("catalog-backed item kinds cannot be changed away from their stock semantics", async () => {
  const commands = await import("../lib/orders/order-item-commands");
  assert.equal(commands.isOrderItemKindCompatibleWithService("PART", "GOODS"), true);
  assert.equal(commands.isOrderItemKindCompatibleWithService("LABOR", "GOODS"), false);
  assert.equal(commands.isOrderItemKindCompatibleWithService("LABOR", "LABOR"), true);
  assert.equal(commands.isOrderItemKindCompatibleWithService("FEE", null), true);
});

test("item command source locks the order for every mutation", () => {
  const source = readFileSync(new URL("../lib/orders/order-item-commands.ts", import.meta.url), "utf8");
  for (const name of [
    "addOrderItemCommand",
    "updateOrderItemCommand",
    "cancelOrderItemCommand",
    "changeOrderItemStatusCommand",
    "changeOrderItemPriceCommand",
  ]) {
    const start = source.indexOf(`export async function ${name}`);
    assert.notEqual(start, -1, `${name} must exist`);
    const end = source.indexOf("export async function", start + 10);
    const block = source.slice(start, end === -1 ? source.length : end);
    assert.match(block, /withOrderTransaction\(/, `${name} must use the shared order lock`);
  }
});

test("web and API item adapters delegate instead of opening their own transactions", () => {
  const actionSource = readFileSync(new URL("../app/_actions/orders.ts", import.meta.url), "utf8");
  const itemRoute = readFileSync(new URL("../app/api/v1/orders/[id]/items/[itemId]/route.ts", import.meta.url), "utf8");
  const addRoute = readFileSync(new URL("../app/api/v1/orders/[id]/items/route.ts", import.meta.url), "utf8");
  assert.match(actionSource, /addOrderItemCommand\(/);
  assert.match(actionSource, /cancelOrderItemCommand\(/);
  assert.match(actionSource, /changeOrderItemStatusCommand\(/);
  assert.match(actionSource, /changeOrderItemPriceCommand\(/);
  assert.doesNotMatch(actionSource.slice(actionSource.indexOf("export async function addOrderItemAction")), /prisma\.\$transaction/);
  assert.match(itemRoute, /updateOrderItemCommand\(/);
  assert.match(itemRoute, /cancelOrderItemCommand\(/);
  assert.match(addRoute, /addOrderItemCommand\(/);
});

test("web item add/cancel revalidate the committed service catalog identity", () => {
  const source = readFileSync(new URL("../app/_actions/orders.ts", import.meta.url), "utf8");
  assert.match(source, /const created = await addOrderItemCommand\(/);
  assert.match(source, /const cancelled = await cancelOrderItemCommand\(/);
  assert.match(source, /if \(created\.serviceId\) \{[\s\S]*revalidatePath\("\/dashboard\/services", "layout"\)/);
  assert.match(source, /if \(cancelled\.serviceId\) \{[\s\S]*revalidatePath\(`\/dashboard\/services\/\$\{cancelled\.serviceId\}`\)/);
  assert.match(readFileSync(new URL("../lib/orders/order-item-commands.ts", import.meta.url), "utf8"), /return \{ itemId, serviceId: item\.serviceId, total \}/);
});

test("web price action keeps the legacy strictly-positive gate while commands allow free catalog items", () => {
  const source = readFileSync(new URL("../app/_actions/orders.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function changeOrderItemPriceAction");
  assert.notEqual(start, -1);
  const body = source.slice(start);
  assert.match(body, /!unitPrice \|\| unitPrice\.lte\(0\)/);
  const commandSource = readFileSync(new URL("../lib/orders/order-item-commands.ts", import.meta.url), "utf8");
  assert.match(commandSource, /input\.unitPrice\.lt\(0\)/);
});

test("same-price item commands return before update, audit, and total recomputation", () => {
  const source = readFileSync(new URL("../lib/orders/order-item-commands.ts", import.meta.url), "utf8");
  assert.match(source, /if \(unitPrice\.equals\(item\.unitPrice\)\) return item;/);
  assert.match(source, /const priceChanged = hasPrice && !input\.unitPrice!\.equals\(existing\.unitPrice\);/);
  assert.match(source, /if \(!hasDetails && !priceChanged && !hasStatus\) return existing;/);
});

test("every nested item route resolves the working branch and passes that scope", () => {
  const routePaths = [
    "../app/api/v1/orders/[id]/items/route.ts",
    "../app/api/v1/orders/[id]/items/[itemId]/route.ts",
    "../app/api/v1/orders/[id]/items/[itemId]/cancel/route.ts",
    "../app/api/v1/orders/[id]/items/[itemId]/status/route.ts",
    "../app/api/v1/orders/[id]/items/[itemId]/price/route.ts",
    "../app/api/v1/orders/[id]/items/history/route.ts",
  ];
  for (const relative of routePaths) {
    const source = readFileSync(new URL(relative, import.meta.url), "utf8");
    assert.match(source, /resolveWorkingBranch\(req, auth\.user\)/, relative);
    assert.match(source, /scopeResult\.branchId/, relative);
    assert.doesNotMatch(source, /branchScopeId\(/, relative);
  }
});

test("generic PATCH delegates mixed fields to one atomic command", () => {
  const routeSource = readFileSync(new URL("../app/api/v1/orders/[id]/items/[itemId]/route.ts", import.meta.url), "utf8");
  const commandSource = readFileSync(new URL("../lib/orders/order-item-commands.ts", import.meta.url), "utf8");
  assert.equal((routeSource.match(/patchOrderItemCommand\(/g) ?? []).length, 1);
  assert.doesNotMatch(routeSource, /changeOrderItem(Status|Price)Command\(/);
  const start = commandSource.indexOf("export async function patchOrderItemCommand");
  assert.notEqual(start, -1);
  const end = commandSource.indexOf("export async function cancelOrderItemCommand", start);
  const block = commandSource.slice(start, end);
  assert.equal((block.match(/withOrderTransaction\(/g) ?? []).length, 1);
  assert.doesNotMatch(block, /updateOrderItemCommand\(|changeOrderItem(Status|Price)Command\(/);
  assert.match(block, /ITEM_STATUS_FORBIDDEN/);
  assert.match(block, /ITEM_PRICE_FORBIDDEN/);
  assert.match(block, /ORDER_OUT_OF_SCOPE/);
});

test("generic PATCH rejects status changes unless the locked parent order is in progress", () => {
  const source = readFileSync(new URL("../lib/orders/order-item-commands.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function patchOrderItemCommand");
  const end = source.indexOf("export async function cancelOrderItemCommand", start);
  const block = source.slice(start, end);
  assert.match(block, /if \(hasStatus\) assertOrderInProgressForItemStatus\(order\.status\);/);
});

test("generic PATCH has an explicit closed key set and rejects empty/unknown payloads", () => {
  const routeSource = readFileSync(new URL("../app/api/v1/orders/[id]/items/[itemId]/route.ts", import.meta.url), "utf8");
  const commandSource = readFileSync(new URL("../lib/orders/order-item-commands.ts", import.meta.url), "utf8");
  assert.match(commandSource, /ORDER_ITEM_PATCH_KEYS = \["kind", "description", "quantity", "unitPrice", "status"\]/);
  assert.match(routeSource, /keys\.length === 0/);
  assert.match(routeSource, /unknownKeys\.length > 0/);
  assert.match(routeSource, /ITEM_PATCH_EMPTY/);
  assert.match(routeSource, /ITEM_PATCH_FIELDS_INVALID/);
  assert.match(commandSource, /ROUND_HALF_UP/);
  assert.match(commandSource, /ORDER_TOTAL_TOO_LARGE/);
});

test("item add ignores a client price unless the actor holds orders.itemPrice", () => {
  const source = readFileSync(new URL("../lib/orders/order-item-commands.ts", import.meta.url), "utf8");
  const add = source.slice(source.indexOf("export async function addOrderItemCommand"));
  assert.match(add, /const canSetPrice = canChangeOrderItemPrice\(actor, order\);/);
  assert.match(add, /let unitPrice = canSetPrice \? \(input\.unitPrice \?\? null\) : null;/);
  assert.match(add, /!canSetPrice && !serviceId && !diagnosticTemplateId[\s\S]*ITEM_PRICE_FORBIDDEN/);
  assert.ok(add.indexOf("canSetPrice") < add.indexOf("unitPrice ??= service.price"));
});
