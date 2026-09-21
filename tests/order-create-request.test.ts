/**
 * D-123 Cycle 3 — behavioral + architecture-guard tests for the pure request
 * parser that `app/api/v1/orders/route.ts`'s `POST` handler must grow, per
 * the frozen CLUSTER-3-CONTRACT.md. This file specifies (and pins) the API
 * the implementer must build.
 *
 * ---------------------------------------------------------------------------
 * PINNED SIGNATURE — lib/orders/order-create-request.ts
 * ---------------------------------------------------------------------------
 *
 *   export type ParsedCreateOrderBody = {
 *     branchId: string;
 *     customerId: string;
 *     vehicleId: string;
 *     assignedToId: string | null;
 *     scheduledAt: Date | null;
 *     notes: string | null;
 *     appointmentId: string | null;
 *     estimatedDurationMinutes: number | null;
 *   };
 *
 *   export type ParseCreateOrderBodyResult =
 *     | { ok: true; value: ParsedCreateOrderBody }
 *     | { ok: false; status: 400 | 422; message: string; fieldErrors?: Record<string, string> };
 *
 *   export function parseCreateOrderBody(body: unknown): ParseCreateOrderBodyResult;
 *
 * One exported function plus its two types — mirrors `parseOrderListQuery`'s
 * `{ ok: true; value } | { ok: false; ... }` shape (lib/orders/order-list-query.ts),
 * extended with `status` (this parser produces both 400 and 422, unlike the
 * list query, which is always 400) and an optional `fieldErrors` record.
 * `fieldErrors` is NOT exclusive to 422: every 422 branch below carries one,
 * and so does exactly one 400 branch — the legacy scheduledAt-parse-failure
 * case (see "AMENDMENT 1" below), which the manager confirmed is today's real
 * route.ts behavior and is pinned as-is, inconsistency and all. Every other
 * 400 branch carries no `fieldErrors`.
 *
 * Amendment 2 (manager, after the initial STOP report): the object-shape
 * guard (null / array / non-object → 400 "JSON object body шаардлагатай.")
 * moves INTO this parser, not the route — `parseCreateOrderBody` takes
 * `unknown` precisely because it must own that rejection itself, before ever
 * touching a property on the value. Only the raw `await req.json()`
 * parse-failure guard (400 "JSON body шаардлагатай.") stays in the route,
 * because that one genuinely needs the `Request` and can't be reached from a
 * plain value. See the "Object-shape guard" tests below, and the
 * corresponding repoint in tests/order-create-api.test.ts ("rejects null,
 * array, and non-object JSON bodies before property access").
 *
 * ---------------------------------------------------------------------------
 * AMENDMENT 1 — scheduledAt parse failure stays 400 (manager-confirmed)
 * ---------------------------------------------------------------------------
 * The initial STOP report flagged that C3-4's row "scheduledAt non-empty
 * string that does not parse → 422" contradicted today's route.ts, which
 * returns 400. The manager independently verified route.ts:105-114 and
 * confirmed the row was wrong, not the code: it stays **400**, deliberately
 * not harmonized to 422, because this is a parity cycle on a live API and a
 * status-code change here is a real breaking change for any client already
 * branching on it. Pinned below exactly as today's code behaves: status 400,
 * message "Хүсэлт буруу.", `fieldErrors.scheduledAt = "Огноо буруу."`.
 *
 * Every other row of C3-1 through C3-4 was cross-checked against route.ts and
 * matched; all are pinned below.
 */

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBusinessLocalDateTime } from "../lib/booking-time";
import {
  MIN_CATEGORY_DURATION_MINUTES,
  MAX_CATEGORY_DURATION_MINUTES,
} from "../lib/category-duration";

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

// ---------------------------------------------------------------------------
// The pinned signature (see header comment).
// ---------------------------------------------------------------------------

type ParsedCreateOrderBody = {
  branchId: string;
  customerId: string;
  vehicleId: string;
  assignedToId: string | null;
  scheduledAt: Date | null;
  notes: string | null;
  appointmentId: string | null;
  estimatedDurationMinutes: number | null;
};

