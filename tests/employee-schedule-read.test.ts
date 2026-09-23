import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";

// `app/dashboard/employees/schedule/page.tsx` and
// `app/dashboard/my-schedule/page.tsx` are server components (transitively
// pull in "server-only" via requireUser()/prisma), so they can't be imported
// directly by plain `tsx --test` — same import barrier as the action files.
// These tests exercise the extracted `lib/employee-schedule-read.ts` loaders
// against an in-memory fake Prisma client, and a source-pattern test proves
// both pages call the loader instead of querying inline.

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

let readLib: typeof import("../lib/employee-schedule-read");

before(async () => {
  readLib = await import("../lib/employee-schedule-read");
});

function src(relPath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relPath), "utf8");
}

// --- In-memory fake Prisma client -------------------------------------------

const TENANT = "tenant-1";

type FakeBranch = {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  openTime: string | null;
  closeTime: string | null;
  schedules: { weekday: string; isOpen: boolean; openTime: string | null; closeTime: string | null }[];
};

type FakeUser = {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isOwner: boolean;
  roleName: string | null;
  branchId: string | null;
  workSchedule: { weekday: string; isWorking: boolean; segments: { branchId: string; startTime: string | null; endTime: string | null }[] }[];
  scheduleExceptions: { date: string; isWorking: boolean; label: string | null; segments: { branchId: string; startTime: string | null; endTime: string | null }[] }[];
};

function makeFakeDb(seed: { branches: FakeBranch[]; users: FakeUser[] }) {
  const { branches, users } = seed;

  const db = {
    user: {
      async findMany({ where }: { where: { tenantId: string; isActive: boolean; branchId?: string; OR?: unknown[] } }) {
        let matched = users.filter((u) => u.tenantId === where.tenantId && u.isActive === where.isActive);
        if (where.branchId) matched = matched.filter((u) => u.branchId === where.branchId);
        if (where.OR) {
          const q = extractQ();
          if (q) {
            matched = matched.filter(
              (u) =>
                u.firstName.toLowerCase().includes(q) ||
                u.lastName.toLowerCase().includes(q) ||
                (u.roleName ?? "").toLowerCase().includes(q),
            );
          }
        }
        return matched.map((u) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          isOwner: u.isOwner,
          role: u.roleName ? { name: u.roleName } : null,
          branchId: u.branchId,
          branch: u.branchId ? { id: u.branchId, name: branches.find((b) => b.id === u.branchId)?.name ?? "—" } : null,
          workSchedule: u.workSchedule,
          scheduleExceptions: u.scheduleExceptions,
        }));
      },
      async findUnique({ where }: { where: { id: string } }) {
        const u = users.find((x) => x.id === where.id);
        if (!u) return null;
        return {
          firstName: u.firstName,
          lastName: u.lastName,
          isOwner: u.isOwner,
          role: u.roleName ? { name: u.roleName } : null,
          branchId: u.branchId,
          branch: u.branchId ? { id: u.branchId, name: branches.find((b) => b.id === u.branchId)?.name ?? "—" } : null,
          workSchedule: u.workSchedule,
          scheduleExceptions: u.scheduleExceptions,
        };
      },
      async groupBy({ where }: { where: { tenantId: string; isActive: boolean } }) {
        const matched = users.filter((u) => u.tenantId === where.tenantId && u.isActive === where.isActive);
        const byBranch = new Map<string, number>();
        for (const u of matched) {
          const key = u.branchId ?? "";
          byBranch.set(key, (byBranch.get(key) ?? 0) + 1);
        }
        return [...byBranch.entries()].map(([branchId, count]) => ({
          branchId: branchId || null,
          _count: { _all: count },
        }));
      },
    },
    branch: {
      async findMany({ where }: { where: { tenantId: string; isActive: boolean } }) {
        return branches
          .filter((b) => b.tenantId === where.tenantId && b.isActive === where.isActive)
          .map((b) => ({
            id: b.id,
            name: b.name,
            openTime: b.openTime,
            closeTime: b.closeTime,
            schedules: b.schedules,
          }));
      },
    },
  };

  function extractQ(): string | null {
    return currentQ;
  }

  return db as unknown as import("../lib/employee-schedule-read").ScheduleReadDb;
}

