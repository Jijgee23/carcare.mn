"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import {
  bulkUpsertEmployeeShiftAction,
  resetEmployeeShiftAction,
  upsertEmployeeShiftAction,
  type EmployeeScheduleActionState,
} from "@/app/_actions/employee-schedule";
import { Btn } from "@/app/_components/landing-ops-ui";
import { Modal } from "@/app/_components/modal";
import { Select } from "@/app/_components/select";
import {
  FALLBACK_BRANCH_CLASS,
  buildBranchColorMap,
  formatHours,
  formatMonthDay,
  initialsOf,
  segmentHours,
} from "./schedule-ui";

// 24 цагийн формат, 30 минутын алхамтай — native `<input type="time">`-ийн
// browser/locale-ээс хамаарсан (заримдаа 12ц AM/PM) харагдацаас зайлсхийж,
// `branch-form.tsx`/`schedule-manager.tsx`-ийн адил Select dropdown ашиглана.
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const v = `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`;
  return { value: v, label: v };
});

export type ScheduleSegment = {
  branchId: string;
  branchName: string;
  startTime: string | null;
  endTime: string | null;
  // true бол startTime/endTime нь ажилтны өөрийнх нь override — false бол
  // ажилладаг салбарынхаа тухайн өдрийн хуваариас автоматаар тооцоологдсон.
  customTime: boolean;
};

export type ScheduleCell = {
  weekday: string;
  working: boolean;
  segments: ScheduleSegment[];
  source: "exception" | "weekly" | "default";
};

export type EmployeeScheduleRow = {
  id: string;
  name: string;
  /** Албан тушаал (Role.name; isOwner бол "Админ") — нэрийн доор харуулна. */
  roleName: string | null;
  homeBranchId: string | null;
  homeBranchName: string | null;
  cells: Record<string, ScheduleCell>;
};

const WEEKDAY_LONG: Record<string, string> = {
  MON: "Даваа",
  TUE: "Мягмар",
  WED: "Лхагва",
  THU: "Пүрэв",
  FRI: "Баасан",
  SAT: "Бямба",
  SUN: "Ням",
};

function weekdayOf(dateStr: string): string {
  const idx = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][idx] ?? "MON";
}

function cellKey(userId: string, date: string): string {
  return `${userId}|${date}`;
}

/** Нүд "ажилладаг" гэж тооцох эсэх — `working=true` ч segment-гүй бол (ж: салбаргүй
 * өвчлөх/устсан segment) бодит салбар харуулах юмгүй тул үгүй. */
function cellHasBranches(cell: ScheduleCell | undefined): boolean {
  return Boolean(cell?.working && cell.segments.length > 0);
}

/** "Амарна"-г ЗӨВХӨН тодорхой override (weekly/exception)-оор өдрийг амарна гэж
 * ЗААСАН үед л харуулна — override огт байхгүй (`source === "default"`) бол
 * "тодорхойгүй" гэж ялгаж харуулна (эс бөгөөс хувиаргүй ажилтны бүх өдөр худал
 * "Амарна" болж дүүрдэг). */
function cellIsExplicitOff(cell: ScheduleCell | undefined): boolean {
  return Boolean(cell && !cell.working && cell.source !== "default");
}

type BulkTarget = { userId: string; date: string; weekday: string };