type ParseCreateOrderBodyResult =
  | { ok: true; value: ParsedCreateOrderBody }
  | { ok: false; status: 400 | 422; message: string; fieldErrors?: Record<string, string> };

type ParseCreateOrderBody = (body: unknown) => ParseCreateOrderBodyResult;

type RequestModuleShape = {
  parseCreateOrderBody: ParseCreateOrderBody;
};

let mod: RequestModuleShape | undefined;
let loadError: unknown;

before(async () => {
  try {
    mod = (await import(
      "../lib/orders/order-create-request"
    )) as unknown as RequestModuleShape;
  } catch (error) {
    loadError = error;
  }
});

function requireMod(): RequestModuleShape {
  if (loadError || !mod) {
    const reason = loadError instanceof Error ? loadError.message : String(loadError);
    throw new Error(`lib/orders/order-create-request.ts failed to load: ${reason}`);
  }
  return mod;
}

function parse(body: unknown): ParseCreateOrderBodyResult {
  return requireMod().parseCreateOrderBody(body);
}

function assertFail(
  result: ParseCreateOrderBodyResult,
): asserts result is { ok: false; status: 400 | 422; message: string; fieldErrors?: Record<string, string> } {
  assert.equal(result.ok, false, `expected the parse to fail, got: ${JSON.stringify(result)}`);
}

function assertOk(
  result: ParseCreateOrderBodyResult,
): asserts result is { ok: true; value: ParsedCreateOrderBody } {
  assert.equal(result.ok, true, `expected the parse to succeed, got: ${JSON.stringify(result)}`);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    branchId: "branch-1",
    customerId: "customer-1",
    vehicleId: "vehicle-1",
    ...overrides,
  };
}

const REQUIRED_FIELD_ERRORS = {
  branchId: "Салбар сонгоно уу.",
  customerId: "Үйлчлүүлэгчээ сонгоно уу.",
  vehicleId: "Машинаа сонгоно уу.",
};

// Built from the constants, not pasted, so a bounds change cannot leave a
// stale expectation (per the contract's instruction for C3-2's message).
const DURATION_BOUNDS_MESSAGE =
  `Хугацаа ${MIN_CATEGORY_DURATION_MINUTES} мин – ${MAX_CATEGORY_DURATION_MINUTES / 60} цагийн хооронд байна.`;

const MUTUAL_EXCLUSION_MESSAGE = "Цаг захиалгатай үед хугацааг цаг захиалгаас авна.";

// ---------------------------------------------------------------------------
// Object-shape guard (Amendment 2) — parseCreateOrderBody now owns the
// null / array / non-object rejection itself; the route keeps only the raw
// req.json() parse-failure guard, which needs the Request and isn't
// reachable from this suite.
// ---------------------------------------------------------------------------

test("object-shape guard: null, array, and other non-object bodies all return 400 with no fieldErrors", () => {
  for (const body of [null, [], ["a"], "not-an-object", 42, true]) {
    const result = parse(body);
    assertFail(result);
    assert.equal(result.status, 400, `body ${JSON.stringify(body)} must be 400`);
    assert.equal(result.message, "JSON object body шаардлагатай.");
    assert.equal(result.fieldErrors, undefined);
  }
});

test("object-shape guard: a genuine (if incomplete) object body passes through to field validation, not the 400 shape guard", () => {
  // {} has the right shape — it still fails, but via the 422 required-fields
  // path below, not the 400 shape guard. Pins that the guard does not
  // over-reject plain objects.
  const result = parse({});
  assertFail(result);
  assert.equal(result.status, 422);
});

// ---------------------------------------------------------------------------
// C3-4 — required fields (branchId / customerId / vehicleId)
// ---------------------------------------------------------------------------

test("C3-4: all three missing required fields are reported together in one fieldErrors, not one at a time", () => {
  const result = parse({});
  assertFail(result);
  assert.equal(result.status, 422);
  assert.equal(result.message, "Хүсэлт буруу.");
  assert.deepEqual(result.fieldErrors, REQUIRED_FIELD_ERRORS);
});

test("C3-4: whitespace-only or missing required fields are all treated as blank, still reported together", () => {
  const result = parse({ branchId: "   ", customerId: "\t", vehicleId: undefined });
  assertFail(result);
  assert.equal(result.status, 422);
  assert.deepEqual(result.fieldErrors, REQUIRED_FIELD_ERRORS);
});

