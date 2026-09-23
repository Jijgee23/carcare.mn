import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";

// `app/_actions/employee-schedule.ts` does `"use server"`, which plain
// `tsx --test` module resolution cannot import directly (same import barrier
// documented in `tests/services-route-permissions.test.ts`). So: behavioural
// tests run the extracted `lib/employee-schedule-commands.ts` core against an
// in-memory fake Prisma client (no DATABASE_URL/database needed — the fake
// implements exactly the methods the core calls), and a source-pattern test
// asserts the action file delegates to that core rather than reimplementing
// the logic inline.

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

let core: typeof import("../lib/employee-schedule-commands");
let resolution: typeof import("../lib/employee-schedule");

before(async () => {
  [core, resolution] = await Promise.all([
    import("../lib/employee-schedule-commands"),
    import("../lib/employee-schedule"),
  ]);
});

function src(relPath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relPath), "utf8");
}

// --- In-memory fake Prisma client -------------------------------------------
//
// Implements only what `lib/employee-schedule-commands.ts` calls:
// `branch.findMany`, `user.findFirst`/`findMany`,
// `employeeScheduleException.upsert`/`deleteMany`,
// `employeeWorkSchedule.upsert`/`deleteMany`.

type FakeBranch = { id: string; tenantId: string };
type FakeUser = { id: string; tenantId: string; firstName: string; lastName: string };
type SegmentRow = { order: number; branchId: string; startTime: string | null; endTime: string | null };
type ExceptionRow = { userId: string; date: string; isWorking: boolean; segments: SegmentRow[] };
type WorkScheduleRow = { userId: string; weekday: string; isWorking: boolean; segments: SegmentRow[] };

function makeFakeDb(seed: { branches?: FakeBranch[]; users?: FakeUser[] } = {}) {
  const branches = seed.branches ?? [];
  const users = seed.users ?? [];
  const exceptions: ExceptionRow[] = [];
  const workSchedules: WorkScheduleRow[] = [];

  const db = {
    branch: {
      async findMany({ where }: { where: { id: { in: string[] }; tenantId: string } }) {
        return branches
          .filter((b) => where.id.in.includes(b.id) && b.tenantId === where.tenantId)
          .map((b) => ({ id: b.id }));
      },
    },
    user: {
      async findFirst({ where }: { where: { id: string; tenantId: string } }) {
        const u = users.find((x) => x.id === where.id && x.tenantId === where.tenantId);
        return u ? { id: u.id, firstName: u.firstName, lastName: u.lastName } : null;
      },
      async findMany({ where }: { where: { id: { in: string[] }; tenantId: string } }) {
        return users
          .filter((u) => where.id.in.includes(u.id) && u.tenantId === where.tenantId)
          .map((u) => ({ id: u.id }));
      },
    },
    employeeScheduleException: {
      async upsert({
        where,
        create,
        update,
      }: {
        where: { userId_date: { userId: string; date: Date } };
        create: { userId: string; date: Date; isWorking: boolean; segments: { create: SegmentRow[] } };
        update: { isWorking: boolean; segments: { deleteMany: object; create: SegmentRow[] } };
      }) {
        const dateStr = where.userId_date.date.toISOString().slice(0, 10);
        const idx = exceptions.findIndex(
          (e) => e.userId === where.userId_date.userId && e.date === dateStr,
        );
        if (idx >= 0) {
          exceptions[idx] = { ...exceptions[idx], isWorking: update.isWorking, segments: update.segments.create };
        } else {
          exceptions.push({
            userId: create.userId,
            date: dateStr,
            isWorking: create.isWorking,
            segments: create.segments.create,
          });
        }
      },
      async deleteMany({ where }: { where: { userId: string; date: Date } }) {
        const dateStr = where.date.toISOString().slice(0, 10);
        const before = exceptions.length;
        for (let i = exceptions.length - 1; i >= 0; i--) {
          if (exceptions[i].userId === where.userId && exceptions[i].date === dateStr) exceptions.splice(i, 1);
        }
        return { count: before - exceptions.length };
      },
    },
    employeeWorkSchedule: {
      async upsert({
        where,
        create,
        update,
      }: {
        where: { userId_weekday: { userId: string; weekday: string } };
        create: { userId: string; weekday: string; isWorking: boolean; segments: { create: SegmentRow[] } };
        update: { isWorking: boolean; segments: { deleteMany: object; create: SegmentRow[] } };
      }) {
        const idx = workSchedules.findIndex(
          (w) => w.userId === where.userId_weekday.userId && w.weekday === where.userId_weekday.weekday,
        );
        if (idx >= 0) {
          workSchedules[idx] = {
            ...workSchedules[idx],
            isWorking: update.isWorking,
            segments: update.segments.create,
          };
        } else {
          workSchedules.push({
            userId: create.userId,
            weekday: create.weekday,
            isWorking: create.isWorking,
            segments: create.segments.create,
          });
        }
      },
      async deleteMany({ where }: { where: { userId: string; weekday: string } }) {
        const before = workSchedules.length;
        for (let i = workSchedules.length - 1; i >= 0; i--) {
          if (workSchedules[i].userId === where.userId && workSchedules[i].weekday === where.weekday) {
            workSchedules.splice(i, 1);
          }
        }
        return { count: before - workSchedules.length };
      },
    },
  };

  return { db: db as unknown as import("../lib/employee-schedule-commands").ScheduleDb, exceptions, workSchedules };
}