export function ScheduleGrid({
  dates,
  weekdayLabels,
  rows,
  branches,
  canEdit,
  todayStr,
  compact = false,
  header,
  toolbar,
}: {
  dates: string[];
  weekdayLabels: Record<string, string>;
  rows: EmployeeScheduleRow[];
  branches: { id: string; name: string }[];
  canEdit: boolean;
  todayStr: string;
  /** Сарын харагдац — багана олон (28-31) тул нягт, товч эсийн загвар. */
  compact?: boolean;
  /** Хуудасны гарчгийн блок (eyebrow + h1 + тайлбар) — баруун талд нь bulk
   * засварын товчнууд зэрэгцэн гарна (designs/Schedule Calendar). */
  header?: ReactNode;
  /** Навигаци/шүүлтүүрийн мөрүүд — гарчиг ба хүснэгтийн дунд. */
  toolbar?: ReactNode;
}) {
  const [editing, setEditing] = useState<{
    userId: string;
    employeeName: string;
    homeBranchId: string | null;
    homeBranchName: string | null;
    date: string;
    cell: ScheduleCell;
  } | null>(null);

  // Олноор засах (bulk) горим — олон (ажилтан × өдөр) нүд сонгоод НЭГ зэрэг
  // ижил хувиар тохируулна. `selected`-ийн key бүр `cellKey(userId, date)`.
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEditorOpen, setBulkEditorOpen] = useState(false);

  function toggleCell(userId: string, date: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = cellKey(userId, date);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleColumn(date: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = rows.every((r) => next.has(cellKey(r.id, date)));
      for (const r of rows) {
        const key = cellKey(r.id, date);
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  function toggleRow(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = dates.every((d) => next.has(cellKey(userId, d)));
      for (const d of dates) {
        const key = cellKey(userId, d);
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  const rowById = new Map(rows.map((r) => [r.id, r]));
  const bulkTargets: BulkTarget[] = [...selected].map((key) => {
    const [userId, date] = key.split("|");
    const weekday = rowById.get(userId)?.cells[date]?.weekday ?? weekdayOf(date);
    return { userId, date, weekday };
  });

  // ── Харагдацын тооцоо ────────────────────────────────────────────────────
  const branchColor = buildBranchColorMap(branches);
  const colorOf = (branchId: string | null) =>
    (branchId ? branchColor.get(branchId) : undefined) ?? FALLBACK_BRANCH_CLASS;

  // Мөр бүрийн нийт цаг/ээлжийн тоо (харагдаж буй өдрүүдээр).
  const rowStats = new Map(
    rows.map((r) => {
      let hours = 0;
      let shiftCount = 0;
      for (const d of dates) {
        const cell = r.cells[d];
        if (!cellHasBranches(cell)) continue;
        for (const seg of cell.segments) {
          shiftCount++;
          hours += segmentHours(seg.startTime, seg.endTime) ?? 0;
        }
      }
      return [r.id, { hours, shiftCount }];
    }),
  );
  const totalHours = [...rowStats.values()].reduce((n, s) => n + s.hours, 0);
  // Өдөр бүр хэдэн ажилтан ажиллаж байгаа (толгойн мөрийн товч мэдээ).
  const workingCountByDate = new Map(
    dates.map((d) => [d, rows.filter((r) => cellHasBranches(r.cells[d])).length]),
  );

  const gridTemplateColumns = compact
    ? `minmax(220px, 1fr) repeat(${dates.length}, minmax(92px, 1fr))`
    : "minmax(260px, 1.5fr) repeat(7, minmax(126px, 1fr))";
  const rowMinWidth = compact ? 220 + dates.length * 92 : 1142;

  const cellTitle = (cell: ScheduleCell | undefined) => {
    if (cellHasBranches(cell)) {
      return cell!.segments
        .map(
          (s) =>
            `${s.branchName}${
              s.startTime && s.endTime
                ? ` ${s.startTime}–${s.endTime}${s.customTime ? "" : " (автомат)"}`
                : ""
            }`,
        )
        .join(" · ");
    }
    return cellIsExplicitOff(cell) ? "Амарна" : "Тодорхойгүй — хувиар тохируулаагүй";
  };

  return (
    <div className="flex flex-col gap-5">
      {header || canEdit ? (
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">{header}</div>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2.5">
              {bulkMode ? (
                <>
                  <span className="text-[13px] text-[var(--oc-muted2)]">
                    {selected.size > 0 ? `${selected.size} нүд сонгогдсон` : "Нүднүүдээ сонгоно уу"}
                  </span>
                  {selected.size > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setBulkEditorOpen(true)}
                        className="rounded-[10px] bg-[var(--oc-accent)] px-4 py-[9px] text-[13px] font-bold text-[var(--oc-on-accent)] transition-colors hover:bg-[var(--oc-accent-hi)]"
                      >
                        Тохируулах
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelected(new Set())}
                        className="text-[13px] text-[var(--oc-muted2)] transition-colors hover:text-[var(--oc-ink)]"
                      >
                        Сонголт цэвэрлэх
                      </button>
                    </>
                  ) : null}
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setBulkMode((v) => !v);
                  setSelected(new Set());
                }}
                aria-pressed={bulkMode}
                className={`flex items-center gap-2 rounded-[10px] border px-3.5 py-[9px] text-[13px] font-semibold transition-colors ${
                  bulkMode
                    ? "border-[var(--oc-accent)] bg-[var(--oc-accent)]/10 text-[var(--oc-accent)]"
                    : "border-[var(--oc-line)] text-[var(--oc-muted)] hover:border-[var(--oc-muted3)] hover:text-[var(--oc-ink)]"
                }`}
              >
                {bulkMode ? "Олноор засах ✕" : "Олноор засах"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {toolbar ? <div className="flex flex-col gap-3">{toolbar}</div> : null}

      <div className="overflow-auto rounded-2xl border border-[var(--oc-line)] bg-[var(--oc-panel)]">
        {rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--oc-muted3)]">Ажилтан олдсонгүй.</p>
        ) : (
          <div style={{ minWidth: rowMinWidth }}>
            {/* Толгой мөр */}
            <div
              className="grid border-b border-[var(--oc-line)] bg-[var(--oc-panel2)]"
              style={{ gridTemplateColumns }}
            >
              <div className="sticky left-0 z-10 flex items-center bg-[var(--oc-panel2)] px-[18px] py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--oc-muted3)]">
                Ажилтан
              </div>
              {dates.map((d) => {
                const wd = weekdayOf(d);
                const isWeekend = wd === "SAT" || wd === "SUN";
                const isToday = d === todayStr;
                const nameColor = isToday
                  ? "text-[var(--oc-accent)]"
                  : isWeekend
                    ? "text-[var(--oc-muted3)]"
                    : "text-[var(--oc-muted)]";
                const short = weekdayLabels[wd] ?? wd;
                return (
                  <div
                    key={d}
                    className={`flex flex-col gap-0.5 border-l border-[var(--oc-line2)] ${
                      compact ? "items-center px-1 py-2" : "px-3.5 py-[11px]"
                    }`}
                  >
                    {bulkMode ? (
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && rows.every((r) => selected.has(cellKey(r.id, d)))}
                        onChange={() => toggleColumn(d)}
                        title="Энэ өдрийг бүх ажилтанд сонгох"
                        className="mb-1 accent-[var(--oc-accent)]"
                      />
                    ) : null}
                    {compact ? (
                      <>
                        <span className={`font-plex-mono text-[12px] font-bold ${nameColor}`}>
                          {Number(d.slice(8))}
                        </span>
                        <span className="text-[10px] text-[var(--oc-muted3)]">{short.slice(0, 1)}</span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-[12px] font-extrabold uppercase tracking-[0.06em] ${nameColor}`}>
                            {short}
                          </span>
                          <span className="font-plex-mono text-[11px] text-[var(--oc-muted3)]">
                            {formatMonthDay(d)}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--oc-muted3)]">
                          {workingCountByDate.get(d) ?? 0} ажилтан
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Ажилтан бүрийн мөр */}
            {rows.map((row) => {
              const stats = rowStats.get(row.id) ?? { hours: 0, shiftCount: 0 };
              const homeColor = colorOf(row.homeBranchId);
              const rowAllSelected = dates.every((d) => selected.has(cellKey(row.id, d)));
              return (
                <div
                  key={row.id}
                  className="group grid border-b border-[var(--oc-line2)] transition-colors last:border-b-0 hover:bg-[var(--oc-panel2)]"
                  style={{ gridTemplateColumns }}
                >
                  <div
                    className="sticky left-0 z-10 flex min-w-0 items-center gap-3 bg-[var(--oc-panel)] px-[18px] py-3 transition-colors group-hover:bg-[var(--oc-panel2)]"
                    title={row.homeBranchName ? `Үндсэн салбар: ${row.homeBranchName}` : undefined}
                  >
                    {bulkMode ? (
                      <input
                        type="checkbox"
                        checked={rowAllSelected}
                        onChange={() => toggleRow(row.id)}
                        title="Энэ ажилтны бүх өдрийг сонгох"
                        className="accent-[var(--oc-accent)]"
                      />
                    ) : null}
                    <div
                      className={`branch-avatar ${homeColor} flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[12px] font-extrabold`}
                      aria-hidden
                    >
                      {initialsOf(row.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-bold tracking-[-0.01em] text-[var(--oc-ink)]">
                        {row.name}
                      </div>
                      {row.roleName ? (
                        <div className="truncate text-[11.5px] text-[var(--oc-muted3)]">{row.roleName}</div>
                      ) : null}
                    </div>
                    <div className="ml-auto flex-none text-right">
                      <div className="font-plex-mono text-[12px] font-medium text-[var(--oc-muted)]">
                        {formatHours(stats.hours)}ц
                      </div>
                      <div className="text-[10px] text-[var(--oc-muted3)]">{stats.shiftCount} ээлж</div>
                    </div>
                  </div>

                  {dates.map((d) => {
                    const cell = row.cells[d];
                    const hasBranches = cellHasBranches(cell);
                    const isExplicitOff = cellIsExplicitOff(cell);
                    const isSelected = bulkMode && selected.has(cellKey(row.id, d));
                    const emptyLabel = compact
                      ? isExplicitOff
                        ? "Ам"
                        : canEdit
                          ? "+"
                          : "·"
                      : isExplicitOff
                        ? "Амарна"
                        : canEdit
                          ? "+ Ээлж"
                          : "—";
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={!canEdit}
                        title={cellTitle(cell)}
                        aria-pressed={bulkMode ? isSelected : undefined}
                        onClick={() => {
                          if (!canEdit || !cell) return;
                          if (bulkMode) {
                            toggleCell(row.id, d);
                            return;
                          }
                          setEditing({
                            userId: row.id,
                            employeeName: row.name,
                            homeBranchId: row.homeBranchId,
                            homeBranchName: row.homeBranchName,
                            date: d,
                            cell,
                          });
                        }}
                        className={`group/cell flex flex-col justify-center gap-1.5 border-l border-[var(--oc-line2)] text-left ${
                          compact ? "p-1" : "p-2"
                        } ${canEdit ? "cursor-pointer" : "cursor-default"}`}
                      >
                        {hasBranches ? (
                          cell!.segments.map((seg, i) => {
                            const color = colorOf(seg.branchId);
                            return (
                              <div
                                key={i}
                                className={`shift-box ${color} ${isSelected ? "shift-box-selected" : ""} flex flex-col gap-0.5 rounded-[9px] transition-shadow ${
                                  compact ? "px-1.5 py-1 pl-2" : "py-[7px] pl-[11px] pr-[10px]"
                                }`}
                              >
                                <div
                                  className={`branch-ink truncate font-bold tracking-[-0.01em] ${
                                    compact ? "text-[10px]" : "text-[12px]"
                                  }`}
                                >
                                  {seg.branchName}
                                </div>
                                {!compact && seg.startTime && seg.endTime ? (
                                  <div className="font-plex-mono text-[11px] text-[var(--oc-muted2)]">
                                    {seg.startTime}–{seg.endTime}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        ) : (
                          <div
                            className={`rounded-[9px] border border-dashed text-center transition-colors ${
                              compact ? "px-1 py-1.5 text-[10px]" : "p-2.5 text-[12px]"
                            } ${
                              isSelected
                                ? "border-[var(--oc-accent)] bg-[var(--oc-accent)]/10 text-[var(--oc-accent)]"
                                : `border-[var(--oc-line)] text-[var(--oc-muted4)] ${
                                    canEdit
                                      ? "group-hover/cell:border-[var(--oc-accent)]/50 group-hover/cell:text-[var(--oc-accent)]"
                                      : ""
                                  }`
                            }`}
                          >
                            {emptyLabel}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* Хөл */}
            <div className="flex items-center justify-between border-t border-[var(--oc-line)] bg-[var(--oc-panel2)] px-[18px] py-3.5 text-[12.5px] text-[var(--oc-muted2)]">
              <div>{rows.length} ажилтан харагдаж байна</div>
              <div>
                Нийт{" "}
                <span className="font-plex-mono text-[var(--oc-muted)]">{formatHours(totalHours)}ц</span> /{" "}
                {compact ? "сар" : "долоо хоног"}
              </div>
            </div>
          </div>
        )}
      </div>

      {editing ? (
        <ShiftEditor
          key={`${editing.userId}:${editing.date}`}
          userId={editing.userId}
          employeeName={editing.employeeName}
          homeBranchId={editing.homeBranchId}
          homeBranchName={editing.homeBranchName}
          date={editing.date}
          cell={editing.cell}
          branches={branches}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {bulkEditorOpen ? (
        <BulkShiftEditor
          key={bulkTargets.map((t) => `${t.userId}:${t.date}`).join(",")}
          targets={bulkTargets}
          branches={branches}
          onClose={() => setBulkEditorOpen(false)}
          onDone={() => {
            setBulkEditorOpen(false);
            setSelected(new Set());
          }}
        />
      ) : null}
    </div>
  );
}

type SegmentDraft = { branchId: string; startTime: string; endTime: string };

/** Салбар(ууд)+цаг сонгох давтагдах хэсэг — ганц болон багц (bulk) засварт хоёуланд нь ашиглана. */
function SegmentsEditor({
  segments,
  branches,
  branchPlaceholder,
  fieldError,
  onChange,
}: {
  segments: SegmentDraft[];
  branches: { id: string; name: string }[];
  branchPlaceholder: string;
  fieldError?: string;
  onChange: (next: SegmentDraft[]) => void;
}) {
  function updateSegment(i: number, patch: Partial<SegmentDraft>) {
    onChange(segments.map((seg, idx) => (idx === i ? { ...seg, ...patch } : seg)));
  }
  function addSegment() {
    onChange([...segments, { branchId: "", startTime: "", endTime: "" }]);
  }
  function removeSegment(i: number) {
    onChange(segments.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-[var(--oc-muted3)]">
        Салбар(ууд) — нэг өдөр хэд хэдэн салбарт дамжиж болно
      </span>
      {segments.map((seg, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-[var(--oc-line)] p-2.5">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select
                name={`segmentBranch-${i}`}
                value={seg.branchId}
                onChange={(v) => updateSegment(i, { branchId: v })}
                placeholder={branchPlaceholder}
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
              />
            </div>
            {segments.length > 1 ? (
              <button
                type="button"
                onClick={() => removeSegment(i)}
                className="text-xs text-[var(--oc-muted4)] hover:text-red-400 transition-colors px-1.5"
              >
                ✕
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[var(--oc-muted4)]">Эхлэх (автомат бол хоосон)</span>
              <Select
                name={`segmentStart-${i}`}
                value={seg.startTime}
                onChange={(v) => updateSegment(i, { startTime: v })}
                placeholder="Автомат"
                options={TIME_OPTIONS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[var(--oc-muted4)]">Дуусах (автомат бол хоосон)</span>
              <Select
                name={`segmentEnd-${i}`}
                value={seg.endTime}
                onChange={(v) => updateSegment(i, { endTime: v })}
                placeholder="Автомат"
                options={TIME_OPTIONS}
              />
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addSegment}
        className="self-start text-xs text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
      >
        + Өөр салбар нэмэх
      </button>
      {fieldError ? <p className="text-red-400 text-xs light:text-red-600">{fieldError}</p> : null}
    </div>
  );
}

function ShiftEditor({
  userId,
  employeeName,
  homeBranchId,
  homeBranchName,
  date,
  cell,
  branches,
  onClose,
}: {
  userId: string;
  employeeName: string;
  homeBranchId: string | null;
  homeBranchName: string | null;
  date: string;
  cell: ScheduleCell;
  branches: { id: string; name: string }[];
  onClose: () => void;
}) {
  const action = upsertEmployeeShiftAction.bind(null, userId);
  const [state, formAction, pending] = useActionState<EmployeeScheduleActionState, FormData>(
    action,
    null,
  );
  const [scope, setScope] = useState<"date" | "weekday">("date");
  const [isWorking, setIsWorking] = useState(cell.working);
  const [segments, setSegments] = useState<SegmentDraft[]>(
    cell.segments.length > 0
      ? cell.segments.map((s) => ({
          branchId: s.branchId,
          startTime: s.customTime ? (s.startTime ?? "") : "",
          endTime: s.customTime ? (s.endTime ?? "") : "",
        }))
      : [{ branchId: homeBranchId ?? "", startTime: "", endTime: "" }],
  );

  // `onClose` нь эцэг компонентийн setState дуудна — render үеэр шууд
  // дуудахгүйн тулд commit-ийн дараах effect-д хойшлуулна.
  useEffect(() => {
    if (state?.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fe = state?.fieldErrors ?? {};
  const weekdayLong = WEEKDAY_LONG[cell.weekday] ?? cell.weekday;
  const hasOverride = cell.source !== "default";

  function onSubmit(formData: FormData) {
    formData.set(
      "segmentsJson",
      JSON.stringify(
        segments
          .filter((s) => s.branchId)
          .map((s) => ({
            branchId: s.branchId,
            startTime: s.startTime || null,
            endTime: s.endTime || null,
          })),
      ),
    );
    formAction(formData);
  }

  return (
    <Modal open onClose={onClose} title={employeeName} widthClassName="max-w-md">
      <p className="text-sm text-[var(--oc-muted3)] -mt-2 mb-4">
        {date} · {weekdayLong}
      </p>

      <form action={onSubmit} className="flex flex-col gap-3">
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="weekday" value={cell.weekday} />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--oc-muted3)]">Хамрах хүрээ</span>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-sm text-[var(--oc-ink2)]">
              <input
                type="radio"
                name="scope"
                value="date"
                checked={scope === "date"}
                onChange={() => setScope("date")}
                className="accent-[var(--oc-accent)]"
              />
              Зөвхөн энэ өдөрт
            </label>
            <label className="flex items-center gap-1.5 text-sm text-[var(--oc-ink2)]">
              <input
                type="radio"
                name="scope"
                value="weekday"
                checked={scope === "weekday"}
                onChange={() => setScope("weekday")}
                className="accent-[var(--oc-accent)]"
              />
              {weekdayLong} гараг бүрт
            </label>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--oc-ink2)]">
          <input
            type="checkbox"
            name="isWorking"
            checked={isWorking}
            onChange={(e) => setIsWorking(e.target.checked)}
            className="accent-[var(--oc-accent)]"
          />
          Ажилладаг
        </label>

        {isWorking ? (
          <SegmentsEditor
            segments={segments}
            onChange={setSegments}
            branches={branches}
            branchPlaceholder={homeBranchName ? `— ${homeBranchName} (үндсэн) —` : "— Сонгох —"}
            fieldError={fe.segments}
          />
        ) : null}

        {state?.message && !state.ok ? (
          <p className="text-red-400 text-sm light:text-red-600">{state.message}</p>
        ) : null}

        <div className="flex gap-2 pt-2">
          <Btn type="submit" disabled={pending}>
            {pending ? "..." : "Хадгалах"}
          </Btn>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-sm text-[var(--oc-muted2)] hover:text-[var(--oc-ink2)] transition-colors"
          >
            Болих
          </button>
        </div>
      </form>

      {hasOverride ? (
        <form
          action={resetEmployeeShiftAction}
          className="mt-3 pt-3 border-t border-[var(--oc-line)]"
        >
          <input type="hidden" name="userId" value={userId} />
          <input
            type="hidden"
            name="scope"
            value={cell.source === "exception" ? "date" : "weekday"}
          />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="weekday" value={cell.weekday} />
          <button
            type="submit"
            className="text-xs text-[var(--oc-muted4)] hover:text-[var(--oc-ink2)] transition-colors"
          >
            {cell.source === "exception"
              ? "Тусгай өдрийн override арилгах"
              : `${weekdayLong} гарагийн override арилгах`}
          </button>
        </form>
      ) : null}
    </Modal>
  );
}

/** Хэд хэдэн (ажилтан × өдөр) сонгосон нүдэнд НЭГ зэрэг ижил хувиар тохируулах модал. */
function BulkShiftEditor({
  targets,
  branches,
  onClose,
  onDone,
}: {
  targets: BulkTarget[];
  branches: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<EmployeeScheduleActionState, FormData>(
    bulkUpsertEmployeeShiftAction,
    null,
  );
  const [scope, setScope] = useState<"date" | "weekday">("date");
  const [isWorking, setIsWorking] = useState(true);
  const [segments, setSegments] = useState<SegmentDraft[]>([
    { branchId: "", startTime: "", endTime: "" },
  ]);

  useEffect(() => {
    if (state?.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fe = state?.fieldErrors ?? {};
  const distinctWeekdays = [...new Set(targets.map((t) => t.weekday))];
  const distinctEmployees = new Set(targets.map((t) => t.userId)).size;

  function onSubmit(formData: FormData) {
    formData.set("targetsJson", JSON.stringify(targets));
    formData.set(
      "segmentsJson",
      JSON.stringify(
        segments
          .filter((s) => s.branchId)
          .map((s) => ({
            branchId: s.branchId,
            startTime: s.startTime || null,
            endTime: s.endTime || null,
          })),
      ),
    );
    formAction(formData);
  }

  return (
    <Modal open onClose={onClose} title={`${targets.length} нүд тохируулах`} widthClassName="max-w-md">
      <p className="text-sm text-[var(--oc-muted3)] -mt-2 mb-4">
        {distinctEmployees} ажилтан · {targets.length} өдөр
      </p>

      <form action={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--oc-muted3)]">Хамрах хүрээ</span>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-sm text-[var(--oc-ink2)]">
              <input
                type="radio"
                name="scope"
                value="date"
                checked={scope === "date"}
                onChange={() => setScope("date")}
                className="accent-[var(--oc-accent)]"
              />
              Зөвхөн сонгосон өдрүүдэд
            </label>
            <label className="flex items-center gap-1.5 text-sm text-[var(--oc-ink2)]">
              <input
                type="radio"
                name="scope"
                value="weekday"
                checked={scope === "weekday"}
                onChange={() => setScope("weekday")}
                className="accent-[var(--oc-accent)]"
              />
              Сонгосон гараг(ууд)т байнга ({distinctWeekdays.map((w) => WEEKDAY_LONG[w] ?? w).join(", ")})
            </label>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--oc-ink2)]">
          <input
            type="checkbox"
            name="isWorking"
            checked={isWorking}
            onChange={(e) => setIsWorking(e.target.checked)}
            className="accent-[var(--oc-accent)]"
          />
          Ажилладаг
        </label>

        {isWorking ? (
          <SegmentsEditor
            segments={segments}
            onChange={setSegments}
            branches={branches}
            branchPlaceholder="— Сонгох —"
            fieldError={fe.segments}
          />
        ) : null}

        {state?.message ? (
          <p
            className={`text-sm ${state.ok ? "text-emerald-400" : "text-red-400 light:text-red-600"}`}
          >
            {state.message}
          </p>
        ) : null}

        <div className="flex gap-2 pt-2">
          <Btn type="submit" disabled={pending}>
            {pending ? "..." : `${targets.length} нүдийг хадгалах`}
          </Btn>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-sm text-[var(--oc-muted2)] hover:text-[var(--oc-ink2)] transition-colors"
          >
            Болих
          </button>
        </div>
      </form>
    </Modal>
  );
}