// The fake's `findMany` needs the raw `q` string (the real where-clause is
// opaque `Prisma.UserWhereInput`), so tests set this module-level var right
// before calling the loader with a search term. Simpler than parsing the OR
// clause structurally, and the loader's own construction of that clause is
// exercised for real (this only fakes matching it).
let currentQ = "";

const BRANCH_MAIN: FakeBranch = {
  id: "branch-main",
  tenantId: TENANT,
  name: "Төв салбар",
  isActive: true,
  openTime: "09:00",
  closeTime: "18:00",
  schedules: [],
};
const BRANCH_SECOND: FakeBranch = {
  id: "branch-second",
  tenantId: TENANT,
  name: "Хоёрдугаар салбар",
  isActive: true,
  openTime: "10:00",
  closeTime: "19:00",
  schedules: [],
};

function baseUser(overrides: Partial<FakeUser>): FakeUser {
  return {
    id: "u1",
    tenantId: TENANT,
    firstName: "Бат",
    lastName: "Дорж",
    isActive: true,
    isOwner: false,
    roleName: "Механик",
    branchId: BRANCH_MAIN.id,
    workSchedule: [],
    scheduleExceptions: [],
    ...overrides,
  };
}

test("loadEmployeeScheduleGrid: default-source day falls back to the employee's home branch, no override", async () => {
  const db = makeFakeDb({ branches: [BRANCH_MAIN, BRANCH_SECOND], users: [baseUser({})] });
  currentQ = "";
  const result = await readLib.loadEmployeeScheduleGrid({
    db,
    tenantId: TENANT,
    dates: ["2026-09-24"],
  });
  assert.equal(result.rows.length, 1);
  const cell = result.rows[0].cells["2026-09-24"];
  assert.equal(cell.source, "default");
  assert.equal(cell.working, true);
  assert.equal(cell.segments[0].branchId, BRANCH_MAIN.id);
  // Auto hours (from BranchSchedule/open-close) fill in when no explicit time.
  assert.equal(cell.segments[0].customTime, false);
});

test("loadEmployeeScheduleGrid: weekly override source wins over default", async () => {
  const user = baseUser({
    workSchedule: [
      {
        weekday: "THU",
        isWorking: true,
        segments: [{ branchId: BRANCH_SECOND.id, startTime: "08:00", endTime: "12:00" }],
      },
    ],
  });
  const db = makeFakeDb({ branches: [BRANCH_MAIN, BRANCH_SECOND], users: [user] });
  currentQ = "";
  const result = await readLib.loadEmployeeScheduleGrid({
    db,
    tenantId: TENANT,
    dates: ["2026-09-24"], // a Thursday
  });
  const cell = result.rows[0].cells["2026-09-24"];
  assert.equal(cell.source, "weekly");
  assert.equal(cell.segments[0].branchId, BRANCH_SECOND.id);
  assert.equal(cell.segments[0].customTime, true);
});

test("loadEmployeeScheduleGrid: exception source wins over weekly", async () => {
  const user = baseUser({
    workSchedule: [{ weekday: "THU", isWorking: true, segments: [{ branchId: BRANCH_MAIN.id, startTime: null, endTime: null }] }],
    scheduleExceptions: [
      { date: "2026-09-24", isWorking: false, label: "Амарна", segments: [] },
    ],
  });
  const db = makeFakeDb({ branches: [BRANCH_MAIN, BRANCH_SECOND], users: [user] });
  currentQ = "";
  const result = await readLib.loadEmployeeScheduleGrid({
    db,
    tenantId: TENANT,
    dates: ["2026-09-24"],
  });
  const cell = result.rows[0].cells["2026-09-24"];
  assert.equal(cell.source, "exception");
  assert.equal(cell.working, false);
  assert.deepEqual(cell.segments, []);
});

test("loadEmployeeScheduleGrid: branch filter narrows rows, branch chip counts stay unfiltered", async () => {
  const u1 = baseUser({ id: "u1", branchId: BRANCH_MAIN.id });
  const u2 = baseUser({ id: "u2", firstName: "Сүх", lastName: "Бат", branchId: BRANCH_SECOND.id });
  const db = makeFakeDb({ branches: [BRANCH_MAIN, BRANCH_SECOND], users: [u1, u2] });
  currentQ = "";
  const result = await readLib.loadEmployeeScheduleGrid({
    db,
    tenantId: TENANT,
    dates: ["2026-09-24"],
    branchId: BRANCH_MAIN.id,
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].id, "u1");
  // Chip counts are the tenant-wide totals, independent of the branch filter.
  assert.equal(result.totalEmployees, 2);
  assert.equal(result.countByBranch.get(BRANCH_MAIN.id), 1);
  assert.equal(result.countByBranch.get(BRANCH_SECOND.id), 1);
});