// ---------------------------------------------------------------------------
// C3-4 — assignedToId
// ---------------------------------------------------------------------------

test("C3-4: assignedToId present, not a string, not null returns 400 with no fieldErrors", () => {
  const result = parse(validBody({ assignedToId: 42 }));
  assertFail(result);
  assert.equal(result.status, 400);
  assert.equal(result.message, "assignedToId нь string эсвэл null байна.");
  assert.equal(result.fieldErrors, undefined);
});

test("C3-4: assignedToId empty or whitespace normalizes to null", () => {
  for (const raw of ["", "   "]) {
    const result = parse(validBody({ assignedToId: raw }));
    assertOk(result);
    assert.equal(result.value.assignedToId, null, `assignedToId ${JSON.stringify(raw)} should normalize to null`);
  }
});

// ---------------------------------------------------------------------------
// C3-4 — scheduledAt
// ---------------------------------------------------------------------------

test("C3-4: scheduledAt present, not a string, not null returns 400 with no fieldErrors", () => {
  const result = parse(validBody({ scheduledAt: 12345 }));
  assertFail(result);
  assert.equal(result.status, 400);
  assert.equal(result.message, "scheduledAt нь business-local datetime string байна.");
  assert.equal(result.fieldErrors, undefined);
});

test("C3-4: scheduledAt absent, null, or an empty/whitespace string all normalize to null", () => {
  for (const body of [
    validBody(),
    validBody({ scheduledAt: null }),
    validBody({ scheduledAt: "" }),
    validBody({ scheduledAt: "   " }),
  ]) {
    const result = parse(body);
    assertOk(result);
    assert.equal(result.value.scheduledAt, null);
  }
});

test("C3-4 (Amendment 1, manager-confirmed): scheduledAt a non-empty string that fails to parse returns 400 with fieldErrors.scheduledAt — matches today's route.ts exactly, inconsistency and all", () => {
  const result = parse(validBody({ scheduledAt: "2030-02-30T10:00" }));
  assertFail(result);
  assert.equal(result.status, 400);
  assert.equal(result.message, "Хүсэлт буруу.");
  assert.deepEqual(result.fieldErrors, { scheduledAt: "Огноо буруу." });
});

// ---------------------------------------------------------------------------
// C3-4 — notes
// ---------------------------------------------------------------------------

test("C3-4: notes is null when absent or non-string", () => {
  for (const body of [
    validBody(),
    validBody({ notes: null }),
    validBody({ notes: 7 }),
    validBody({ notes: true }),
    validBody({ notes: { a: 1 } }),
  ]) {
    const result = parse(body);
    assertOk(result);
    assert.equal(result.value.notes, null);
  }
});

test("C3-4: notes is trimmed, and a whitespace-only string becomes null", () => {
  const trimmed = parse(validBody({ notes: "  bring spare tire  " }));
  assertOk(trimmed);
  assert.equal(trimmed.value.notes, "bring spare tire");

  const blank = parse(validBody({ notes: "   " }));
  assertOk(blank);
  assert.equal(blank.value.notes, null);
});

// ---------------------------------------------------------------------------
// C3-1 — appointmentId
// ---------------------------------------------------------------------------

test("C3-1: appointmentId absent, null, or blank (after trim) normalizes to null", () => {
  for (const body of [
    validBody(),
    validBody({ appointmentId: null }),
    validBody({ appointmentId: "" }),
    validBody({ appointmentId: "   " }),
  ]) {
    const result = parse(body);
    assertOk(result);
    assert.equal(result.value.appointmentId, null);
  }
});

test("C3-1: a non-empty appointmentId string is trimmed and forwarded", () => {
  const result = parse(validBody({ appointmentId: "  appt-1  " }));
  assertOk(result);
  assert.equal(result.value.appointmentId, "appt-1");
});

test("C3-1: appointmentId present, not a string, not null returns 400 with no fieldErrors (matches the assignedToId wording pattern)", () => {
  const result = parse(validBody({ appointmentId: 99 }));
  assertFail(result);
  assert.equal(result.status, 400);
  assert.equal(result.message, "appointmentId нь string эсвэл null байна.");
  assert.equal(result.fieldErrors, undefined);
});

