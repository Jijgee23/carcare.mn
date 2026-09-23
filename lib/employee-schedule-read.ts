// P6-B1 — `app/dashboard/employees/schedule/page.tsx` болон
// `app/dashboard/my-schedule/page.tsx`-д шигтгэсэн (inline) өгөгдөл ачаалах
// логикийг (grid week/month, салбарын шүүлтүүр, ажилтан хайлт, салбарын чипийн
// тоо, миний хувийн сар) энд зөөв. Зөвхөн уншина (Prisma read) — бичих
// (mutation) логик `lib/employee-schedule-commands.ts`-д. `resolveEmployeeDay`
// (lib/employee-schedule.ts)-ийг өөрчлөхгүйгээр ашиглаж, plain serializable
// өгөгдөл (Date биш, string) буцаана.

import type { Prisma } from "@/app/generated/prisma/client";
import type { prisma as PrismaSingleton } from "@/lib/prisma";
import { resolveEffectiveSchedule } from "@/lib/branch-effective-schedule";
import { weekdayOfDateStr, type Weekday } from "@/lib/branches";
import { resolveEmployeeDay } from "@/lib/employee-schedule";

export type ScheduleReadDb = typeof PrismaSingleton;

export type ScheduleSegmentView = {
  branchId: string;
  branchName: string;
  startTime: string | null;
  endTime: string | null;
  customTime: boolean;
};

export type ScheduleCellView = {
  weekday: string;
  working: boolean;
  segments: ScheduleSegmentView[];
  source: "exception" | "weekly" | "default";
};

export type EmployeeScheduleRowView = {
  id: string;
  name: string;
  roleName: string | null;
  homeBranchId: string | null;
  homeBranchName: string | null;
  cells: Record<string, ScheduleCellView>;
};

export type ScheduleBranchView = {
  id: string;
  name: string;
  openTime: string | null;
  closeTime: string | null;
  schedules: { weekday: Weekday; isOpen: boolean; openTime: string | null; closeTime: string | null }[];
};

const WORK_SCHEDULE_SELECT = {
  weekday: true,
  isWorking: true,
  segments: {
    orderBy: { order: "asc" as const },
    select: { branchId: true, startTime: true, endTime: true },
  },
} as const;

function scheduleExceptionSelect(dates: string[]) {
  return {
    where: {
      date: {
        gte: new Date(`${dates[0]}T00:00:00.000Z`),
        lte: new Date(`${dates[dates.length - 1]}T00:00:00.000Z`),
      },
    },
    select: {
      date: true,
      isWorking: true,
      label: true,
      segments: {
        orderBy: { order: "asc" as const },
        select: { branchId: true, startTime: true, endTime: true },
      },
    },
  };
}

const BRANCH_SELECT = {
  id: true,
  name: true,
  openTime: true,
  closeTime: true,
  schedules: { select: { weekday: true, isOpen: true, openTime: true, closeTime: true } },
} as const;

/** Салбарын өөрийнх нь тухайн өдрийн auto-цаг (BranchSchedule долоо хоногийн
 * base дүрмээс тооцно, тусгай өдөр/улирлаас биш — v1 хялбарчлал). */
function autoHours(
  branchMap: Map<string, ScheduleBranchView>,
  branchIdVal: string,
  dateStr: string,
): { start: string; end: string } | null {
  const b = branchMap.get(branchIdVal);
  if (!b) return null;
  const eff = resolveEffectiveSchedule({
    dateStr,
    branch: { openTime: b.openTime, closeTime: b.closeTime, schedules: b.schedules },
  });
  return eff.open && eff.openTime && eff.closeTime ? { start: eff.openTime, end: eff.closeTime } : null;
}

function buildCells(
  dates: string[],
  branchMap: Map<string, ScheduleBranchView>,
  employee: {
    branchId: string | null;
    workSchedule: { weekday: string; isWorking: boolean; segments: { branchId: string; startTime: string | null; endTime: string | null }[] }[];
    scheduleExceptions: { date: Date; isWorking: boolean; label: string | null; segments: { branchId: string; startTime: string | null; endTime: string | null }[] }[];
  },
): Record<string, ScheduleCellView> {
  return Object.fromEntries(
    dates.map((dateStr) => {
      const weekday = weekdayOfDateStr(dateStr);
      const resolved = resolveEmployeeDay({
        dateStr,
        weekday,
        homeBranchId: employee.branchId,
        weeklyRules: employee.workSchedule as never,
        exceptions: employee.scheduleExceptions as never,
      });
      const customTime = resolved.source !== "default";
      return [
        dateStr,
        {
          weekday,
          working: resolved.working,
          source: resolved.source,
          segments: resolved.segments.map((seg) => {
            const auto = !seg.startTime && !seg.endTime ? autoHours(branchMap, seg.branchId, dateStr) : null;
            return {
              branchId: seg.branchId,
              branchName: branchMap.get(seg.branchId)?.name ?? "—",
              startTime: seg.startTime ?? auto?.start ?? null,
              endTime: seg.endTime ?? auto?.end ?? null,
              customTime: Boolean(seg.startTime || seg.endTime) && customTime,
            };
          }),
        },
      ];
    }),
  ) as Record<string, ScheduleCellView>;
}