const TENANT = "tenant-1";
const OTHER_TENANT = "tenant-2";
const BRANCH_A = { id: "branch-a", tenantId: TENANT };
const BRANCH_B = { id: "branch-b", tenantId: TENANT };
const FOREIGN_BRANCH = { id: "branch-foreign", tenantId: OTHER_TENANT };
const USER_1 = { id: "u1", tenantId: TENANT, firstName: "Бат", lastName: "Дорж" };
const USER_2 = { id: "u2", tenantId: TENANT, firstName: "Сүх", lastName: "Бат" };
const FOREIGN_USER = { id: "u-foreign", tenantId: OTHER_TENANT, firstName: "X", lastName: "Y" };

function seedDb() {
  return makeFakeDb({ branches: [BRANCH_A, BRANCH_B, FOREIGN_BRANCH], users: [USER_1, USER_2, FOREIGN_USER] });
}

// --- authorizeScheduleTarget -------------------------------------------------

test("authorizeScheduleTarget: FORBIDDEN when actor lacks employees.schedule", async () => {
  const { db } = seedDb();
  const result = await core.authorizeScheduleTarget(db, {
    hasSchedulePermission: false,
    tenantId: TENANT,
    userId: USER_1.id,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "FORBIDDEN");
    assert.equal(result.message, "Танд ажлын хувиар засах эрх байхгүй.");
  }
});

test("authorizeScheduleTarget: NOT_FOUND when target is not in tenant (or missing)", async () => {
  const { db } = seedDb();
  const result = await core.authorizeScheduleTarget(db, {
    hasSchedulePermission: true,
    tenantId: TENANT,
    userId: FOREIGN_USER.id,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "NOT_FOUND");
    assert.equal(result.message, "Ажилтан олдсонгүй.");
  }
});

test("authorizeScheduleTarget: ok with the target's name fields", async () => {
  const { db } = seedDb();
  const result = await core.authorizeScheduleTarget(db, {
    hasSchedulePermission: true,
    tenantId: TENANT,
    userId: USER_1.id,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.target.firstName, "Бат");
    assert.equal(result.target.lastName, "Дорж");
  }
});

// --- parseSegments ------------------------------------------------------------

test("parseSegments: unparsable JSON", async () => {
  const { db } = seedDb();
  const errors: Record<string, string> = {};
  const parsed = await core.parseSegments(db, TENANT, "{not json", errors);
  assert.deepEqual(parsed, []);
  assert.equal(errors.segments, "Салбарын мэдээлэл уншигдсангүй.");
});

test("parseSegments: empty array requires at least one branch", async () => {
  const { db } = seedDb();
  const errors: Record<string, string> = {};
  const parsed = await core.parseSegments(db, TENANT, "[]", errors);
  assert.deepEqual(parsed, []);
  assert.equal(errors.segments, "Дор хаяж нэг салбар сонгоно уу.");
});

test("parseSegments: non-object item is invalid", async () => {
  const { db } = seedDb();
  const errors: Record<string, string> = {};
  // Every item in the list is non-object here, so the "buruu" message from
  // the first `if (!item || typeof item !== "object")` branch is the last
  // one written and is what survives (not overwritten by a later branch).
  await core.parseSegments(db, TENANT, JSON.stringify([null, "x"]), errors);
  assert.equal(errors.segments, "Салбарын мэдээлэл буруу.");
});

