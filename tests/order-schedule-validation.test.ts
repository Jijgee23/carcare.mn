/**
 * D-123 Cycle 2 — behavioral + architecture-guard tests for the client
 * injection seam that `lib/order-schedule-validation.ts` must grow.
 *
 * This file specifies (and pins) the API the implementer must build. Both
 * exports take the Prisma client to read through as their FIRST, REQUIRED
 * parameter (required, not optional-with-a-default — see the contract's
 * "The seam" section: an optional client is how this defect recurs):
 *
 *   export function validateScheduledOrderHours(
 *     client: PrismaTransactionClient,
 *     tenantId: string,
 *     branchId: string,
 *     scheduledAt: Date | null,
 *     durationMinutes: number,
 *   ): Promise<string | null>;
 *
 *   export function getBranchSlotMinutes(
 *     client: PrismaTransactionClient,
 *     tenantId: string,
 *     branchId: string,
 *   ): Promise<number>;
 *
 * The client parameter is typed as the real `PrismaTransactionClient`,
 * imported TYPE-ONLY: `import type { PrismaTransactionClient } from
 * "@/lib/prisma"`. A type-only import is erased at compile time, so the
 * module still has no runtime access to a global client — that erasure is
 * exactly the property this cycle protects — while production keeps full
 * Prisma type inference at the `client.branch.findFirst({ where, select })`
 * call site instead of widening the read to `unknown` and forcing a cast
 * before handing the row to `resolveEffectiveSchedule`. A drift between
 * `branchScheduleForDateSelect(...)` and what the schedule resolver expects
 * must stay a compile error; an `unknown`-typed reader would silently erase
 * that check.
 *
 * The module must end up importing nothing from the `prisma` VALUE binding
 * of `@/lib/prisma` (architecture guard below) — a plain `import type` of
 * `PrismaTransactionClient` from the same module is fine and expected. This
 * test file cannot import the real `PrismaTransactionClient` type from
 * `../lib/order-schedule-validation` (the module doesn't have this shape
 * until the fix lands), so it imports the type directly from `../lib/prisma`
 * and satisfies it in fakes with a single `as unknown as
 * PrismaTransactionClient` cast — the same pattern `order-create-command.ts`
 * already uses for `tx`.
 */

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBusinessLocalDateTime } from "../lib/booking-time";
import { DEFAULT_SLOT_MINUTES } from "../lib/appointment-slots";
import type { PrismaTransactionClient } from "../lib/prisma";

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

// ---------------------------------------------------------------------------
// The pinned signature (see header comment). `PrismaTransactionClient` is
// imported type-only above, so this file has no runtime dependency on
// lib/prisma.ts (no DB pool, no env read triggered by that import itself).
// ---------------------------------------------------------------------------

type FindFirstArgs = { where: Record<string, unknown>; select: unknown };

type ValidateScheduledOrderHours = (
  client: PrismaTransactionClient,
  tenantId: string,
  branchId: string,
  scheduledAt: Date | null,
  durationMinutes: number,
) => Promise<string | null>;

type GetBranchSlotMinutes = (
  client: PrismaTransactionClient,
  tenantId: string,
  branchId: string,
) => Promise<number>;

type ScheduleModuleShape = {
  validateScheduledOrderHours: ValidateScheduledOrderHours;
  getBranchSlotMinutes: GetBranchSlotMinutes;
};

let mod: ScheduleModuleShape | undefined;
let loadError: unknown;

before(async () => {
  try {
    mod = (await import(
      "../lib/order-schedule-validation"
    )) as unknown as ScheduleModuleShape;
  } catch (error) {
    loadError = error;
  }
});

function requireMod(): ScheduleModuleShape {
  if (loadError || !mod) {
    const reason = loadError instanceof Error ? loadError.message : String(loadError);
    throw new Error(`lib/order-schedule-validation.ts failed to load: ${reason}`);
  }
  return mod;
}