// ---------------------------------------------------------------------------
// C3-2 — estimatedDurationMinutes
// ---------------------------------------------------------------------------

test("C3-2: estimatedDurationMinutes absent or null normalizes to null", () => {
  for (const body of [validBody(), validBody({ estimatedDurationMinutes: null })]) {
    const result = parse(body);
    assertOk(result);
    assert.equal(result.value.estimatedDurationMinutes, null);
  }
});

test("C3-2: estimatedDurationMinutes present, not a number, not null returns 400 with no fieldErrors", () => {
  const result = parse(validBody({ estimatedDurationMinutes: "60" }));
  assertFail(result);
  assert.equal(result.status, 400);
  assert.equal(result.message, "estimatedDurationMinutes нь тоо эсвэл null байна.");
  assert.equal(result.fieldErrors, undefined);
});

test("C3-2 boundary: 4 is rejected (below MIN_CATEGORY_DURATION_MINUTES)", () => {
  const result = parse(validBody({ estimatedDurationMinutes: 4 }));
  assertFail(result);
  assert.equal(result.status, 422);
  assert.deepEqual(result.fieldErrors, { estimatedDurationMinutes: DURATION_BOUNDS_MESSAGE });
});

test("C3-2 boundary: 5 is accepted (equal to MIN_CATEGORY_DURATION_MINUTES)", () => {
  const result = parse(validBody({ estimatedDurationMinutes: 5 }));
  assertOk(result);
  assert.equal(result.value.estimatedDurationMinutes, 5);
});

test("C3-2 boundary: 720 is accepted (equal to MAX_CATEGORY_DURATION_MINUTES)", () => {
  const result = parse(validBody({ estimatedDurationMinutes: 720 }));
  assertOk(result);
  assert.equal(result.value.estimatedDurationMinutes, 720);
});

test("C3-2 boundary: 721 is rejected (above MAX_CATEGORY_DURATION_MINUTES)", () => {
  const result = parse(validBody({ estimatedDurationMinutes: 721 }));
  assertFail(result);
  assert.equal(result.status, 422);
  assert.deepEqual(result.fieldErrors, { estimatedDurationMinutes: DURATION_BOUNDS_MESSAGE });
});

test("C3-2 boundary: 5.5 is rejected (not an integer)", () => {
  const result = parse(validBody({ estimatedDurationMinutes: 5.5 }));
  assertFail(result);
  assert.equal(result.status, 422);
  assert.deepEqual(result.fieldErrors, { estimatedDurationMinutes: DURATION_BOUNDS_MESSAGE });
});

test("C3-2 boundary: NaN is rejected", () => {
  const result = parse(validBody({ estimatedDurationMinutes: NaN }));
  assertFail(result);
  assert.equal(result.status, 422);
  assert.deepEqual(result.fieldErrors, { estimatedDurationMinutes: DURATION_BOUNDS_MESSAGE });
});

test("C3-2 boundary: Infinity is rejected", () => {
  const result = parse(validBody({ estimatedDurationMinutes: Infinity }));
  assertFail(result);
  assert.equal(result.status, 422);
  assert.deepEqual(result.fieldErrors, { estimatedDurationMinutes: DURATION_BOUNDS_MESSAGE });
});

// ---------------------------------------------------------------------------
// C3-3 — mutual exclusion
// ---------------------------------------------------------------------------

test("C3-3: appointmentId and estimatedDurationMinutes together is rejected, even with an otherwise-valid duration", () => {
  const result = parse(validBody({ appointmentId: "appt-1", estimatedDurationMinutes: 60 }));
  assertFail(result);
  assert.equal(result.status, 422);
  assert.deepEqual(result.fieldErrors, { estimatedDurationMinutes: MUTUAL_EXCLUSION_MESSAGE });
});

test("C3-3: appointmentId alone (no duration) is accepted", () => {
  const result = parse(validBody({ appointmentId: "appt-1" }));
  assertOk(result);
  assert.equal(result.value.appointmentId, "appt-1");
  assert.equal(result.value.estimatedDurationMinutes, null);
});

