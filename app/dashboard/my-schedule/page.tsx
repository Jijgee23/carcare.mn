import { businessDateKey, resolveEffectiveSchedule } from "@/lib/branch-effective-schedule";
import { WEEK_DAYS, weekdayOfDateStr } from "@/lib/branches";
import { requireUser } from "@/lib/auth";
import {
  firstOfMonth,
  mondayOfWeek,
  monthDates,
  resolveEmployeeDay,
  shiftMonth,
  weekDates,
} from "@/lib/employee-schedule";
import { prisma } from "@/lib/prisma";
import { ScheduleGrid, type EmployeeScheduleRow } from "../employees/schedule/schedule-grid";
import { ScheduleHeader } from "../employees/schedule/schedule-header";
import { ScheduleNav } from "../employees/schedule/schedule-nav";
import { MonthCalendar } from "./month-calendar";

export const metadata = {
  title: "Миний хувиар",
};

type ViewMode = "week" | "month";

// Ажилтан бүр (ямар ч эрхтэй байсан ч — employees.view шаардахгүй, зөвхөн
// ӨӨРИЙНХӨӨ хувиарыг харна) энэ хуудсаар өөрийн ажлын хувиарыг ХАРАХ ЗӨВХӨН
// (view-only, canEdit=false) горимоор харна. Засах бол
// /dashboard/employees/schedule (employees.schedule эрхтэй хүн).
export default async function MySchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ anchor?: string; view?: string }>;
}) {
  const user = await requireUser();

  const { anchor: anchorParam, view: viewParam } = await searchParams;
  const view: ViewMode = viewParam === "month" ? "month" : "week";
  const anchor = anchorParam && /^\d{4}-\d{2}-\d{2}$/.test(anchorParam) ? anchorParam : businessDateKey();
  const todayStr = businessDateKey();

  const rangeStart = view === "month" ? firstOfMonth(anchor) : mondayOfWeek(anchor);
  const dates = view === "month" ? monthDates(rangeStart) : weekDates(rangeStart);

  const [me, branches] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        firstName: true,
        lastName: true,
        isOwner: true,
        role: { select: { name: true } },
        branchId: true,
        branch: { select: { id: true, name: true } },
        workSchedule: {
          select: {
            weekday: true,
            isWorking: true,
            segments: {
              orderBy: { order: "asc" },
              select: { branchId: true, startTime: true, endTime: true },
            },
          },
        },
        scheduleExceptions: {
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
              orderBy: { order: "asc" },
              select: { branchId: true, startTime: true, endTime: true },
            },
          },
        },
      },
    }),
    prisma.branch.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        openTime: true,
        closeTime: true,
        schedules: { select: { weekday: true, isOpen: true, openTime: true, closeTime: true } },
      },
    }),
  ]);

  const branchMap = new Map(branches.map((b) => [b.id, b]));
  function autoHours(branchIdVal: string, dateStr: string) {
    const b = branchMap.get(branchIdVal);
    if (!b) return null;
    const eff = resolveEffectiveSchedule({
      dateStr,
      branch: { openTime: b.openTime, closeTime: b.closeTime, schedules: b.schedules },
    });
    return eff.open && eff.openTime && eff.closeTime
      ? { start: eff.openTime, end: eff.closeTime }
      : null;
  }

  const cells = Object.fromEntries(
    dates.map((dateStr) => {
      const weekday = weekdayOfDateStr(dateStr);
      const resolved = me
        ? resolveEmployeeDay({
            dateStr,
            weekday,
            homeBranchId: me.branchId,
            weeklyRules: me.workSchedule,
            exceptions: me.scheduleExceptions,
          })
        : { working: false, source: "default" as const, segments: [] };
      const customTime = resolved.source !== "default";
      return [
        dateStr,
        {
          weekday,
          working: resolved.working,
          source: resolved.source,
          segments: resolved.segments.map((seg) => {
            const auto = !seg.startTime && !seg.endTime ? autoHours(seg.branchId, dateStr) : null;
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
  );

  const rows: EmployeeScheduleRow[] = me
    ? [
        {
          id: user.id,
          name: `${me.lastName} ${me.firstName}`,
          roleName: me.isOwner ? "Админ" : (me.role?.name ?? null),
          homeBranchId: me.branchId,
          homeBranchName: me.branch?.name ?? null,
          cells,
        },
      ]
    : [];

  const anchorHref = (a: string, v: ViewMode = view) => `?anchor=${a}&view=${v}`;
  const prevAnchor = view === "month" ? shiftMonth(rangeStart, -1) : shiftDays(rangeStart, -7);
  const nextAnchor = view === "month" ? shiftMonth(rangeStart, 1) : shiftDays(rangeStart, 7);
  const todayAnchor = view === "month" ? firstOfMonth(todayStr) : mondayOfWeek(todayStr);

  const rangeLabel =
    view === "month" ? rangeStart.slice(0, 7) : `${dates[0]}  —  ${dates[dates.length - 1]}`;
  const header = (
    <ScheduleHeader
      eyebrow="Миний хувиар"
      title="Миний хувиар"
      description="Таны өнөөдрийн болон долоо хоног/сарын ажлын хувиар — аль салбарт, хэдэн цагт ажиллахыг харна."
    />
  );
  const nav = (
    <ScheduleNav
      view={view}
      weekHref={anchorHref(view === "month" ? mondayOfWeek(anchor) : rangeStart, "week")}
      monthHref={anchorHref(view === "week" ? firstOfMonth(anchor) : rangeStart, "month")}
      prevHref={anchorHref(prevAnchor)}
      todayHref={anchorHref(todayAnchor)}
      nextHref={anchorHref(nextAnchor)}
      rangeLabel={rangeLabel}
    />
  );
  const branchList = branches.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      {view === "month" ? (
        <div className="flex flex-col gap-5">
          {header}
          {nav}
          <MonthCalendar dates={dates} cells={cells} todayStr={todayStr} branches={branchList} />
        </div>
      ) : (
        <ScheduleGrid
          header={header}
          toolbar={nav}
          dates={dates}
          weekdayLabels={Object.fromEntries(WEEK_DAYS.map((d) => [d.value, d.short]))}
          rows={rows}
          branches={branchList}
          canEdit={false}
          todayStr={todayStr}
        />
      )}
    </div>
  );
}

/** `dateStr`-ийг `days` хоногоор шилжүүлнэ (7 хоногийн урьд/дараах Даваа олоход). */
function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