test("parseSegments: branch must belong to tenant", async () => {
  const { db } = seedDb();
  const errors: Record<string, string> = {};
  const parsed = await core.parseSegments(
    db,
    TENANT,
    JSON.stringify([{ branchId: FOREIGN_BRANCH.id }]),
    errors,
  );
  assert.deepEqual(parsed, []);
  assert.equal(errors.segments, "Сонгосон салбар олдсонгүй.");
});

test("parseSegments: unknown branch id is invalid", async () => {
  const { db } = seedDb();
  const errors: Record<string, string> = {};
  await core.parseSegments(db, TENANT, JSON.stringify([{ branchId: "nope" }]), errors);
  assert.equal(errors.segments, "Сонгосон салбар олдсонгүй.");
});

test("parseSegments: invalid HH:MM time", async () => {
  const { db } = seedDb();
  const errors: Record<string, string> = {};
  // Times chosen so the later end<=start string-comparison branch does not
  // also fire and overwrite this message (the original code runs the two
  // `errors.segments =` assignments unconditionally, not as else-if, so a
  // careless choice of times hides the very message this test targets).
  await core.parseSegments(
    db,
    TENANT,
    JSON.stringify([{ branchId: BRANCH_A.id, startTime: "12:99", endTime: "13:00" }]),
    errors,
  );
  assert.equal(errors.segments, "Цаг буруу (HH:MM).");
});

test("parseSegments: only one of start/end given", async () => {
  const { db } = seedDb();
  const errors: Record<string, string> = {};
  await core.parseSegments(
    db,
    TENANT,
    JSON.stringify([{ branchId: BRANCH_A.id, startTime: "09:00" }]),
    errors,
  );
  assert.equal(
    errors.segments,
    "Эхлэх, дуусах цаг хоёуланг нь оруулна уу (эсвэл хоёуланг нь хоосон орхино).",
  );
});

test("parseSegments: end must be after start", async () => {
  const { db } = seedDb();
  const errors: Record<string, string> = {};
  await core.parseSegments(
    db,
    TENANT,
    JSON.stringify([{ branchId: BRANCH_A.id, startTime: "18:00", endTime: "09:00" }]),
    errors,
  );
  assert.equal(errors.segments, "Дуусах цаг эхлэх цагаас хойш байна.");
});

test("parseSegments: valid multi-branch segments parse cleanly, no errors", async () => {
  const { db } = seedDb();
  const errors: Record<string, string> = {};
  const parsed = await core.parseSegments(
    db,
    TENANT,
    JSON.stringify([
      { branchId: BRANCH_A.id, startTime: "09:00", endTime: "13:00" },
      { branchId: BRANCH_B.id, startTime: "14:00", endTime: "18:00" },
    ]),
    errors,
  );
  assert.deepEqual(errors, {});
  assert.equal(parsed.length, 2);
});

// --- upsertEmployeeShiftCommand ------------------------------------------------

test("upsertEmployeeShiftCommand: scope=date, isWorking with segments, then re-upsert replaces segments", async () => {
  const { db, exceptions } = seedDb();
  const first = await core.upsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    userId: USER_1.id,
    scope: "date",
    isWorking: true,
    segmentsJson: JSON.stringify([{ branchId: BRANCH_A.id, startTime: "09:00", endTime: "13:00" }]),
    date: "2026-09-24",
    weekday: "",
  });
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.message, "Хадгалагдлаа.");
    assert.equal(first.scope, "date");
    assert.equal(first.date, "2026-09-24");
  }
  assert.equal(exceptions.length, 1);
  assert.equal(exceptions[0].segments.length, 1);

  const second = await core.upsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    userId: USER_1.id,
    scope: "date",
    isWorking: true,
    segmentsJson: JSON.stringify([
      { branchId: BRANCH_A.id, startTime: "09:00", endTime: "13:00" },
      { branchId: BRANCH_B.id, startTime: "14:00", endTime: "18:00" },
    ]),
    date: "2026-09-24",
    weekday: "",
  });
  assert.equal(second.ok, true);
  assert.equal(exceptions.length, 1, "same date upserts in place, does not duplicate");
  assert.equal(exceptions[0].segments.length, 2, "old segments replaced (deleteMany + create)");
});

test("upsertEmployeeShiftCommand: scope=date rejects malformed date", async () => {
  const { db } = seedDb();
  const result = await core.upsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    userId: USER_1.id,
    scope: "date",
    isWorking: false,
    segmentsJson: "[]",
    date: "09-24-2026",
    weekday: "",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "VALIDATION");
    assert.equal(result.message, "Огноо буруу.");
  }
});