export type EmployeeScheduleGridInput = {
  db: ScheduleReadDb;
  tenantId: string;
  dates: string[];
  branchId?: string;
  q?: string;
};

export type EmployeeScheduleGridResult = {
  rows: EmployeeScheduleRowView[];
  branches: ScheduleBranchView[];
  countByBranch: Map<string, number>;
  totalEmployees: number;
};

/**
 * `/dashboard/employees/schedule` grid-ийн бүх өгөгдлийг ачаална: тухайн
 * (week/month) хугацааны идэвхтэй ажилтнууд (нэр/роль/салбарын нэрээр хайх,
 * `branchId`-аар шүүх), идэвхтэй салбарууд, болон салбарын чип дээрх нийт
 * тоо (хайлт/шүүлтээс хамаарахгүй).
 */
export async function loadEmployeeScheduleGrid(
  input: EmployeeScheduleGridInput,
): Promise<EmployeeScheduleGridResult> {
  const { db, tenantId, dates, branchId = "", q = "" } = input;

  const searchWhere: Prisma.UserWhereInput = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { role: { is: { name: { contains: q, mode: "insensitive" } } } },
        ],
      }
    : {};

  const [employees, branches, branchCounts] = await Promise.all([
    db.user.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(branchId ? { branchId } : {}),
        ...searchWhere,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        isOwner: true,
        role: { select: { name: true } },
        branchId: true,
        branch: { select: { id: true, name: true } },
        workSchedule: { select: WORK_SCHEDULE_SELECT },
        scheduleExceptions: scheduleExceptionSelect(dates),
      },
    }),
    db.branch.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: BRANCH_SELECT,
    }),
    // Салбарын чип дээрх тоо — үндсэн салбараар нь идэвхтэй ажилтны тоо
    // (хайлт/шүүлтээс хамаарахгүй, нийт дүн).
    db.user.groupBy({
      by: ["branchId"],
      where: { tenantId, isActive: true },
      _count: { _all: true },
    }),
  ]);

  const branchMap = new Map(branches.map((b) => [b.id, b]));
  const countByBranch = new Map(branchCounts.map((c) => [c.branchId ?? "", c._count._all]));
  const totalEmployees = branchCounts.reduce((n, c) => n + c._count._all, 0);

  const rows: EmployeeScheduleRowView[] = employees.map((e) => ({
    id: e.id,
    name: `${e.lastName} ${e.firstName}`,
    // Эзэмшигч (isOwner) role-гүй байж болно — ажилтны жагсаалтын адил "Админ".
    roleName: e.isOwner ? "Админ" : (e.role?.name ?? null),
    homeBranchId: e.branchId,
    homeBranchName: e.branch?.name ?? null,
    cells: buildCells(dates, branchMap, e),
  }));

  return { rows, branches, countByBranch, totalEmployees };
}

export type MyScheduleInput = {
  db: ScheduleReadDb;
  tenantId: string;
  userId: string;
  dates: string[];
};

export type MyScheduleResult = {
  row: EmployeeScheduleRowView | null;
  /** Дата бүрийн эс — `row` байхгүй үед ч (олдоогүй хэрэглэгч) анхны утгаар
   * (ажиллахгүй, "default") бүх огноогоор дүүрэн буцна — эх хуудасны адил
   * `MonthCalendar`/`ScheduleGrid`-д хоосон биш бүтэцтэй cells өгнө. */
  cells: Record<string, ScheduleCellView>;
  branches: ScheduleBranchView[];
};

/** `/dashboard/my-schedule`-ийн ганц ажилтны (өөрийнх нь) хугацааны хувиар. */
export async function loadMySchedule(input: MyScheduleInput): Promise<MyScheduleResult> {
  const { db, tenantId, userId, dates } = input;

  const [me, branches] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        isOwner: true,
        role: { select: { name: true } },
        branchId: true,
        branch: { select: { id: true, name: true } },
        workSchedule: { select: WORK_SCHEDULE_SELECT },
        scheduleExceptions: scheduleExceptionSelect(dates),
      },
    }),
    db.branch.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: BRANCH_SELECT,
    }),
  ]);

  const branchMap = new Map(branches.map((b) => [b.id, b]));

  const cells: Record<string, ScheduleCellView> = me
    ? buildCells(dates, branchMap, me)
    : Object.fromEntries(
        dates.map((dateStr) => [
          dateStr,
          { weekday: weekdayOfDateStr(dateStr), working: false, source: "default" as const, segments: [] },
        ]),
      );

  const row: EmployeeScheduleRowView | null = me
    ? {
        id: userId,
        name: `${me.lastName} ${me.firstName}`,
        roleName: me.isOwner ? "Админ" : (me.role?.name ?? null),
        homeBranchId: me.branchId,
        homeBranchName: me.branch?.name ?? null,
        cells,
      }
    : null;

  return { row, cells, branches };
}
