import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Same environment limitation as tests/appointment-commands.test.ts and the
// KNOWN GAP note in tests/api-branch-routes.test.ts: every route below
// transitively imports lib/appointments/appointment-commands.ts, which
// imports lib/subscription-server.ts, which does `import "server-only"` — a
// package not installed in this project's node_modules (Next's bundler
// resolves it specially at build time; plain Node module resolution under
// `tsx --test` cannot). Confirmed here too:
// `Cannot find module 'server-only'`. There is no database connection
// available in this environment either way. Behavioral coverage for these
// routes is therefore `npm run build` + `npm run lint` + manual/staging
// verification, matching the P2-B1 precedent. What follows is structural
// (source-text) verification: wiring (auth/permission/scope/delegation) and
// an explicit PATCH-vs-named ADAPTER PARITY comparison of the actual writes
// each path performs, so the two paths cannot silently drift apart even
// though neither can be exercised live here.

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

function readSource(relativePath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relativePath), "utf8");
}

const confirmSource = () => readSource("../app/api/v1/appointments/[id]/confirm/route.ts");
const rejectSource = () => readSource("../app/api/v1/appointments/[id]/reject/route.ts");
const noShowSource = () => readSource("../app/api/v1/appointments/[id]/no-show/route.ts");
const arrivedSource = () => readSource("../app/api/v1/appointments/[id]/arrived/route.ts");
const rescheduleSource = () => readSource("../app/api/v1/appointments/[id]/reschedule/route.ts");
const patchSource = () => readSource("../app/api/v1/appointments/[id]/route.ts");
const commandsSource = () => readSource("../lib/appointments/appointment-commands.ts");

const NAMED_ROUTES: Array<{
  name: string;
  source: () => string;
  command: string;
}> = [
  { name: "confirm", source: confirmSource, command: "confirmAppointmentCommand" },
  { name: "reject", source: rejectSource, command: "rejectAppointmentCommand" },
  { name: "no-show", source: noShowSource, command: "markAppointmentNoShowCommand" },
  { name: "arrived", source: arrivedSource, command: "markAppointmentArrivedCommand" },
  { name: "reschedule", source: rescheduleSource, command: "rescheduleAppointmentCommand" },
];

// --- Wiring: auth / permission / working-branch / delegation ---------------