function validate(
  client: PrismaTransactionClient,
  tenantId: string,
  branchId: string,
  scheduledAt: Date | null,
  durationMinutes: number,
): Promise<string | null> {
  return requireMod().validateScheduledOrderHours(client, tenantId, branchId, scheduledAt, durationMinutes);
}

function slotMinutes(client: PrismaTransactionClient, tenantId: string, branchId: string): Promise<number> {
  return requireMod().getBranchSlotMinutes(client, tenantId, branchId);
}

// ---------------------------------------------------------------------------
// Source-text helpers for architecture guards
// ---------------------------------------------------------------------------

const testsDir = dirname(fileURLToPath(import.meta.url));
const modulePath = resolve(testsDir, "../lib/order-schedule-validation.ts");
const commandPath = resolve(testsDir, "../lib/orders/order-create-command.ts");

function readModuleSource(): string {
  return readFileSync(modulePath, "utf8");
}

function readCommandSource(): string {
  return readFileSync(commandPath, "utf8");
}

/**
 * Returns the substring from `openIndex` (which must point at `open`) through
 * its matching close bracket, respecting nesting. Used instead of a fixed
 * end-marker string so a guard survives reformatting of the region it scopes
 * into. Mirrors the previous cycle's `sliceBalancedBraces`.
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MSG = {
  invalidDate: "Товлосон огноо буруу.",
  branchNotFound: "Салбар олдсонгүй.",
  outsideHours: "Товлосон ажиллах цагийн гадуур байна.",
} as const;

// Fixed future business date, Ulaanbaatar-local. Weekday is irrelevant for
// the required rows below because `openBranchRow`/`closedBranchRow` carry
// empty `schedules`/`scheduleExceptions`/`scheduleSeasons`, so
// `resolveEffectiveSchedule` always falls back to the branch's own
// `openTime`/`closeTime` (source "default") regardless of what day this is.
const TEST_DATE = "2027-03-15";

function localTime(hhmm: string): Date {
  const d = parseBusinessLocalDateTime(`${TEST_DATE}T${hhmm}:00`);
  assert.equal(Number.isFinite(d.getTime()), true, `test setup: localTime("${hhmm}") produced an invalid Date`);
  return d;
}

type FakeBranchRow = {
  openTime: string | null;
  closeTime: string | null;
  schedules: Array<{ weekday: string; isOpen: boolean; openTime: string | null; closeTime: string | null }>;
  scheduleExceptions: Array<{
    date: string;
    isOpen: boolean;
    openTime: string | null;
    closeTime: string | null;
    label?: string | null;
  }>;
  scheduleSeasons: unknown[];
};

// Open 09:00-18:00 (minutes 540-1080), no weekday/exception/season overrides.
const openBranchRow: FakeBranchRow = {
  openTime: "09:00",
  closeTime: "18:00",
  schedules: [],
  scheduleExceptions: [],
  scheduleSeasons: [],
};

// No openTime/closeTime and no relations at all -> resolveEffectiveSchedule's
// fallback is `open: Boolean(null && null)` = false.
const closedBranchRow: FakeBranchRow = {
  openTime: null,
  closeTime: null,
  schedules: [],
  scheduleExceptions: [],
  scheduleSeasons: [],
};

function makeFakeClient(row: unknown): { client: PrismaTransactionClient; calls: FindFirstArgs[] } {
  const calls: FindFirstArgs[] = [];
  const fake = {
    branch: {
      findFirst: async (args: FindFirstArgs) => {
        calls.push(args);
        return row;
      },
    },
  };
  // The production signature takes the real PrismaTransactionClient so that
  // `client.branch.findFirst({ where, select })` keeps full Prisma type
  // inference (see header comment). This plain object satisfies it at
  // runtime — it only needs `branch.findFirst` — so the cast lives here in
  // the test, not in the module under test.
  return { client: fake as unknown as PrismaTransactionClient, calls };
}

// ---------------------------------------------------------------------------
// C2-4 — the business-hours decision. Every row is exact current behavior;
// each test pins the return value exactly as the contract table states it.
// ---------------------------------------------------------------------------

test("C2-4: scheduledAt null returns null with no client read at all", async () => {
  const { client, calls } = makeFakeClient(openBranchRow);
  const result = await validate(client, "tenant-a", "branch-a", null, 60);
  assert.equal(result, null);
  assert.equal(calls.length, 0, "scheduledAt null must short-circuit before touching the client");
});

test("C2-4: scheduledAt an invalid Date returns the invalid-date message with no client read at all", async () => {
  const { client, calls } = makeFakeClient(openBranchRow);
  const invalidDate = new Date(NaN);
  const result = await validate(client, "tenant-a", "branch-a", invalidDate, 60);
  assert.equal(result, MSG.invalidDate);
  assert.equal(calls.length, 0, "an invalid scheduledAt must short-circuit before touching the client");
});

test("C2-4: branch row not found returns the branch-not-found message", async () => {
  const { client, calls } = makeFakeClient(null);
  const result = await validate(client, "tenant-a", "branch-a", localTime("09:00"), 60);
  assert.equal(result, MSG.branchNotFound);
  assert.equal(calls.length, 1);
});

test("C2-4: schedule resolves closed for that day returns the outside-hours message", async () => {
  const { client } = makeFakeClient(closedBranchRow);
  const result = await validate(client, "tenant-a", "branch-a", localTime("09:00"), 60);
  assert.equal(result, MSG.outsideHours);
});

test("C2-4: start strictly before opening returns the outside-hours message", async () => {
  const { client } = makeFakeClient(openBranchRow); // opens 09:00 = minute 540
  const result = await validate(client, "tenant-a", "branch-a", localTime("08:59"), 60);
  assert.equal(result, MSG.outsideHours);
});

test("C2-4 boundary: start exactly at opening is valid (null)", async () => {
  const { client } = makeFakeClient(openBranchRow);
  const result = await validate(client, "tenant-a", "branch-a", localTime("09:00"), 60);
  assert.equal(result, null);
});

test("C2-4 boundary: start + duration exactly equal to closing is valid (the check is >, not >=)", async () => {
  const { client } = makeFakeClient(openBranchRow); // closes 18:00 = minute 1080
  // 17:00 = minute 1020; 1020 + 60 = 1080, exactly the closing minute.
  const result = await validate(client, "tenant-a", "branch-a", localTime("17:00"), 60);
  assert.equal(result, null);
});

test("C2-4 boundary: start + duration one minute past closing returns the outside-hours message", async () => {
  const { client } = makeFakeClient(openBranchRow);
  // 17:01 = minute 1021; 1021 + 60 = 1081, one minute past the minute-1080 close.
  const result = await validate(client, "tenant-a", "branch-a", localTime("17:01"), 60);
  assert.equal(result, MSG.outsideHours);
});

test("C2-4: start after closing returns the outside-hours message", async () => {
  const { client } = makeFakeClient(openBranchRow);
  const result = await validate(client, "tenant-a", "branch-a", localTime("19:00"), 60);
  assert.equal(result, MSG.outsideHours);
});

// ---------------------------------------------------------------------------
// Bonus (cheap): a weekday-specific `schedules` row and a `scheduleExceptions`
// row, as the contract invites. Not part of the required nine C2-4 rows.
// ---------------------------------------------------------------------------

test("bonus: a weekday-specific schedules row overrides the branch's own openTime/closeTime", async () => {
  // 2027-03-15 is a Monday (weekdayForDate uses UTC noon on the date string).
  const row: FakeBranchRow = {
    openTime: "09:00",
    closeTime: "18:00",
    schedules: [{ weekday: "MON", isOpen: true, openTime: "10:00", closeTime: "14:00" }],
    scheduleExceptions: [],
    scheduleSeasons: [],
  };
  const { client } = makeFakeClient(row);
  const beforeOverride = await validate(client, "tenant-a", "branch-a", localTime("09:30"), 30);
  assert.equal(beforeOverride, MSG.outsideHours, "09:30 is before the weekday override's 10:00 open, even though it is within the branch's own 09:00 open");
  const withinOverride = await validate(client, "tenant-a", "branch-a", localTime("10:00"), 30);
  assert.equal(withinOverride, null);
});

test("bonus: a scheduleExceptions row for the date closes the branch regardless of openTime/closeTime", async () => {
  const row: FakeBranchRow = {
    openTime: "09:00",
    closeTime: "18:00",
    schedules: [],
    scheduleExceptions: [{ date: TEST_DATE, isOpen: false, openTime: null, closeTime: null }],
    scheduleSeasons: [],
  };
  const { client } = makeFakeClient(row);
  const result = await validate(client, "tenant-a", "branch-a", localTime("10:00"), 30);
  assert.equal(result, MSG.outsideHours);
});

// ---------------------------------------------------------------------------
// C2-3 — the branch read stays tenant- and active-scoped
// ---------------------------------------------------------------------------

test("C2-3: the captured where is exactly { id: branchId, tenantId, isActive: true }", async () => {
  const { client, calls } = makeFakeClient(openBranchRow);
  await validate(client, "tenant-a", "branch-a", localTime("09:00"), 60);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].where, { id: "branch-a", tenantId: "tenant-a", isActive: true });
});

// ---------------------------------------------------------------------------
// C2-1 — the read goes through the supplied client, and only that client
// ---------------------------------------------------------------------------

test("C2-1: the injected client's result genuinely drives the outcome, read exactly once", async () => {
  const open = makeFakeClient(openBranchRow);
  const openResult = await validate(open.client, "tenant-a", "branch-a", localTime("09:00"), 60);
  assert.equal(open.calls.length, 1, "validateScheduledOrderHours must read through the injected client exactly once — an implementation that ignores it (or reads elsewhere) cannot pass this");

  const closed = makeFakeClient(closedBranchRow);
  const closedResult = await validate(closed.client, "tenant-a", "branch-a", localTime("09:00"), 60);
  assert.equal(closed.calls.length, 1);

  assert.equal(openResult, null);
  assert.equal(closedResult, MSG.outsideHours);
  assert.notEqual(openResult, closedResult, "two different fake rows must produce two different outcomes, or the fake isn't actually driving the decision");
});

// ---------------------------------------------------------------------------
// Bonus: getBranchSlotMinutes takes the same injected-client shape (the
// contract requires the client as the first required parameter on BOTH
// exports, and explicitly forbids deleting this function — it must be
// "converted to injection like its neighbour"). Pin its existing behavior
// through the new seam.
// ---------------------------------------------------------------------------

test("bonus: getBranchSlotMinutes reads through the injected client with where { id, tenantId }", async () => {
  const { client, calls } = makeFakeClient({ slotMinutes: 45 });
  const result = await slotMinutes(client, "tenant-a", "branch-a");
  assert.equal(result, 45);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].where, { id: "branch-a", tenantId: "tenant-a" });
});

test("bonus: getBranchSlotMinutes falls back to DEFAULT_SLOT_MINUTES when slotMinutes is null or zero", async () => {
  const nullRow = makeFakeClient({ slotMinutes: null });
  assert.equal(await slotMinutes(nullRow.client, "tenant-a", "branch-a"), DEFAULT_SLOT_MINUTES);

  const zeroRow = makeFakeClient({ slotMinutes: 0 });
  assert.equal(await slotMinutes(zeroRow.client, "tenant-a", "branch-a"), DEFAULT_SLOT_MINUTES);

  const missingRow = makeFakeClient(null);
  assert.equal(await slotMinutes(missingRow.client, "tenant-a", "branch-a"), DEFAULT_SLOT_MINUTES);
});

// ---------------------------------------------------------------------------
// Architecture guards
// ---------------------------------------------------------------------------

/**
 * Detects whether `source` imports the `prisma` VALUE binding from
 * "@/lib/prisma" — as opposed to a type-only import of, e.g.,
 * `PrismaTransactionClient` from the same module, which is fine: a
 * `import type { ... }` (or an inline `type X` specifier inside a mixed
 * import) is erased at compile time and gives the module no runtime access
 * to a global client. Also catches the namespace-import route to the same
 * live binding, which a named-import check alone would miss entirely:
 * `import * as ns from "@/lib/prisma"` keeps every runtime export reachable
 * as `ns.<name>`, so a later `ns.prisma.branch.findFirst(...)` is just as
 * much a global-client read as `import { prisma }` would be. Handles all of:
 *   - `import type { PrismaTransactionClient } from "@/lib/prisma";`        -> false
 *   - `import { prisma } from "@/lib/prisma";`                              -> true
 *   - `import { prisma, type PrismaTransactionClient } from "..."`         -> true
 *   - `import type * as ns from "@/lib/prisma";`                            -> false (fully erased)
 *   - `import * as ns from "@/lib/prisma"; ...ns.prisma.branch.findFirst`   -> true
 *   - `import * as ns from "@/lib/prisma";` with no `ns.prisma` usage       -> false
 */
