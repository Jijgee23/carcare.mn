import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

test("payment amount parser preserves decimal text and rejects binary/invalid inputs", async () => {
  const commands = await import("../lib/orders/order-payment-commands");
  assert.equal(commands.parseOrderPaymentAmount("1,234.50")?.toString(), "1234.5");
  assert.equal(commands.parseOrderPaymentAmount("0.01")?.toString(), "0.01");
  assert.equal(commands.parseOrderPaymentAmount("1.234"), null);
  assert.equal(commands.parseOrderPaymentAmount("-1"), null);
  assert.equal(commands.parseOrderPaymentAmount("NaN"), null);
  assert.equal(commands.parseOrderPaymentAmount(0.1), null);
});

test("QPay number boundary only accepts exact two-decimal values", async () => {
  const commands = await import("../lib/orders/order-payment-commands");
  const Decimal = (await import("../app/generated/prisma/client")).Prisma.Decimal;
  assert.equal(commands.decimalToQPayAmount(new Decimal("0.01")), 0.01);
  assert.equal(commands.decimalToQPayAmount(new Decimal("9999999999.99")), 9999999999.99);
  assert.throws(() => commands.decimalToQPayAmount(new Decimal("1.001")), /Дүнг зөв оруулна уу/);
  assert.throws(() => commands.decimalToQPayAmount(new Decimal("10000000000")), /Дүнг зөв оруулна уу/);
});

test("payment method parser keeps the supported ledger enum boundary", async () => {
  const commands = await import("../lib/orders/order-payment-commands");
  assert.equal(commands.isOrderPaymentMethod("CASH"), true);
  assert.equal(commands.isOrderPaymentMethod("CARD"), true);
  assert.equal(commands.isOrderPaymentMethod("OTHER"), true);
  assert.equal(commands.isOrderPaymentMethod("PAYPAL"), false);
  assert.equal(commands.isOrderPaymentMethod(null), false);
});

test("payment adapters route mutations through the ledger core and working-branch resolver", async () => {
  const legacy = await readFile(new URL("../app/api/v1/orders/[id]/payment/route.ts", import.meta.url), "utf8");
  const qpay = await readFile(new URL("../app/api/v1/orders/[id]/qpay/route.ts", import.meta.url), "utf8");
  const qpayCheck = await readFile(new URL("../app/api/v1/orders/[id]/qpay/check/route.ts", import.meta.url), "utf8");
  assert.match(legacy, /createOrderPaymentCommand/);
  assert.doesNotMatch(legacy, /serviceOrder\.update/);
  assert.match(qpay, /resolveWorkingBranch/);
  assert.match(qpayCheck, /resolveWorkingBranch/);
  assert.match(qpayCheck, /confirmOrderQPayPaymentCommand/);

  const qpayGet = qpay.slice(qpay.indexOf("export async function GET"), qpay.indexOf("export async function POST"));
  assert.match(qpayGet, /const denied = requirePermission\(auth\.user, "payments\.view"\)/);
  assert.ok(qpayGet.indexOf('requirePermission(auth.user, "payments.view")') < qpayGet.indexOf("resolveWorkingBranch"));
});

test("legacy payment adapter separates creation and reversal permissions", async () => {
  const legacy = await readFile(new URL("../app/api/v1/orders/[id]/payment/route.ts", import.meta.url), "utf8");
  assert.match(legacy, /requiredPermission = b\.paymentStatus === "UNPAID" \? "payments\.delete" : "payments\.create"/);
  assert.doesNotMatch(legacy, /requirePermission\(auth\.user, "payments\.edit"\)/);
});

test("QPay command and actions preserve provider/control-flow safety guards", async () => {
  const commands = await readFile(new URL("../lib/orders/order-payment-commands.ts", import.meta.url), "utf8");
  const actions = await readFile(new URL("../app/_actions/order-payments.ts", import.meta.url), "utf8");
  const qpayCore = await readFile(new URL("../lib/qpay-core.ts", import.meta.url), "utf8");
  assert.match(commands, /payment\.method !== "QPAY"/);
  assert.match(commands, /fresh\.method !== "QPAY"/);
  assert.match(commands, /getInvoiceUrls/);
  assert.match(commands, /amount: decimalToQPayAmount\(remaining\)/);
  assert.match(commands, /checkPaymentExact\(input\.actor\.tenantId, preflight\.payment\.qpayInvoiceId, preflight\.payment\.amount\.toString\(\)\)/);
  assert.match(commands, /newlyPaid: false/);
  assert.match(commands, /newlyPaid: !result\.already/);
  assert.match(actions, /unstable_rethrow\(error\)/);
  assert.match(actions, /if \(result\.newlyPaid\) await notifyOrderPaymentReceived/);
  const qpayCheck = await readFile(new URL("../app/api/v1/orders/[id]/qpay/check/route.ts", import.meta.url), "utf8");
  assert.match(qpayCheck, /if \(result\.newlyPaid\) await notifyOrderPaymentReceived/);
  assert.match(qpayCore, /checkPaymentExact/);
  assert.doesNotMatch(qpayCore, /parseFloat/);
});