test("upsertEmployeeShiftCommand: scope=weekday writes EmployeeWorkSchedule", async () => {
  const { db, workSchedules } = seedDb();
  const result = await core.upsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    userId: USER_1.id,
    scope: "weekday",
    isWorking: true,
    segmentsJson: JSON.stringify([{ branchId: BRANCH_A.id, startTime: null, endTime: null }]),
    date: "",
    weekday: "MON",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.scope, "weekday");
    assert.equal(result.weekday, "MON");
  }
  assert.equal(workSchedules.length, 1);
  assert.equal(workSchedules[0].weekday, "MON");
});

test("upsertEmployeeShiftCommand: scope=weekday rejects invalid weekday", async () => {
  const { db } = seedDb();
  const result = await core.upsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    userId: USER_1.id,
    scope: "weekday",
    isWorking: false,
    segmentsJson: "[]",
    date: "",
    weekday: "MONDAY",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "VALIDATION");
    assert.equal(result.message, "Гараг буруу.");
  }
});

test("upsertEmployeeShiftCommand: not working skips segment parsing entirely (no branch validation)", async () => {
  const { db, workSchedules } = seedDb();
  const result = await core.upsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    userId: USER_1.id,
    scope: "weekday",
    isWorking: false,
    segmentsJson: "not even json",
    date: "",
    weekday: "TUE",
  });
  assert.equal(result.ok, true);
  assert.equal(workSchedules[0].isWorking, false);
  assert.deepEqual(workSchedules[0].segments, []);
});

test("upsertEmployeeShiftCommand: propagates segment validation field errors, no fallback message", async () => {
  const { db } = seedDb();
  const result = await core.upsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    userId: USER_1.id,
    scope: "date",
    isWorking: true,
    segmentsJson: "[]",
    date: "2026-09-24",
    weekday: "",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "VALIDATION");
    assert.equal("message" in result ? result.message : undefined, undefined);
    assert.equal((result as { fieldErrors?: Record<string, string> }).fieldErrors?.segments, "Дор хаяж нэг салбар сонгоно уу.");
  }
});

// --- resetEmployeeShiftCommand --------------------------------------------------

test("resetEmployeeShiftCommand: scope=date deletes the exception row", async () => {
  const { db, exceptions } = seedDb();
  await core.upsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    userId: USER_1.id,
    scope: "date",
    isWorking: true,
    segmentsJson: JSON.stringify([{ branchId: BRANCH_A.id, startTime: null, endTime: null }]),
    date: "2026-09-24",
    weekday: "",
  });
  assert.equal(exceptions.length, 1);
  const result = await core.resetEmployeeShiftCommand(db, {
    userId: USER_1.id,
    scope: "date",
    date: "2026-09-24",
    weekday: "",
  });
  assert.equal(result.ok, true);
  assert.equal(exceptions.length, 0);
});

test("resetEmployeeShiftCommand: scope=weekday deletes the work-schedule row", async () => {
  const { db, workSchedules } = seedDb();
  await core.upsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    userId: USER_1.id,
    scope: "weekday",
    isWorking: true,
    segmentsJson: JSON.stringify([{ branchId: BRANCH_A.id, startTime: null, endTime: null }]),
    date: "",
    weekday: "WED",
  });
  assert.equal(workSchedules.length, 1);
  const result = await core.resetEmployeeShiftCommand(db, {
    userId: USER_1.id,
    scope: "weekday",
    date: "",
    weekday: "WED",
  });
  assert.equal(result.ok, true);
  assert.equal(workSchedules.length, 0);
});

test("resetEmployeeShiftCommand: rejects malformed date/weekday as VALIDATION, no-op", async () => {
  const { db } = seedDb();
  const badDate = await core.resetEmployeeShiftCommand(db, {
    userId: USER_1.id,
    scope: "date",
    date: "not-a-date",
    weekday: "",
  });
  assert.equal(badDate.ok, false);
  const badWeekday = await core.resetEmployeeShiftCommand(db, {
    userId: USER_1.id,
    scope: "weekday",
    date: "",
    weekday: "NOPE",
  });
  assert.equal(badWeekday.ok, false);
});

// --- bulkUpsertEmployeeShiftCommand ---------------------------------------------

