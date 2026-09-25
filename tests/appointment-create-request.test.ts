/**
 * P2-B2 — Staff appointment creation and slots.
 *
 * Covers:
 *   1. `parseCreateAppointmentBody` (lib/appointments/appointment-create-request.ts) —
 *      pure, behavioral.
 *   2. Source-pattern guards pinning how the two routes
 *      (app/api/v1/appointments/route.ts POST, app/api/v1/appointments/slots/route.ts)
 *      are wired — auth/permission/scope idiom, delegation to the single P2-B1
 *      command, and that the slots route does NOT reuse the PUBLIC/ANONYMOUS
 *      `resolvePublicAvailability`/`getBranchDaySlots` path (that module's own
 *      header comment says it must never back an authenticated staff surface).
 *   3. A REAL concurrency test proving capacity enforcement survives a
 *      concurrent second booking of the same slot — not merely asserted. It
 *      drives the actual `reserveAppointmentInTransaction` (the function
 *      `registerAppointmentByStaffCommand` delegates to, via `reserveAppointment`)
 *      with two callers racing for the same capacity-1 slot, using a fake
 *      Prisma transaction client whose `$queryRaw` models the real `FOR UPDATE`
 *      row lock as a genuine async mutex held for the whole transaction (not
 *      just the lock statement) — exactly like a real Postgres row lock held
 *      until COMMIT. This is the same "drive the lock-then-reread contract
 *      directly with a fake client" pattern tests/reservations.test.ts and
 *      tests/scheduling.test.ts's `runLockedOrderWork` tests already use for
 *      the same reason: `withBookingTransaction` opens a real pooled
 *      connection and can't be driven by a fake client.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Prisma } from "../app/generated/prisma/client";
import {
  reserveAppointmentInTransaction,
  ReservationConflictError,
  ReservationError,
} from "../lib/appointment-reservations";
import { parseCreateAppointmentBody } from "../lib/appointments/appointment-create-request";

function readSource(relativePath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relativePath), "utf8");
}

const routeSource = () => readSource("../app/api/v1/appointments/route.ts");
const slotsRouteSource = () => readSource("../app/api/v1/appointments/slots/route.ts");
const createCommandSource = () => readSource("../lib/appointments/appointment-create-command.ts");
const publicAvailabilitySource = () => readSource("../lib/public-availability.ts");

// ---------------------------------------------------------------------------
// 1. parseCreateAppointmentBody — pure behavioral tests
// ---------------------------------------------------------------------------

const NOW = new Date("2030-01-07T09:00:00+08:00");
const FUTURE = "2030-01-07T10:00:00";
const PAST = "2030-01-07T08:00:00";

const validBody = {
  branchId: "branch-1",
  customerId: "customer-1",
  requestedAt: FUTURE,
};

test("parseCreateAppointmentBody accepts a minimal valid body", () => {
  const result = parseCreateAppointmentBody(validBody, NOW);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.branchId, "branch-1");
  assert.equal(result.value.customerId, "customer-1");
  assert.equal(result.value.requestedAt.toISOString(), new Date(`${FUTURE}+08:00`).toISOString());
  assert.equal(result.value.note, null);
  assert.deepEqual(result.value.categoryIds, []);
  assert.equal(result.value.confirmed, false);
});

test("parseCreateAppointmentBody accepts and normalizes optional fields", () => {
  const result = parseCreateAppointmentBody(
    {
      ...validBody,
      note: "  utsaar  ",
      categoryIds: ["c1", "c2", "c1"],
      confirmed: true,
    },
    NOW,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.note, "utsaar");
  assert.deepEqual(result.value.categoryIds, ["c1", "c2"]);
  assert.equal(result.value.confirmed, true);
});

test("rejects null, array, and non-object JSON bodies before property access", () => {
  for (const body of [null, [], "x", 5, true]) {
    const result = parseCreateAppointmentBody(body, NOW);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 400);
    assert.equal(result.fieldErrors, undefined);
  }
});

test("rejects missing branchId/customerId/requestedAt with 422 fieldErrors", () => {
  const result = parseCreateAppointmentBody({}, NOW);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 422);
  assert.equal(result.fieldErrors?.branchId, "Салбараа сонгоно уу.");
  assert.equal(result.fieldErrors?.customerId, "Үйлчлүүлэгчээ сонгоно уу.");
  assert.equal(result.fieldErrors?.requestedAt, "Цагаа сонгоно уу.");
});

test("rejects an unparseable requestedAt string with 422 fieldErrors.requestedAt", () => {
  const result = parseCreateAppointmentBody({ ...validBody, requestedAt: "not-a-date" }, NOW);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 422);
  assert.equal(result.fieldErrors?.requestedAt, "Огноо буруу.");
});

test("past time cannot create a booking — rejected at the parser boundary", () => {
  const result = parseCreateAppointmentBody({ ...validBody, requestedAt: PAST }, NOW);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 422);
  assert.equal(result.fieldErrors?.requestedAt, "Өнгөрсөн цаг сонгох боломжгүй.");
});

test("a requestedAt exactly equal to now is rejected (not strictly in the future)", () => {
  const result = parseCreateAppointmentBody({ ...validBody, requestedAt: "2030-01-07T09:00:00" }, NOW);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.fieldErrors?.requestedAt, "Өнгөрсөн цаг сонгох боломжгүй.");
});

test("rejects malformed optional fields with 400 and no fieldErrors", () => {
  for (const body of [
    { ...validBody, note: 5 },
    { ...validBody, confirmed: "true" },
    { ...validBody, categoryIds: "c1" },
    { ...validBody, categoryIds: ["c1", 5] },
    { ...validBody, categoryIds: ["c1", ""] },
  ]) {
    const result = parseCreateAppointmentBody(body, NOW);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 400);
    assert.equal(result.fieldErrors, undefined);
  }
});

test("branchId/customerId are trimmed and whitespace-only counts as missing", () => {
  const result = parseCreateAppointmentBody(
    { ...validBody, branchId: "   ", customerId: "  c1  " },
    NOW,
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.fieldErrors?.branchId, "Салбараа сонгоно уу.");
  assert.equal(result.fieldErrors?.customerId, undefined);
});

// ---------------------------------------------------------------------------
// 2. Route wiring — source-pattern guards
// ---------------------------------------------------------------------------

test("POST /api/v1/appointments requires appointments.create, active subscription, and delegates to the P2-B1 command", () => {
  const src = routeSource();
  assert.match(src, /export async function POST\(/);
  const start = src.indexOf("export async function POST(");
  assert.ok(start >= 0);
  const body = src.slice(start);
  assert.match(body, /requirePermission\(auth\.user,\s*"appointments\.create"\)/);
  assert.match(body, /requireActiveSubscriptionApi\(auth\.user\)/);
  assert.match(body, /resolveWorkingBranch\(req,\s*auth\.user\)/);
  assert.match(body, /parseCreateAppointmentBody\(body\)/);
  assert.match(body, /registerAppointmentByStaffCommand\(/);
  // GET must be untouched by this addition.
  assert.match(src, /export async function GET\(req: Request\)/);
  assert.match(src, /requirePermission\(auth\.user,\s*"appointments\.view"\)/);
});

test("registerAppointmentByStaffCommand is the one path the route calls — no second mutation path in the route", () => {
  const src = routeSource();
  assert.ok(!src.includes("prisma.appointment.create("), "route must not create appointments directly");
  assert.ok(!src.includes("reserveAppointment("), "route must not bypass the shared command");
});

test("GET /api/v1/appointments/slots requires appointments.view and resolves working-branch scope", () => {
  const src = slotsRouteSource();
  assert.match(src, /export async function GET\(/);
  assert.match(src, /requirePermission\(auth\.user,\s*"appointments\.view"\)/);
  assert.match(src, /resolveWorkingBranch\(req,\s*auth\.user\)/);
  assert.match(src, /computeBranchDayAvailability\(/);
});

test("the slots route does not import the PUBLIC/ANONYMOUS availability path", () => {
  const src = slotsRouteSource();
  assert.ok(!src.includes('from "@/lib/public-availability"'), "must not import resolvePublicAvailability");
  assert.ok(
    !/^import[^\n]*getBranchDaySlots/m.test(src),
    "must not import the bypass-context public action (mentioning it in a doc comment is fine)",
  );
  // Confirm the reason still holds in the source it would otherwise have reused.
  assert.match(
    publicAvailabilitySource(),
    /PUBLIC\/ANONYMOUS on purpose/,
    "expected the public-availability module to still document itself as anonymous-only",
  );
});

test("appointment-create-command delegates to reserveAppointment, which reserveAppointmentInTransaction backs", () => {
  const src = createCommandSource();
  assert.match(src, /reserveAppointment\(/);
});

// ---------------------------------------------------------------------------
// 3. Real concurrency proof: two racing bookings of the same capacity-1 slot
// ---------------------------------------------------------------------------

type FakeCommittedAppointment = {
  requestedAt: Date;
  estimatedDurationMinutes: number;
  categoryId: null;
  serviceOrderId: null;
  categories: never[];
  status: string;
  createdAt: Date;
  feeAmount: null;
  feeUnderpaidAmount: null;
  payment: null;
  serviceOrder: null;
};

function makeMutex() {
  let locked = false;
  const waiters: (() => void)[] = [];
  return {
    async acquire() {
      if (!locked) {
        locked = true;
        return;
      }
      await new Promise<void>((res) => waiters.push(res));
      locked = true;
    },
    release() {
      locked = false;
      const next = waiters.shift();
      if (next) next();
    },
  };
}

test("concurrent second booking of a capacity-1 slot is rejected, never double-inserted, and reads post-commit state", async () => {
  // Models the real `FOR UPDATE` branch row lock (reserveAppointmentInTransaction's
  // first statement) as a genuine async mutex held for the ENTIRE call — not
  // just the lock statement — exactly like a real Postgres row lock stays held
  // until the enclosing transaction COMMITs. Two "connections" race for it.
  const mutex = makeMutex();
  const committed: FakeCommittedAppointment[] = [];
  const events: string[] = [];

  const branchFixture = {
    id: "branch",
    slotMinutes: 30,
    slotCapacity: 1,
    openTime: "10:00",
    closeTime: "11:00",
    schedules: [],
    tenant: { suspended: false, acceptsOnlineBooking: true },
  };

  function makeTx(label: string): Prisma.TransactionClient {
    return {
      $queryRaw: async () => {
        await mutex.acquire();
        events.push(`${label}:lock`);
        return [{ id: "branch" }];
      },
      branch: {
        findFirst: async () => branchFixture,
        findUnique: async () => ({ slotMinutes: 30, slotCapacity: 1 }),
      },
      category: { findMany: async () => [] },
      accountVehicle: { findFirst: async () => null },
      customer: { findFirst: async () => ({ id: "customer" }) },
      appointment: {
        findMany: async () => {
          events.push(`${label}:capacity-read(${committed.length})`);
          return committed.map((c) => ({ ...c }));
        },
        create: async (args: Prisma.AppointmentCreateArgs) => {
          events.push(`${label}:insert`);
          committed.push({
            requestedAt: args.data.requestedAt as Date,
            estimatedDurationMinutes: args.data.estimatedDurationMinutes as number,
            categoryId: null,
            serviceOrderId: null,
            categories: [],
            status: args.data.status as string,
            createdAt: new Date(),
            feeAmount: null,
            feeUnderpaidAmount: null,
            payment: null,
            serviceOrder: null,
          });
          return { id: `${label}-appt`, status: args.data.status, requestedAt: args.data.requestedAt };
        },
      },
    } as unknown as Prisma.TransactionClient;
  }

  const input = {
    tenantId: "tenant",
    branchId: "branch",
    staffUserId: "staff",
    accountId: null,
    customerId: "customer",
    categoryIds: [] as string[],
    requestedAt: new Date("2030-01-07T10:00:00+08:00"),
  };
  const now = new Date("2030-01-07T09:00:00+08:00");

  const runA = reserveAppointmentInTransaction(makeTx("A"), input, now).finally(() => mutex.release());
  const runB = reserveAppointmentInTransaction(makeTx("B"), input, now).finally(() => mutex.release());

  const [a, b] = await Promise.allSettled([runA, runB]);

  const outcomes = [a, b];
  const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
  const rejected = outcomes.filter((o) => o.status === "rejected");

  // Exactly one of the two concurrent callers wins the capacity-1 slot.
  assert.equal(fulfilled.length, 1, "exactly one concurrent booking must succeed");
  assert.equal(rejected.length, 1, "exactly one concurrent booking must be rejected");
  assert.equal(committed.length, 1, "the slot must never be double-booked in storage");

  const failure = rejected[0] as PromiseRejectedResult;
  assert.ok(failure.reason instanceof ReservationConflictError, "the loser must fail with the capacity conflict, not some other error");
  assert.ok(failure.reason instanceof ReservationError);
  assert.equal(failure.reason.status, 409);

  // Prove real serialization, not a lucky race: whichever caller locked
  // second did its capacity read strictly AFTER the first caller's insert —
  // i.e. it saw the committed write, not a stale pre-lock snapshot. If the
  // lock were not held for the whole transaction (only around the raw SELECT)
  // both callers could interleave their capacity reads before either insert,
  // and this ordering assertion would fail (both would show capacity-read(0)).
  const lockIdxA = events.indexOf("A:lock");
  const lockIdxB = events.indexOf("B:lock");
  const second = lockIdxA < lockIdxB ? "B" : "A";
  const secondCapacityReadIdx = events.indexOf(`${second}:capacity-read(1)`);
  const firstInsertIdx = events.indexOf(`${second === "B" ? "A" : "B"}:insert`);
  assert.ok(firstInsertIdx >= 0, "the winner must have actually inserted");
  assert.ok(
    secondCapacityReadIdx >= 0 && secondCapacityReadIdx > firstInsertIdx,
    `expected the second locker's capacity read to happen after the first's insert; events=${JSON.stringify(events)}`,
  );
});

test("without contention the same slot books normally (control case)", async () => {
  const mutex = makeMutex();
  const committed: FakeCommittedAppointment[] = [];
  const branchFixture = {
    id: "branch",
    slotMinutes: 30,
    slotCapacity: 1,
    openTime: "10:00",
    closeTime: "11:00",
    schedules: [],
    tenant: { suspended: false, acceptsOnlineBooking: true },
  };
  const tx = {
    $queryRaw: async () => { await mutex.acquire(); return [{ id: "branch" }]; },
    branch: { findFirst: async () => branchFixture, findUnique: async () => ({ slotMinutes: 30, slotCapacity: 1 }) },
    category: { findMany: async () => [] },
    accountVehicle: { findFirst: async () => null },
    customer: { findFirst: async () => null },
    appointment: {
      findMany: async () => committed.map((c) => ({ ...c })),
      create: async (args: Prisma.AppointmentCreateArgs) => {
        committed.push({
          requestedAt: args.data.requestedAt as Date,
          estimatedDurationMinutes: args.data.estimatedDurationMinutes as number,
          categoryId: null,
          serviceOrderId: null,
          categories: [],
          status: args.data.status as string,
          createdAt: new Date(),
          feeAmount: null,
          feeUnderpaidAmount: null,
          payment: null,
          serviceOrder: null,
        });
        return { id: "appt", status: args.data.status, requestedAt: args.data.requestedAt };
      },
    },
  } as unknown as Prisma.TransactionClient;

  const input = {
    tenantId: "tenant",
    branchId: "branch",
    staffUserId: "staff",
    categoryIds: [] as string[],
    requestedAt: new Date("2030-01-07T10:00:00+08:00"),
  };
  const now = new Date("2030-01-07T09:00:00+08:00");
  const result = await reserveAppointmentInTransaction(tx, input, now).finally(() => mutex.release());
  assert.equal(result.status, "CONFIRMED");
  assert.equal(committed.length, 1);
});

test("vehicleId is optional, trimmed, and blank/null normalizes to null", () => {
  for (const [input, expected] of [
    [undefined, null],
    [null, null],
    ["", null],
    ["  veh-1 ", "veh-1"],
  ] as const) {
    const result = parseCreateAppointmentBody({ ...validBody, vehicleId: input }, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.vehicleId, expected);
  }
});

test("a non-string vehicleId is rejected with 400", () => {
  const result = parseCreateAppointmentBody({ ...validBody, vehicleId: 42 }, NOW);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 400);
});