for (const route of NAMED_ROUTES) {
  test(`${route.name} route requires an authenticated ApiUser`, () => {
    const src = route.source();
    assert.match(src, /requireApiUser\(req\)/);
    assert.match(src, /if \(auth\.response\) return auth\.response;/);
  });

  test(`${route.name} route requires appointments.edit`, () => {
    const src = route.source();
    assert.match(src, /requirePermission\(auth\.user,\s*"appointments\.edit"\)/);
    assert.match(src, /if \(denied\) return denied;/);
  });

  test(`${route.name} route resolves the X-Working-Branch scope before mutating`, () => {
    const src = route.source();
    const resolveIdx = src.indexOf("resolveWorkingBranch(req, auth.user)");
    const commandIdx = src.indexOf(`${route.command}(`);
    assert.notEqual(resolveIdx, -1, "must call resolveWorkingBranch");
    assert.notEqual(commandIdx, -1, `must call ${route.command}`);
    assert.ok(resolveIdx < commandIdx, "scope must be resolved before the command runs");
    assert.match(src, /if \(scopeResult\.response\) return scopeResult\.response;/);
  });

  test(`${route.name} route passes the resolved scope into the actor, not a bare header value`, () => {
    const src = route.source();
    assert.match(
      src,
      /actor:\s*\{\s*\.\.\.auth\.user,\s*workingBranchId:\s*scopeResult\.branchId\s*\?\?\s*undefined\s*\}/,
    );
  });

  test(`${route.name} route delegates to the matching P2-B1 command and performs no inline Prisma write of its own`, () => {
    const src = route.source();
    assert.match(src, new RegExp(`await ${route.command}\\(`));
    // A thin adapter must not itself call prisma.appointment.update — that
    // would be a second transition path (forbidden by the Phase 2 invariant).
    assert.doesNotMatch(src, /prisma\.appointment\.update\(/);
    assert.doesNotMatch(src, /prisma\.\$transaction\(/);
  });

  test(`${route.name} route maps the command's plain-Error scope/subscription rejections to 403, not 500`, () => {
    const src = route.source();
    assert.match(src, /STAFF_SCOPE_MESSAGES/);
    assert.match(src, /SUBSCRIPTION_LOCKED_MESSAGE/);
    assert.match(src, /jsonError\(403, error\.message\)/);
  });
}

test("reschedule route parses requestedAt and an optional confirmed flag", () => {
  const src = rescheduleSource();
  assert.match(src, /parseBusinessLocalDateTime/);
  assert.match(src, /input\.requestedAt/);
  assert.match(src, /input\.confirmed === true/);
});

// --- D-111: reschedule must not reintroduce the capacity-blind overlap-confirm response ---

test("D-111: reschedule route never emits the removed overlap-confirm response shape", () => {
  const src = rescheduleSource();
  // The removed warning's Mongolian phrase and its `confirmNeeded`-style
  // typed-confirmation payload (the orders reschedule route's own pattern,
  // see app/api/v1/orders/[id]/schedule/route.ts) must not appear here.
  assert.doesNotMatch(src, /давхцаж байна/);
  assert.doesNotMatch(src, /confirmNeeded/);
  assert.doesNotMatch(src, /OVERLAP/);
});

test("D-111: the underlying reschedule command itself carries the D-111 note and no overlap warning", () => {
  const src = commandsSource();
  assert.match(src, /D-111/);
  assert.doesNotMatch(src, /давхцаж байна/);
});

test("reschedule route relies on the command's working-hours validation (OUTSIDE_BUSINESS_HOURS), not a route-local check", () => {
  const src = commandsSource();
  assert.match(src, /OUTSIDE_BUSINESS_HOURS/);
  assert.doesNotMatch(rescheduleSource(), /OUTSIDE_BUSINESS_HOURS/);
});

// --- PATCH vs named-route ADAPTER PARITY ------------------------------------
//
// P2-B7: PATCH /api/v1/appointments/[id] now delegates every status
// transition it can express (CONFIRMED, REJECTED, NO_SHOW) to the same
// P2-B1 commands the named lifecycle routes call — one shared command
// implementation, per the Phase 2 invariant in TENANT_MOBILE_SLICES.md.
// These tests assert the two paths call the identical command function
// (so there is no second, independently-written transition path left to
// drift) rather than diffing duplicated inline write logic, since PATCH no
// longer has any inline write logic for these three transitions.

function transactionBlock(source: string, marker: string, size = 2200): string {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `marker not found: ${marker}`);
  return source.slice(start, start + size);
}

test("PARITY (CONFIRMED): PATCH's CONFIRMED branch delegates to confirmAppointmentCommand, not an inline write", () => {
  const patch = transactionBlock(patchSource(), 'newStatus === "CONFIRMED"', 550);
  assert.match(patch, /await confirmAppointmentCommand\(/);
  assert.doesNotMatch(patch, /prisma\.appointment\.update\(/);
  assert.doesNotMatch(patch, /prisma\.\$transaction\(/);
  assert.match(commandsSource(), /export async function confirmAppointmentCommand/);
});

test("PARITY (CONFIRMED): PATCH now inherits the command's fee-paid precondition — the former gap is closed", () => {
  // Previously PATCH's inline CONFIRMED branch had no
  // appointmentBookingPaymentStatus / APPOINTMENT_FEE_UNPAID guard, so it
  // would confirm an appointment with an unpaid booking fee that the named
  // /confirm route refused (a real adapter-parity gap, pinned by P2-B3).
  // P2-B7 closes it: PATCH's CONFIRMED branch now calls
  // confirmAppointmentCommand directly, so the guard lives in exactly one
  // place and both paths enforce it identically.
  const patch = transactionBlock(patchSource(), 'newStatus === "CONFIRMED"', 550);
  const command = transactionBlock(commandsSource(), "export async function confirmAppointmentCommand");
  assert.ok(command.includes("APPOINTMENT_FEE_UNPAID"), "expected the command to still guard on unpaid fee");
  assert.match(patch, /await confirmAppointmentCommand\(/);
  assert.doesNotMatch(
    patch,
    /appointmentBookingPaymentStatus/,
    "PATCH must not re-implement the fee guard inline — it must inherit it from the command",
  );
});

test("PARITY (REJECTED): PATCH's REJECTED branch delegates to rejectAppointmentCommand, not an inline write", () => {
  const patch = transactionBlock(patchSource(), 'newStatus === "REJECTED"', 220);
  assert.match(patch, /await rejectAppointmentCommand\(/);
  assert.doesNotMatch(patch, /prisma\.appointment\.update\(/);
  const command = transactionBlock(commandsSource(), "export async function rejectAppointmentCommand");
  assert.ok(command.includes('"REJECTED"'));
  assert.ok(command.includes("respondedAt:") && command.includes("respondedById:"));
  assert.ok(command.includes("appointment_rejected"));
});

test("PARITY (NO_SHOW): PATCH's NO_SHOW branch delegates to markAppointmentNoShowCommand, which does not set respondedAt/respondedById", () => {
  // Previously PATCH's shared "else" branch unconditionally set
  // respondedAt/respondedById for any non-CONFIRMED target status, including
  // NO_SHOW, while markAppointmentNoShowCommand writes only
  // `{ status: "NO_SHOW" }` — respondedAt records a response to a booking
  // request (confirm/reject), and NO_SHOW is not one. P2-B7 closes that gap:
  // PATCH's NO_SHOW branch now calls the command directly instead of writing
  // respondedAt/respondedById itself.
  const patch = transactionBlock(patchSource(), 'newStatus === "NO_SHOW"', 260);
  assert.match(patch, /await markAppointmentNoShowCommand\(/);
  assert.doesNotMatch(patch, /prisma\.appointment\.update\(/);
  assert.doesNotMatch(patch, /respondedAt/);
  assert.doesNotMatch(patch, /respondedById/);

  const command = transactionBlock(commandsSource(), "export async function markAppointmentNoShowCommand");
  const commandUpdateStart = command.indexOf("prisma.appointment.update");
  const commandUpdateCall = command.slice(commandUpdateStart, commandUpdateStart + 160);
  assert.ok(
    !commandUpdateCall.includes("respondedAt") && !commandUpdateCall.includes("respondedById"),
    "markAppointmentNoShowCommand has apparently gained respondedAt/respondedById — if so, update/remove this pinned test rather than deleting it silently",
  );
});

test("PARITY (CANCELLED): PATCH keeps its own inline write only where no P2-B1 command exists for the transition", () => {
  // CONFIRMED -> CANCELLED (staff-initiated) has no corresponding P2-B1
  // command (only the account-initiated cancelAppointmentByAccountCommand
  // exists, which is a different actor/authorization path entirely) and no
  // named lifecycle route, so there is nothing for PATCH to delegate to and
  // nothing for this inline write to drift against.
  const patch = transactionBlock(patchSource(), 'newStatus === "NO_SHOW"', 4000);
  assert.match(patch, /status: newStatus,/);
  assert.match(patch, /respondedAt: new Date\(\)/);
  assert.match(patch, /respondedById: auth\.user\.id/);
  assert.doesNotMatch(commandsSource(), /markAppointmentCancelledCommand|cancelAppointmentByStaffCommand/);
});

test("PATCH cancellation is subscription-gated and uses a conditional write for stale-state safety", () => {
  const src = patchSource();
  assert.match(src, /requireActiveSubscriptionApi\(auth\.user\)/);
  const cancelBlock = transactionBlock(src, 'newStatus === "NO_SHOW"', 4200);
  assert.match(cancelBlock, /prisma\.appointment\.updateMany\(/);
  assert.match(cancelBlock, /status:\s*appt\.status/);
  assert.match(cancelBlock, /if \(cancelled\.count !== 1\)/);
});

test("PARITY (ARRIVED): PATCH has no equivalent — arrivedAt is only reachable through the named route", () => {
  // arrivedAt is not part of AppointmentStatus / APPOINTMENT_STATUS_TRANSITIONS,
  // so PATCH cannot express this transition at all; there is nothing for the
  // named /arrived route to drift against on the PATCH side. The file may
  // READ arrivedAt once (APPT_SELECT, so GET/PATCH responses carry it), but
  // must never write it.
  const src = patchSource();
  assert.equal(src.match(/arrivedAt/g)?.length ?? 0, 1);
  assert.match(src, /^\s*arrivedAt: true,$/m);
  assert.match(commandsSource(), /const arrivedAt = new Date\(\)/);
});

test("lifecycle commands use conditional status writes so a stale pre-read cannot overwrite a concurrent transition", () => {
  const src = commandsSource();
  for (const marker of [
    "export async function confirmAppointmentCommand",
    "export async function rejectAppointmentCommand",
    "export async function markAppointmentNoShowCommand",
    "export async function markAppointmentArrivedCommand",
  ]) {
    const start = src.indexOf(marker);
    assert.notEqual(start, -1);
    const end = src.indexOf("\nexport ", start + marker.length);
    const body = src.slice(start, end === -1 ? undefined : end);
    assert.match(body, /prisma\.appointment\.updateMany|tx\.appointment\.updateMany/);
    assert.match(body, /updated\.count !== 1/);
  }
  const cancelStart = src.indexOf("export async function cancelAppointmentByAccountCommand");
  assert.notEqual(cancelStart, -1);
  const cancelEnd = src.indexOf("\nexport ", cancelStart + 10);
  const cancelBody = src.slice(cancelStart, cancelEnd === -1 ? undefined : cancelEnd);
  assert.match(cancelBody, /prisma\.appointment\.updateMany\(/);
  assert.match(cancelBody, /status:\s*\{ in: \["PENDING", "CONFIRMED"\] \}/);
});

test("PARITY (transitions): the named routes only reach statuses PATCH's own transition table also allows from the same origin", () => {
  const lib = readSource("../lib/appointments.ts");
  assert.match(lib, /PENDING: \["CONFIRMED", "REJECTED"\]/);
  assert.match(lib, /CONFIRMED: \["NO_SHOW", "CANCELLED"\]/);
  // confirm/reject both originate from PENDING; no-show originates from
  // CONFIRMED — matching APPOINTMENT_STATUS_TRANSITIONS above.
  assert.match(commandsSource(), /appt\.status !== "PENDING"[\s\S]{0,200}APPOINTMENT_NOT_PENDING/);
  assert.match(
    commandsSource(),
    /markAppointmentNoShowCommand[\s\S]{0,600}appt\.status !== "CONFIRMED"/,
  );
});

// --- GET /api/v1/appointments/[id] (tenant app notification deep link) -----

test("GET appointment by id is authenticated, needs appointments.view, and is tenant + working-branch scoped", () => {
  const src = patchSource();
  const get = src.slice(src.indexOf("export async function GET"), src.indexOf("export async function PATCH"));
  assert.ok(get.length > 0, "GET handler present before PATCH");
  assert.match(get, /requireApiUser\(req\)/);
  assert.match(get, /requirePermission\(auth\.user, "appointments\.view"\)/);
  assert.match(get, /resolveWorkingBranch\(req, auth\.user\)/);
  assert.match(get, /tenantId: auth\.user\.tenantId/);
  assert.match(get, /\.\.\.\(scope \? \{ branchId: scope \} : \{\}\)/);
  assert.match(get, /jsonError\(404,/);
  assert.match(get, /shapeAppointment\(appointment\)/);
});

test("staff create validates vehicle ownership and persists vehicleId", () => {
  const cmd = readSource("../lib/appointments/appointment-create-command.ts");
  assert.match(cmd, /tenantVehicle\.findUnique\(\{\s*where: \{ tenantId_vehicleId: \{ tenantId: actor\.tenantId, vehicleId \} \}/);
  assert.match(cmd, /"VEHICLE_NOT_FOUND"/);
  assert.match(cmd, /vehicle\?\.customerId !== customerId/);
  assert.match(cmd, /"VEHICLE_CUSTOMER_MISMATCH"/);
  const reserve = readSource("../lib/appointment-reservations.ts");
  assert.match(reserve, /vehicleId: input\.vehicleId \?\? null/);
  const route = readSource("../app/api/v1/appointments/route.ts");
  assert.match(route, /registerAppointmentByStaffCommand\(\{[^}]*vehicleId,/);
});