test("C3-3: estimatedDurationMinutes alone (no appointment) is accepted", () => {
  const result = parse(validBody({ estimatedDurationMinutes: 60 }));
  assertOk(result);
  assert.equal(result.value.appointmentId, null);
  assert.equal(result.value.estimatedDurationMinutes, 60);
});

// ---------------------------------------------------------------------------
// Successful-parse shape — every field the route must forward
// ---------------------------------------------------------------------------

test("success shape: every field is forwarded, trimmed where applicable, scheduledAt is a real Date built via parseBusinessLocalDateTime", () => {
  const scheduledAtRaw = "2027-03-15T10:00";
  const expectedScheduledAt = parseBusinessLocalDateTime(scheduledAtRaw);
  assert.equal(Number.isFinite(expectedScheduledAt.getTime()), true, "test setup: scheduledAtRaw must itself parse");

  const result = parse({
    branchId: "  branch-1  ",
    customerId: "  customer-1  ",
    vehicleId: "  vehicle-1  ",
    assignedToId: "  staff-1  ",
    scheduledAt: scheduledAtRaw,
    notes: "  bring spare tire  ",
    estimatedDurationMinutes: 45,
  });
  assertOk(result);
  assert.equal(result.value.branchId, "branch-1");
  assert.equal(result.value.customerId, "customer-1");
  assert.equal(result.value.vehicleId, "vehicle-1");
  assert.equal(result.value.assignedToId, "staff-1");
  assert.ok(result.value.scheduledAt instanceof Date, "scheduledAt must be a real Date, not the raw string");
  assert.equal(result.value.scheduledAt?.getTime(), expectedScheduledAt.getTime());
  assert.equal(result.value.notes, "bring spare tire");
  assert.equal(result.value.appointmentId, null);
  assert.equal(result.value.estimatedDurationMinutes, 45);
});

test("success shape: appointment path forwards a trimmed appointmentId with estimatedDurationMinutes null and other fields default to null", () => {
  const result = parse(validBody({ appointmentId: "  appt-9  " }));
  assertOk(result);
  assert.equal(result.value.appointmentId, "appt-9");
  assert.equal(result.value.estimatedDurationMinutes, null);
  assert.equal(result.value.scheduledAt, null);
  assert.equal(result.value.assignedToId, null);
  assert.equal(result.value.notes, null);
});

// ---------------------------------------------------------------------------
// C3-5 — architecture guard: the route forwards appointmentId and
// estimatedDurationMinutes into createOrderCommand
// ---------------------------------------------------------------------------

const testsDir = dirname(fileURLToPath(import.meta.url));
const routePath = resolve(testsDir, "../app/api/v1/orders/route.ts");

function readRouteSource(): string {
  return readFileSync(routePath, "utf8");
}

/**
 * Returns the substring from `openIndex` (which must point at `open`) through
 * its matching close bracket, respecting nesting. Used instead of a fixed
 * end-marker string so the guard survives reformatting of the region it
 * scopes into. Mirrors the previous cycle's `sliceBalancedBraces`/`sliceBalanced`.
 */
function sliceBalanced(source: string, openIndex: number, open: string, close: string): string {
  assert.equal(source[openIndex], open, `sliceBalanced must start at '${open}'`);
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === open) depth += 1;
    else if (source[i] === close) {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  throw new Error(`sliceBalanced: unbalanced '${open}'/'${close}' from the given start index`);
}

type GuardResult = { ok: true } | { ok: false; reason: string };

/**
 * True only when `name` appears in `source` as a bare object-shorthand
 * property — an identifier immediately followed (module whitespace) by `,`
 * or `}` — never `:`. Shorthand is what guarantees the value is exactly the
 * in-scope variable of that name (which route.ts's own destructuring of
 * `parsed.value` binds), as opposed to `name: <anything>`, which could be a
 * literal, `null`, `undefined`, or an unrelated constant.
 */
function usesShorthandProperty(source: string, name: string): boolean {
  const re = new RegExp(`\\b${name}\\b\\s*([,}:])`, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    if (match[1] !== ":") return true;
  }
  return false;
}