test("bulkUpsertEmployeeShiftCommand: scope=weekday dedupes same (user, weekday) pair across targets", async () => {
  const { db, workSchedules } = seedDb();
  const result = await core.bulkUpsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    scope: "weekday",
    isWorking: true,
    segmentsJson: JSON.stringify([{ branchId: BRANCH_A.id, startTime: null, endTime: null }]),
    targetsJson: JSON.stringify([
      { userId: USER_1.id, date: "2026-09-21", weekday: "MON" },
      { userId: USER_1.id, date: "2026-09-28", weekday: "MON" }, // same user+weekday, different date -> deduped
      { userId: USER_2.id, date: "2026-09-21", weekday: "MON" },
    ]),
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.applied, 2, "user1:MON deduped once, user2:MON once");
    assert.equal(result.scope, "weekday");
  }
  assert.equal(workSchedules.length, 2);
});

test("bulkUpsertEmployeeShiftCommand: filters targets to users within the actor's tenant", async () => {
  const { db, workSchedules } = seedDb();
  const result = await core.bulkUpsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    scope: "weekday",
    isWorking: true,
    segmentsJson: JSON.stringify([{ branchId: BRANCH_A.id, startTime: null, endTime: null }]),
    targetsJson: JSON.stringify([
      { userId: USER_1.id, date: "2026-09-21", weekday: "MON" },
      { userId: FOREIGN_USER.id, date: "2026-09-21", weekday: "MON" },
    ]),
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.applied, 1, "foreign-tenant user is skipped");
  assert.equal(workSchedules.length, 1);
  assert.equal(workSchedules[0].userId, USER_1.id);
});

test("bulkUpsertEmployeeShiftCommand: scope=date applies per selected date, no dedupe across distinct dates", async () => {
  const { db, exceptions } = seedDb();
  const result = await core.bulkUpsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    scope: "date",
    isWorking: true,
    segmentsJson: JSON.stringify([{ branchId: BRANCH_A.id, startTime: null, endTime: null }]),
    targetsJson: JSON.stringify([
      { userId: USER_1.id, date: "2026-09-21", weekday: "MON" },
      { userId: USER_1.id, date: "2026-09-22", weekday: "TUE" },
    ]),
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.applied, 2);
  assert.equal(exceptions.length, 2);
});

test("bulkUpsertEmployeeShiftCommand: unreadable targetsJson", async () => {
  const { db } = seedDb();
  const result = await core.bulkUpsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    scope: "date",
    isWorking: false,
    segmentsJson: "[]",
    targetsJson: "{not json",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "VALIDATION");
    assert.equal(result.message, "Сонголт уншигдсангүй.");
  }
});

test("bulkUpsertEmployeeShiftCommand: empty targets array requires at least one cell", async () => {
  const { db } = seedDb();
  const result = await core.bulkUpsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    scope: "date",
    isWorking: false,
    segmentsJson: "[]",
    targetsJson: "[]",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "VALIDATION");
    assert.equal(result.message, "Дор хаяж нэг нүд сонгоно уу.");
  }
});

test("bulkUpsertEmployeeShiftCommand: propagates segment field errors when isWorking and segments invalid", async () => {
  const { db } = seedDb();
  const result = await core.bulkUpsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    scope: "weekday",
    isWorking: true,
    segmentsJson: "[]",
    targetsJson: JSON.stringify([{ userId: USER_1.id, date: "2026-09-21", weekday: "MON" }]),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "VALIDATION");
    assert.equal((result as { fieldErrors?: Record<string, string> }).fieldErrors?.segments, "Дор хаяж нэг салбар сонгоно уу.");
  }
});