function importsPrismaValue(source: string): boolean {
  const namedImportRe = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*["']@\/lib\/prisma["']/g;
  let match: RegExpExecArray | null;
  while ((match = namedImportRe.exec(source))) {
    const [, wholeImportIsTypeOnly, specifierList] = match;
    if (wholeImportIsTypeOnly) continue;
    const specifiers = specifierList.split(",").map((s) => s.trim()).filter(Boolean);
    for (const spec of specifiers) {
      if (/^type\s+/.test(spec)) continue; // inline `type X` specifier — erased at runtime too.
      const importedName = spec.split(/\s+as\s+/)[0].trim();
      if (importedName === "prisma") return true;
    }
  }

  const namespaceImportRe = /import\s+(type\s+)?\*\s+as\s+(\w+)\s*from\s*["']@\/lib\/prisma["']/g;
  while ((match = namespaceImportRe.exec(source))) {
    const [, wholeImportIsTypeOnly, namespaceName] = match;
    if (wholeImportIsTypeOnly) continue; // `import type * as ns` — erased at runtime too.
    const usesNamespacePrisma = new RegExp(`\\b${namespaceName}\\.prisma\\b`).test(source);
    if (usesNamespacePrisma) return true;
  }

  return false;
}

test("architecture guard: lib/order-schedule-validation.ts does not import the `prisma` value from @/lib/prisma", () => {
  const source = readModuleSource();
  assert.equal(
    importsPrismaValue(source),
    false,
    "the module must not import the runtime `prisma` VALUE binding from @/lib/prisma (e.g. `import { prisma } from \"@/lib/prisma\"`) — that is exactly the global-client fallback this cycle removes, and it must read through its caller-supplied client only. A plain `import type { PrismaTransactionClient } from \"@/lib/prisma\"` is fine and expected: a type-only import is erased at compile time, so it gives the module no runtime access to a global client, which is the actual property this guard protects.",
  );
});

test("architecture guard: the validateScheduledOrderHours call inside createOrderCommand passes the transaction client, not prisma", () => {
  const source = readCommandSource();

  const callMarker = "validateScheduledOrderHours(";
  const callIndex = source.indexOf(callMarker);
  assert.notEqual(callIndex, -1, "could not locate the validateScheduledOrderHours call in order-create-command.ts");

  const openParenIndex = callIndex + callMarker.length - 1;
  const callSlice = sliceBalanced(source, openParenIndex, "(", ")");

  assert.match(
    callSlice,
    /\(\s*(tx|scopedTx)\b/,
    "validateScheduledOrderHours must be called with the booking transaction client (tx/scopedTx, or a cast of it) as its first argument — this call runs inside withBookingTransaction, so the global client would take a second connection and read outside the transaction's snapshot",
  );
  assert.doesNotMatch(
    callSlice,
    /\(\s*prisma\b/,
    "validateScheduledOrderHours must not be called with the global prisma client from inside createOrderCommand's transaction",
  );
});
