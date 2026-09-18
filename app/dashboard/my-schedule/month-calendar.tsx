import { ALL_WEEKDAYS, WEEK_DAYS, weekdayOfDateStr } from "@/lib/branches";
import type { ScheduleCell } from "../employees/schedule/schedule-grid";
import { FALLBACK_BRANCH_CLASS, buildBranchColorMap } from "../employees/schedule/schedule-ui";

/**
 * "Миний хувиар"-ын сарын харагдац — зөвхөн ӨӨРИЙН (ганц мөр) хувиарыг
 * харуулдаг тул `ScheduleGrid`-ийн (олон ажилтан × олон өдөр) хүснэгт биш,
 * бодит календарь шиг долоо хоног мөр болгож, гарагаар баганалж харуулна.
 * Ээлжийн хайрцаг/өнгө нь `ScheduleGrid`-тэй ижил (designs/Schedule Calendar).
 */
export function MonthCalendar({
  dates,
  cells,
  todayStr,
  branches,
}: {
  dates: string[];
  cells: Record<string, ScheduleCell>;
  todayStr: string;
  /** Нэрээр эрэмбэлэгдсэн салбарууд — өнгө оноохдоо `ScheduleGrid`-тэй ижил дараалал. */
  branches: { id: string; name: string }[];
}) {
  const branchColor = buildBranchColorMap(branches);
  const leadingBlanks =
    dates.length > 0 ? ALL_WEEKDAYS.indexOf(weekdayOfDateStr(dates[0])) : 0;
  const trailingBlanks = (7 - ((leadingBlanks + dates.length) % 7)) % 7;
  const slots: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...dates,
    ...Array.from({ length: trailingBlanks }, () => null),
  ];
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7));

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--oc-line)] bg-[var(--oc-panel)]">
      <div className="grid grid-cols-7 border-b border-[var(--oc-line)] bg-[var(--oc-panel2)]">
        {WEEK_DAYS.map((d) => {
          const isWeekend = d.value === "SAT" || d.value === "SUN";
          return (
            <div
              key={d.value}
              className={`px-3.5 py-[11px] text-[12px] font-extrabold uppercase tracking-[0.06em] ${
                isWeekend ? "text-[var(--oc-muted3)]" : "text-[var(--oc-muted)]"
              }`}
            >
              {d.short}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7">
        {weeks.map((week, wi) =>
          week.map((dateStr, di) => {
            const borderCls = `${di > 0 ? "border-l" : ""} ${wi > 0 ? "border-t" : ""} border-[var(--oc-line2)]`;
            if (!dateStr) {
              return (
                <div
                  key={`blank-${wi}-${di}`}
                  className={`min-h-[104px] bg-[var(--oc-panel2)]/50 ${borderCls}`}
                />
              );
            }
            const cell = cells[dateStr];
            const hasBranches = Boolean(cell?.working && cell.segments.length > 0);
            const isExplicitOff = Boolean(cell && !cell.working && cell.source !== "default");
            const isToday = dateStr === todayStr;
            return (
              <div
                key={dateStr}
                className={`flex min-h-[104px] flex-col gap-1.5 p-2 transition-colors hover:bg-[var(--oc-panel2)] ${borderCls} ${
                  isToday ? "bg-[var(--oc-accent)]/[0.06]" : ""
                }`}
              >
                <span
                  className={`font-plex-mono text-[12px] font-bold ${
                    isToday ? "text-[var(--oc-accent)]" : "text-[var(--oc-muted2)]"
                  }`}
                >
                  {Number(dateStr.slice(8))}
                </span>
                {hasBranches ? (
                  cell.segments.map((seg, i) => {
                    const color = branchColor.get(seg.branchId) ?? FALLBACK_BRANCH_CLASS;
                    return (
                      <div
                        key={i}
                        className={`shift-box ${color} flex flex-col gap-0.5 rounded-[9px] py-[7px] pl-[11px] pr-[10px]`}
                      >
                        <div className="branch-ink truncate text-[12px] font-bold tracking-[-0.01em]">
                          {seg.branchName}
                        </div>
                        {seg.startTime && seg.endTime ? (
                          <div className="font-plex-mono text-[11px] text-[var(--oc-muted2)]">
                            {seg.startTime}–{seg.endTime}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[9px] border border-dashed border-[var(--oc-line)] p-2.5 text-center text-[12px] text-[var(--oc-muted4)]">
                    {isExplicitOff ? "Амарна" : "—"}
                  </div>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