// --- Consumption boundary: what the core writes is what resolution reads -----
//
// `lib/employee-branch-lock.ts`'s `resolveTodayLockedBranch` needs a live
// Prisma client (it queries `prisma.user.findUnique`/`prisma.branch.findMany`
// after the core has written), so it cannot run here without a database. What
// *can* be proven without one: the exact shape the core persists — the
// `{weekday, isWorking, segments: [{branchId, startTime, endTime}]}` row for
// `EmployeeWorkSchedule` (and the analogous `EmployeeScheduleException` shape
// for `scope=date`) — is precisely what `resolveEmployeeDay` (the pure
// function `resolveTodayLockedBranch` calls right after its own Prisma reads,
// see lib/employee-branch-lock.ts lines 73-79) consumes as `weeklyRules`/
// `exceptions`. This test writes through the real core against the fake db,
// reads the row back in the exact select shape `resolveTodayLockedBranch`
// uses, and feeds it to the real (unmodified) `resolveEmployeeDay` — proving
// the two ends of the boundary agree on shape and values.
test("core write shape is exactly what resolveEmployeeDay (used by resolveTodayLockedBranch) consumes — weekday scope", async () => {
  const { db, workSchedules } = seedDb();
  await core.upsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    userId: USER_1.id,
    scope: "weekday",
    isWorking: true,
    segmentsJson: JSON.stringify([{ branchId: BRANCH_A.id, startTime: "09:00", endTime: "18:00" }]),
    date: "",
    weekday: "THU",
  });

  // Re-shape exactly as `resolveTodayLockedBranch`'s `prisma.user.findUnique`
  // select does: `workSchedule: { where: { weekday }, select: { weekday,
  // isWorking, segments: { select: { branchId, startTime, endTime } } } }`.
  const row = workSchedules.find((w) => w.userId === USER_1.id && w.weekday === "THU");
  assert.ok(row, "the row the core wrote must be found by the same (userId, weekday) key the lock resolver queries");
  const weeklyRules = [
    {
      weekday: row!.weekday as never,
      isWorking: row!.isWorking,
      segments: row!.segments.map((s) => ({ branchId: s.branchId, startTime: s.startTime, endTime: s.endTime })),
    },
  ];

  const resolved = resolution.resolveEmployeeDay({
    dateStr: "2026-09-24", // a Thursday
    weekday: "THU",
    homeBranchId: null,
    weeklyRules,
    exceptions: [],
  });

  assert.equal(resolved.source, "weekly");
  assert.equal(resolved.working, true);
  assert.deepEqual(resolved.segments, [{ branchId: BRANCH_A.id, startTime: "09:00", endTime: "18:00" }]);
});

test("core write shape is exactly what resolveEmployeeDay consumes — date/exception scope", async () => {
  const { db, exceptions } = seedDb();
  await core.upsertEmployeeShiftCommand(db, {
    tenantId: TENANT,
    userId: USER_1.id,
    scope: "date",
    isWorking: true,
    segmentsJson: JSON.stringify([{ branchId: BRANCH_B.id, startTime: null, endTime: null }]),
    date: "2026-09-24",
    weekday: "",
  });

  const row = exceptions.find((e) => e.userId === USER_1.id && e.date === "2026-09-24");
  assert.ok(row);
  const resolved = resolution.resolveEmployeeDay({
    dateStr: "2026-09-24",
    weekday: "THU",
    homeBranchId: null,
    weeklyRules: [],
    exceptions: [
      {
        date: row!.date,
        isWorking: row!.isWorking,
        segments: row!.segments.map((s) => ({ branchId: s.branchId, startTime: s.startTime, endTime: s.endTime })),
      },
    ],
  });

  assert.equal(resolved.source, "exception");
  assert.equal(resolved.working, true);
  assert.deepEqual(resolved.segments, [{ branchId: BRANCH_B.id, startTime: null, endTime: null }]);
});

// --- Source-pattern: the action delegates to the core, not a parallel copy ----

test("upsertEmployeeShiftAction delegates to upsertEmployeeShiftCommand, not an inline reimplementation", () => {
  const source = src("../app/_actions/employee-schedule.ts");
  assert.match(source, /import\s*{[^}]*upsertEmployeeShiftCommand[^}]*}\s*from\s*"@\/lib\/employee-schedule-commands"/);
  assert.match(source, /upsertEmployeeShiftCommand\(prisma,/);
  // The action must not re-parse segments or touch the mutation models itself.
  assert.doesNotMatch(source, /JSON\.parse/);
  assert.doesNotMatch(source, /employeeScheduleException\.upsert/);
  assert.doesNotMatch(source, /employeeWorkSchedule\.upsert/);
});

test("resetEmployeeShiftAction and bulkUpsertEmployeeShiftAction also delegate to the core", () => {
  const source = src("../app/_actions/employee-schedule.ts");
  assert.match(source, /resetEmployeeShiftCommand\(prisma,/);
  assert.match(source, /bulkUpsertEmployeeShiftCommand\(prisma,/);
});

test("the core module has no next/server-only imports (framework-free lib)", () => {
  const source = src("../lib/employee-schedule-commands.ts");
  assert.doesNotMatch(source, /"use server"/);
  assert.doesNotMatch(source, /next\/cache/);
  assert.doesNotMatch(source, /next\/navigation/);
});