/**
 * The C3-5 guard's real detection logic, factored out of the test body so it
 * can be exercised both against the real route source and against inline
 * mutant strings (see "architecture guard self-test" below).
 *
 * P2 audit finding this replaces: the previous version of this guard did a
 * bare identifier-NAME search (`/\bappointmentId\b/`), which a regression
 * like `appointmentId: null, estimatedDurationMinutes: null` still satisfies
 * — the property names stay present while the parsed values are silently
 * dropped, which is exactly the defect Cycle 3 exists to fix. This version
 * requires both names to appear as bare object-shorthand properties inside
 * the `createOrderCommand(` call, which a hardcoded literal or an absent
 * field cannot satisfy.
 */
function createOrderCommandCallForwardsParsedFields(source: string): GuardResult {
  const callMarker = "createOrderCommand(";
  const callIndex = source.indexOf(callMarker);
  if (callIndex === -1) {
    return { ok: false, reason: "no createOrderCommand( call found in the given source" };
  }

  const openParenIndex = callIndex + callMarker.length - 1;
  const callSlice = sliceBalanced(source, openParenIndex, "(", ")");

  if (!usesShorthandProperty(callSlice, "appointmentId")) {
    return {
      ok: false,
      reason:
        "appointmentId is not forwarded as a bare shorthand property in the createOrderCommand( call — it is either absent, or bound to a literal/explicit value instead of the parsed value",
    };
  }
  if (!usesShorthandProperty(callSlice, "estimatedDurationMinutes")) {
    return {
      ok: false,
      reason:
        "estimatedDurationMinutes is not forwarded as a bare shorthand property in the createOrderCommand( call — it is either absent, or bound to a literal/explicit value instead of the parsed value",
    };
  }
  return { ok: true };
}

test("architecture guard: the createOrderCommand( call in app/api/v1/orders/route.ts forwards the PARSED appointmentId and estimatedDurationMinutes values", () => {
  const result = createOrderCommandCallForwardsParsedFields(readRouteSource());
  assert.equal(result.ok, true, result.ok ? undefined : result.reason);
});

// ---------------------------------------------------------------------------
// Architecture guard self-test — P2 audit finding fix, "regression before the
// correction": proves the strengthened matcher actually has detection power,
// by running it against a known-good source and two known-bad mutants,
// rather than asserting it only against today's known-good route.ts.
// ---------------------------------------------------------------------------

test("architecture guard self-test: the matcher passes the real route, and rejects both a hardcoded-null mutant and a fields-absent mutant", () => {
  // 1. The real route.ts must pass.
  const realResult = createOrderCommandCallForwardsParsedFields(readRouteSource());
  assert.equal(realResult.ok, true, realResult.ok ? undefined : realResult.reason);

  // 2. P2 reproduction: property NAMES present, VALUES hardcoded to null —
  // the exact silent-no-op regression Cycle 3 exists to fix. The previous
  // (name-only) guard passed this; the shorthand-only check must reject it.
  const nullMutant = `
    const created = await createOrderCommand({
      tenantId: auth.user.tenantId,
      actorId: auth.user.id,
      branchId,
      customerId,
      vehicleId,
      assignedToId,
      scheduledAt,
      notes,
      appointmentId: null,
      estimatedDurationMinutes: null,
      workingBranchId: scopeResult.branchId,
    });
  `;
  const nullMutantResult = createOrderCommandCallForwardsParsedFields(nullMutant);
  assert.equal(nullMutantResult.ok, false, "a mutant hardcoding appointmentId/estimatedDurationMinutes to null must be rejected");

  // 3. Fields absent entirely (today's pre-Cycle-3 shape).
  const absentMutant = `
    const created = await createOrderCommand({
      tenantId: auth.user.tenantId,
      actorId: auth.user.id,
      branchId,
      customerId,
      vehicleId,
      assignedToId,
      scheduledAt,
      notes,
      workingBranchId: scopeResult.branchId,
    });
  `;
  const absentMutantResult = createOrderCommandCallForwardsParsedFields(absentMutant);
  assert.equal(absentMutantResult.ok, false, "a mutant omitting appointmentId/estimatedDurationMinutes entirely must be rejected");
});
