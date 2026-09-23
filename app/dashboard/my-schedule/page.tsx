import { businessDateKey } from "@/lib/branch-effective-schedule";
import { WEEK_DAYS } from "@/lib/branches";
import { requireUser } from "@/lib/auth";
import { firstOfMonth, mondayOfWeek, monthDates, shiftMonth, weekDates } from "@/lib/employee-schedule";
import { loadMySchedule } from "@/lib/employee-schedule-read";
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

  const { row, cells, branches } = await loadMySchedule({
    db: prisma,
    tenantId: user.tenantId,
    userId: user.id,
    dates,
  });
  const rows: EmployeeScheduleRow[] = row ? [row] : [];

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