test("loadEmployeeScheduleGrid: employee search matches name or role name", async () => {
  const u1 = baseUser({ id: "u1", firstName: "Бат", lastName: "Дорж", roleName: "Механик" });
  const u2 = baseUser({ id: "u2", firstName: "Сүх", lastName: "Очир", roleName: "Менежер" });
  const db = makeFakeDb({ branches: [BRANCH_MAIN, BRANCH_SECOND], users: [u1, u2] });
  currentQ = "менежер";
  const result = await readLib.loadEmployeeScheduleGrid({
    db,
    tenantId: TENANT,
    dates: ["2026-09-24"],
    q: "менежер",
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].id, "u2");
});

test("loadEmployeeScheduleGrid: owner without a role is labelled Админ", async () => {
  const owner = baseUser({ isOwner: true, roleName: null });
  const db = makeFakeDb({ branches: [BRANCH_MAIN], users: [owner] });
  currentQ = "";
  const result = await readLib.loadEmployeeScheduleGrid({ db, tenantId: TENANT, dates: ["2026-09-24"] });
  assert.equal(result.rows[0].roleName, "Админ");
});

test("loadMySchedule: returns the caller's own row shaped identically to the grid's row", async () => {
  const me = baseUser({ id: "me", workSchedule: [{ weekday: "THU", isWorking: true, segments: [{ branchId: BRANCH_MAIN.id, startTime: "09:00", endTime: "18:00" }] }] });
  const db = makeFakeDb({ branches: [BRANCH_MAIN], users: [me] });
  const result = await readLib.loadMySchedule({ db, tenantId: TENANT, userId: "me", dates: ["2026-09-24"] });
  assert.ok(result.row);
  assert.equal(result.row!.id, "me");
  assert.equal(result.cells["2026-09-24"].source, "weekly");
});

test("loadMySchedule: unknown user still returns full default cells for every date (no gaps for the calendar)", async () => {
  const db = makeFakeDb({ branches: [BRANCH_MAIN], users: [] });
  const result = await readLib.loadMySchedule({
    db,
    tenantId: TENANT,
    userId: "ghost",
    dates: ["2026-09-24", "2026-09-25"],
  });
  assert.equal(result.row, null);
  assert.equal(Object.keys(result.cells).length, 2);
  assert.equal(result.cells["2026-09-24"].source, "default");
  assert.equal(result.cells["2026-09-24"].working, false);
  assert.deepEqual(result.cells["2026-09-24"].segments, []);
});

// --- Source-pattern: pages call the loaders, not inline Prisma -------------

test("employees/schedule page.tsx calls loadEmployeeScheduleGrid instead of querying inline", () => {
  const source = src("../app/dashboard/employees/schedule/page.tsx");
  assert.match(source, /import\s*{\s*loadEmployeeScheduleGrid\s*}\s*from\s*"@\/lib\/employee-schedule-read"/);
  assert.match(source, /loadEmployeeScheduleGrid\(\{/);
  assert.doesNotMatch(source, /prisma\.user\.findMany/);
  assert.doesNotMatch(source, /prisma\.user\.groupBy/);
});

test("my-schedule page.tsx calls loadMySchedule instead of querying inline", () => {
  const source = src("../app/dashboard/my-schedule/page.tsx");
  assert.match(source, /import\s*{\s*loadMySchedule\s*}\s*from\s*"@\/lib\/employee-schedule-read"/);
  assert.match(source, /loadMySchedule\(\{/);
  assert.doesNotMatch(source, /prisma\.user\.findUnique/);
});

test("neither page.tsx imports resolveEmployeeDay directly anymore (moved into the read loader)", () => {
  const gridSource = src("../app/dashboard/employees/schedule/page.tsx");
  const mySource = src("../app/dashboard/my-schedule/page.tsx");
  assert.doesNotMatch(gridSource, /resolveEmployeeDay/);
  assert.doesNotMatch(mySource, /resolveEmployeeDay/);
});
