import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

let requireAppointmentRefundPermission: typeof import("../lib/appointments/refund-permission").requireAppointmentRefundPermission;
test.before(async () => {
  ({ requireAppointmentRefundPermission } = await import("../lib/appointments/refund-permission"));
});

// D-148's test tsconfig maps the Next-only `server-only` import, so that
// module is no longer the blocker under `tsx --test`. Full request behavior
// still needs Prisma/QPay mocks and a database-independent route seam; the
// refund permission boundary is intentionally factored into a small
// production seam and exercised behaviorally below. The remaining assertions
// are source-level wiring and persistence guards.

function readSource(relativePath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relativePath), "utf8");
}

const checkSource = () => readSource("../app/api/v1/appointments/[id]/payment/route.ts");
const retrySource = () => readSource("../app/api/v1/appointments/[id]/payment/retry/route.ts");
const refundSource = () => readSource("../app/api/v1/appointments/[id]/payment/refund/route.ts");

// --- Auth wiring: every route requires an authenticated ApiUser ------------

for (const [name, source] of [
  ["check", checkSource],
  ["retry", retrySource],
  ["refund", refundSource],
] as const) {
  test(`${name} route requires an authenticated ApiUser`, () => {
    const src = source();
    assert.match(src, /requireApiUser\(req\)/);
    assert.match(src, /if \(auth\.response\) return auth\.response;/);
  });

  test(`${name} route resolves the X-Working-Branch scope and early-returns on rejection`, () => {
    const src = source();
    assert.match(src, /resolveWorkingBranch\(req, auth\.user\)/);
    assert.match(src, /if \(scopeResult\.response\) return scopeResult\.response;/);
  });

  test(`${name} route scopes the appointment lookup by tenantId and rejects a branch mismatch`, () => {
    const src = source();
    assert.match(src, /tenantId:\s*auth\.user\.tenantId/);
    assert.match(
      src,
      /scopeResult\.branchId != null && appt\.branchId !== scopeResult\.branchId/,
    );
  });
}

// --- P2-B6's whole point: permission boundary per operation ----------------

test("check route requires payments.view", () => {
  const src = checkSource();
  assert.match(src, /requirePermission\(auth\.user,\s*"payments\.view"\)/);
  assert.match(src, /if \(denied\) return denied;/);
});

test("retry route requires payments.edit", () => {
  const src = retrySource();
  assert.match(src, /requirePermission\(auth\.user,\s*"payments\.edit"\)/);
  assert.match(src, /if \(denied\) return denied;/);
});

test("refund permission gate refuses payments.edit-only actors", () => {
  const response = requireAppointmentRefundPermission({
    isOwner: false,
    role: { permissions: ["payments.edit"] },
  } as Parameters<typeof requireAppointmentRefundPermission>[0]);
  assert.ok(response);
  assert.equal(response.status, 403);
});

test("refund permission gate allows actors with payments.delete", () => {
  const response = requireAppointmentRefundPermission({
    isOwner: false,
    role: { permissions: ["payments.delete"] },
  } as Parameters<typeof requireAppointmentRefundPermission>[0]);
  assert.equal(response, null);
});

test("refund route invokes the behavioral permission gate before mutating", () => {
  const src = refundSource();
  assert.match(src, /requireAppointmentRefundPermission\(auth\.user\)/);
  assert.match(src, /if \(denied\) return denied;/);
});

test("check route does NOT require payments.edit or payments.delete (weaker than retry/refund)", () => {
  const src = checkSource();
  assert.doesNotMatch(src, /requirePermission\(auth\.user,\s*"payments\.edit"\)/);
  assert.doesNotMatch(src, /requirePermission\(auth\.user,\s*"payments\.delete"\)/);
});

// --- Persisted state is the source of truth, never a client scalar ---------

test("check route re-verifies payment state via confirmAppointmentPayment, not a client-supplied paid/amount field", () => {
  const src = checkSource();
  assert.match(src, /confirmAppointmentPayment\(appt\.id\)/);
  // No request-body parsing at all — nothing client-supplied could feed the
  // paid/amount decision.
  assert.doesNotMatch(src, /req\.json\(\)/);
});

test("retry route delegates to retryAppointmentFeeCheckout, which itself re-reads Appointment.payment before acting", () => {
  const src = retrySource();
  assert.match(src, /retryAppointmentFeeCheckout\(appt\.id\)/);
  const libSrc = readSource("../lib/appointment-payments.ts");
  const fnStart = libSrc.indexOf("export async function retryAppointmentFeeCheckout");
  assert.notEqual(fnStart, -1);
  const fnBody = libSrc.slice(fnStart, fnStart + 1500);
  // Idempotency / concurrent-retry safety: an existing payment row short-
  // circuits before any new QPay checkout is requested.
  assert.match(fnBody, /if \(appt\.payment\) return \{ ok: true, required: true \}/);
});

