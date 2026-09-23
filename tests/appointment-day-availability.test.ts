// P2-B10: behavioral tests for `computeBranchDayAvailability`
// (lib/appointments/day-availability.ts) — the module factored out to stop
// the public slot path (lib/public-availability.ts's
// resolvePublicAvailability) and the staff slot route
// (app/api/v1/appointments/slots/route.ts) from independently re-expressing
// the same category-eligibility + schedule + slot-math assembly.
//
// These call the real function with a minimal fake Prisma client (no
// `import "server-only"` in this module's dependency chain — see the
// module's own header comment), so failures here are genuine behavioral
// regressions, not source-pattern matches.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBranchDayAvailability, type DayAvailabilityBranch } from "../lib/appointments/day-availability";
import { bookingDayBounds } from "../lib/booking-time";

const DATE = "2030-01-07"; // a Monday
const BOUNDS = bookingDayBounds(DATE);

function branch(overrides: Partial<DayAvailabilityBranch> = {}): DayAvailabilityBranch {
  return {
    id: "branch-1",
    tenantId: "tenant-1",
    slotMinutes: 30,
    slotCapacity: 2,
    openTime: null,
    closeTime: null,
    schedules: [{ weekday: "MON", isOpen: true, openTime: "09:00", closeTime: "12:00" }],
    scheduleExceptions: [],
    scheduleSeasons: [],
    ...overrides,
  };
}

function fakePrisma(opts: {
  categories?: { id: string }[];
  appointments?: unknown[];
} = {}) {
  return {
    category: {
      findMany: async () => opts.categories ?? [],
    },
    appointment: {
      findMany: async () => opts.appointments ?? [],
    },
    serviceOrder: {
      findMany: async () => [],
    },
    orderTimeBooking: {
      findMany: async () => [],
    },
    branch: {
      findUnique: async () => null,
    },
  } as unknown as Parameters<typeof computeBranchDayAvailability>[0];
}

test("computeBranchDayAvailability rejects a category id that doesn't come back eligible", async () => {
  const result = await computeBranchDayAvailability(fakePrisma({ categories: [] }), {
    branch: branch(),
    dateStr: DATE,
    dayStart: BOUNDS.start,
    dayEnd: BOUNDS.end,
    categoryIds: ["cat-foreign"],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "invalid_category");
});

test("computeBranchDayAvailability accepts an eligible category and returns open slots", async () => {
  const result = await computeBranchDayAvailability(fakePrisma({ categories: [{ id: "cat-1" }] }), {
    branch: branch(),
    dateStr: DATE,
    dayStart: BOUNDS.start,
    dayEnd: BOUNDS.end,
    categoryIds: ["cat-1"],
    now: new Date("2020-01-01T00:00:00Z"), // well before DATE, so every slot is future
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.availability.open, true);
  // 09:00-12:00 with 30-min slots = 6 slots.
  assert.equal(result.availability.slots.length, 6);
  assert.deepEqual(
    result.availability.slots.map((s) => s.time),
    ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"],
  );
  for (const slot of result.availability.slots) {
    assert.equal(slot.available, true);
    assert.equal(slot.remaining, 2);
  }
  assert.equal(result.availability.durationMinutes, 30);
});

test("computeBranchDayAvailability reports closed when the branch is closed that weekday", async () => {
  const result = await computeBranchDayAvailability(fakePrisma(), {
    branch: branch({ schedules: [{ weekday: "MON", isOpen: false, openTime: null, closeTime: null }] }),
    dateStr: DATE,
    dayStart: BOUNDS.start,
    dayEnd: BOUNDS.end,
    categoryIds: [],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.availability.open, false);
  assert.equal(result.availability.slots.length, 0);
});

test("computeBranchDayAvailability with no categoryIds does not query categories and uses branch slotMinutes as duration", async () => {
  let categoryQueried = false;
  const prisma = fakePrisma();
  const wrapped = {
    ...prisma,
    category: {
      findMany: async () => {
        categoryQueried = true;
        return [];
      },
    },
  } as unknown as Parameters<typeof computeBranchDayAvailability>[0];

  const result = await computeBranchDayAvailability(wrapped, {
    branch: branch({ slotMinutes: 45 }),
    dateStr: DATE,
    dayStart: BOUNDS.start,
    dayEnd: BOUNDS.end,
    categoryIds: [],
    now: new Date("2020-01-01T00:00:00Z"),
  });
  assert.equal(categoryQueried, false);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.availability.durationMinutes, 45);
});

test("computeBranchDayAvailability produces the SAME availability for the same branch/date/categories regardless of caller (public vs staff shape)", async () => {
  const sharedBranch = branch();
  const prisma = fakePrisma({ categories: [{ id: "cat-1" }] });
  const now = new Date("2020-01-01T00:00:00Z");

  const asPublicCaller = await computeBranchDayAvailability(prisma, {
    branch: sharedBranch,
    dateStr: DATE,
    dayStart: BOUNDS.start,
    dayEnd: BOUNDS.end,
    categoryIds: ["cat-1"],
    now,
  });
  const asStaffCaller = await computeBranchDayAvailability(prisma, {
    branch: sharedBranch,
    dateStr: DATE,
    dayStart: BOUNDS.start,
    dayEnd: BOUNDS.end,
    categoryIds: ["cat-1"],
    now,
  });

  assert.deepEqual(asPublicCaller, asStaffCaller);
});
