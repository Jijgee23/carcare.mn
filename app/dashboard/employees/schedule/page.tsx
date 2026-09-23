import Link from "next/link";
import { redirect } from "next/navigation";
import { SearchBox } from "@/app/_components/list-filters";
import { businessDateKey } from "@/lib/branch-effective-schedule";
import { WEEK_DAYS } from "@/lib/branches";
import { requireUser } from "@/lib/auth";
import { canView, hasPermission } from "@/lib/auth/roles";
import { firstOfMonth, mondayOfWeek, monthDates, shiftMonth, weekDates } from "@/lib/employee-schedule";
import { loadEmployeeScheduleGrid } from "@/lib/employee-schedule-read";
import { prisma } from "@/lib/prisma";
import { ScheduleGrid } from "./schedule-grid";
import { ScheduleNav } from "./schedule-nav";
import { ScheduleHeader } from "./schedule-header";
import { branchColorClass } from "./schedule-ui";

export const metadata = {
  title: "Ажлын хувиар",
};

type ViewMode = "week" | "month";

export default async function EmployeeSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ anchor?: string; view?: string; branchId?: string; q?: string }>;
}) {
  const user = await requireUser();
  if (!canView(user, "employees")) redirect("/dashboard");
  const canEdit = hasPermission(user, "employees.schedule");

  const { anchor: anchorParam, view: viewParam, branchId = "", q: qParam = "" } = await searchParams;
  const q = qParam.trim();
  const view: ViewMode = viewParam === "month" ? "month" : "week";
  const anchor = anchorParam && /^\d{4}-\d{2}-\d{2}$/.test(anchorParam) ? anchorParam : businessDateKey();
  const todayStr = businessDateKey();

  const rangeStart = view === "month" ? firstOfMonth(anchor) : mondayOfWeek(anchor);
  const dates = view === "month" ? monthDates(rangeStart) : weekDates(rangeStart);

  const { rows, branches, countByBranch, totalEmployees } = await loadEmployeeScheduleGrid({
    db: prisma,
    tenantId: user.tenantId,
    dates,
    branchId,
    q,
  });

  const buildHref = (params: { anchor?: string; view?: ViewMode; branchId?: string }) => {
    const sp = new URLSearchParams();
    sp.set("anchor", params.anchor ?? anchor);
    sp.set("view", params.view ?? view);
    const b = params.branchId ?? branchId;
    if (b) sp.set("branchId", b);
    if (q) sp.set("q", q);
    return `?${sp.toString()}`;
  };
  const prevAnchor = view === "month" ? shiftMonth(rangeStart, -1) : shiftDays(rangeStart, -7);
  const nextAnchor = view === "month" ? shiftMonth(rangeStart, 1) : shiftDays(rangeStart, 7);
  const todayAnchor = view === "month" ? firstOfMonth(todayStr) : mondayOfWeek(todayStr);
  const rangeLabel =
    view === "month" ? rangeStart.slice(0, 7) : `${dates[0]}  —  ${dates[dates.length - 1]}`;

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <ScheduleGrid
        header={
          <ScheduleHeader
            eyebrow="Ажилтнууд"
            title="Ажлын хувиар"
            description={
              view === "month"
                ? "Сарын хувиар — хэн, аль салбарт, хэдэн цагт ажиллахыг харах, шууд өөрчлөх."
                : "Долоо хоногийн хуваарь — хэн, аль салбарт, хэдэн цагт ажиллахыг харах, шууд өөрчлөх."
            }
          />
        }
        toolbar={
          <>
            <ScheduleNav
              view={view}
              weekHref={buildHref({
                anchor: view === "month" ? mondayOfWeek(anchor) : rangeStart,
                view: "week",
              })}
              monthHref={buildHref({
                anchor: view === "week" ? firstOfMonth(anchor) : rangeStart,
                view: "month",
              })}
              prevHref={buildHref({ anchor: prevAnchor })}
              todayHref={buildHref({ anchor: todayAnchor })}
              nextHref={buildHref({ anchor: nextAnchor })}
              rangeLabel={rangeLabel}
            >
              <SearchBox paramName="q" placeholder="Ажилтан хайх" className="w-full sm:w-60" />
            </ScheduleNav>

            <div className="flex flex-wrap items-center gap-2">
              <BranchChip href={buildHref({ branchId: "" })} active={!branchId} count={totalEmployees}>
                Бүх салбар
              </BranchChip>
              {branches.map((b, i) => (
                <BranchChip
                  key={b.id}
                  href={buildHref({ branchId: branchId === b.id ? "" : b.id })}
                  active={branchId === b.id}
                  color={branchColorClass(i)}
                  count={countByBranch.get(b.id) ?? 0}
                >
                  {b.name}
                </BranchChip>
              ))}
            </div>
          </>
        }
        dates={dates}
        weekdayLabels={Object.fromEntries(WEEK_DAYS.map((d) => [d.value, d.short]))}
        rows={rows}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        canEdit={canEdit}
        todayStr={todayStr}
        compact={view === "month"}
      />
    </div>
  );
}

/** Салбарын шүүлтүүрийн pill — өнгөт цэг (хүснэгтийн ээлжийн өнгөтөй ижил),
 * нэр, mono тоо. Идэвхтэй бол accent дүүргэлт. */
function BranchChip({
  href,
  active,
  color,
  count,
  children,
}: {
  href: string;
  active: boolean;
  /** `branchColorClass(i)` — цэгийн өнгө хүснэгтийн ээлжийн өнгөтөй ижил. */
  color?: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
        active
          ? "border-[var(--oc-accent)] bg-[var(--oc-accent)] text-[var(--oc-on-accent)]"
          : "border-[var(--oc-line)] text-[var(--oc-muted)] hover:border-[var(--oc-muted3)]"
      }`}
    >
      {color ? (
        <span
          className={`h-[7px] w-[7px] rounded-full ${
            active ? "bg-[var(--oc-on-accent)]" : `branch-dot ${color}`
          }`}
          aria-hidden
        />
      ) : null}
      <span>{children}</span>
      <span
        className={`font-plex-mono text-[11px] ${
          active ? "text-[var(--oc-on-accent)]/70" : "text-[var(--oc-muted3)]"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

/** `dateStr`-ийг `days` хоногоор шилжүүлнэ (7 хоногийн урьд/дараах Даваа олоход). */
function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