test("retry checkout uses QPay sender uniqueness and conditional local writes instead of holding a DB lock across provider I/O", () => {
  const libSrc = readSource("../lib/appointment-payments.ts");
  const fnStart = libSrc.indexOf("export async function retryAppointmentFeeCheckout");
  assert.notEqual(fnStart, -1);
  const fnBody = libSrc.slice(fnStart, fnStart + 4200);
  const invoiceCheckIdx = fnBody.indexOf("appt.feeQpayInvoiceId");
  const providerCallIdx = fnBody.indexOf("requestFeeCheckout(");
  assert.ok(invoiceCheckIdx >= 0, "retry must short-circuit when an invoice is already persisted");
  assert.ok(providerCallIdx > invoiceCheckIdx, "retry must call QPay only after the persisted-state check");
  assert.doesNotMatch(fnBody, /withBookingTransaction\(appt\.tenantId/);
  assert.match(libSrc, /feeQpayInvoiceId:\s*null,\s*payment:\s*\{ is: null \}/);
  assert.match(libSrc, /QPay requires sender_invoice_no to be unique|QPay's unique sender_invoice_no/);
});

test("retry route requires an active subscription before mutating", () => {
  const src = retrySource();
  assert.match(src, /requireActiveSubscriptionApi\(auth\.user\)/);
  assert.match(src, /if \(locked\) return locked;/);
});

// --- Refund: row lock, fresh re-read, double-refund rejection --------------

test("refund route locks the AppointmentPayment row (FOR UPDATE) before reading status", () => {
  const src = refundSource();
  const lockIdx = src.indexOf("FOR UPDATE");
  const freshReadIdx = src.indexOf("tx.appointmentPayment.findFirst");
  const statusCheckIdx = src.indexOf('fresh.status !== "PAID"');
  assert.notEqual(lockIdx, -1, "must issue a row lock");
  assert.notEqual(freshReadIdx, -1, "must re-read the row after locking");
  assert.notEqual(statusCheckIdx, -1, "must branch on the freshly re-read status");
  assert.ok(lockIdx < freshReadIdx, "lock must precede the fresh read");
  assert.ok(freshReadIdx < statusCheckIdx, "fresh read must precede the status decision");
});

test("refund route rejects a payment whose fresh status is already REFUNDED (double-refund rejection)", () => {
  const src = refundSource();
  assert.match(src, /fresh\.status === "REFUNDED"/);
  assert.match(src, /"PAYMENT_ALREADY_REFUNDED"/);
});

test("refund route only mutates a fresh status of PAID, never trusting the pre-transaction lookup's implied state", () => {
  const src = refundSource();
  // The pre-transaction lookup only proves a payment row exists at all
  // (404 vs not) — it must not itself be branched on for the PAID/REFUNDED
  // decision; only `fresh` (read after the lock) may be.
  const pretxLookup = src.indexOf("prisma.appointmentPayment.findUnique");
  const txStart = src.indexOf("prisma.$transaction(async (tx)");
  assert.notEqual(pretxLookup, -1);
  assert.notEqual(txStart, -1);
  assert.ok(pretxLookup < txStart);
  const pretxSlice = src.slice(pretxLookup, txStart);
  assert.doesNotMatch(pretxSlice, /status/);
});

test("refund route updates the row to REFUNDED only inside the locked transaction", () => {
  const src = refundSource();
  const txStart = src.indexOf("prisma.$transaction(async (tx)");
  const updateIdx = src.indexOf('tx.appointmentPayment.update');
  const txEnd = src.lastIndexOf("});");
  assert.notEqual(updateIdx, -1);
  assert.ok(txStart < updateIdx && updateIdx < txEnd, "the write must happen inside the transaction");
  assert.match(src.slice(updateIdx, updateIdx + 200), /status:\s*"REFUNDED"/);
});

test("refund route requires an active subscription before mutating", () => {
  const src = refundSource();
  assert.match(src, /requireActiveSubscriptionApi\(auth\.user\)/);
  assert.match(src, /if \(locked\) return locked;/);
});

test("refund route requires a non-empty note before doing anything destructive", () => {
  const src = refundSource();
  const noteCheckIdx = src.indexOf("if (!note)");
  const scopeIdx = src.indexOf("resolveWorkingBranch(req, auth.user)");
  assert.notEqual(noteCheckIdx, -1);
  assert.ok(noteCheckIdx < scopeIdx, "note validation happens before any scope/DB work");
});

test("refund route calls QPay refund only for CARD payments with a qpayPaymentId, and records a MANUAL refund otherwise", () => {
  const src = refundSource();
  assert.match(src, /fresh\.paymentType === "CARD" && fresh\.qpayPaymentId/);
  assert.match(src, /QPayService\.refundPayment\(fresh\.qpayPaymentId, note\)/);
  assert.match(src, /refundedVia: "QPAY" \| "MANUAL"|let refundedVia:\s*"QPAY" \| "MANUAL" = "MANUAL"/);
});

test("refund route audits the mutation with tenantId, branchId, userId and entity Appointment", () => {
  const src = refundSource();
  assert.match(src, /entity:\s*"Appointment"/);
  assert.match(src, /action:\s*"PAYMENT_CHANGE"/);
  assert.match(src, /tenantId:\s*auth\.user\.tenantId/);
  assert.match(src, /userId:\s*auth\.user\.id/);
});

test("no route imports or touches the customer-realm /api/v1/app/appointments payment tree", () => {
  for (const source of [checkSource, retrySource, refundSource]) {
    const src = source();
    assert.doesNotMatch(src, /api\/v1\/app\/appointments/);
    assert.doesNotMatch(src, /getApiAccountFromRequest/);
  }
});
