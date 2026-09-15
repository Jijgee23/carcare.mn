"use client";

import { useActionState, useEffect, useState } from "react";
import {
  resetEmployeeShiftAction,
  upsertEmployeeShiftAction,
  type EmployeeScheduleActionState,
} from "@/app/_actions/employee-schedule";
import { Btn } from "@/app/_components/landing-ops-ui";
import { Modal } from "@/app/_components/modal";
import { Select } from "@/app/_components/select";

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

export function ScheduleGrid({
  dates,
  weekdayLabels,
  rows,
  branches,
  canEdit,
  todayStr,
  compact = false,
}: {
  dates: string[];
  weekdayLabels: Record<string, string>;
  rows: EmployeeScheduleRow[];
  branches: { id: string; name: string }[];
  canEdit: boolean;
  todayStr: string;
  /** Сарын харагдац — багана олон (28-31) тул нягт, товч эсийн загвар. */
  compact?: boolean;
}) {
  const [editing, setEditing] = useState<{
    userId: string;
    employeeName: string;
    homeBranchId: string | null;
    homeBranchName: string | null;
    date: string;
    cell: ScheduleCell;
  } | null>(null);

  return (
    <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden flex-1 min-h-0 flex flex-col">
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--oc-muted3)] py-16 text-center">
          Ажилтан олдсонгүй.
        </p>
      ) : (
        <div className="overflow-auto flex-1 min-h-0">
          <table className={`w-full ${compact ? "min-w-[1400px]" : "min-w-[900px]"}`}>
            <thead>
              <tr className="border-b border-[var(--oc-line)]">
                <th className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5 sticky left-0 bg-[var(--oc-panel)]">
                  Ажилтан
                </th>
                {dates.map((d) => (
                  <th
                    key={d}
                    className={`text-center font-plex-mono text-[10.5px] tracking-[0.08em] font-medium ${
                      compact ? "px-1 py-1.5" : "px-2 py-2.5"
                    } ${d === todayStr ? "text-[var(--oc-accent)]" : "text-[var(--oc-muted3)]"}`}
                  >
                    {compact ? (
                      <div>{d.slice(8)}</div>
                    ) : (
                      <>
                        <div className="uppercase">{weekdayLabels[weekdayOf(d)] ?? ""}</div>
                        <div className="text-[var(--oc-muted4)] normal-case">{d.slice(5)}</div>
                      </>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--oc-line)]">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-sm text-[var(--oc-ink)] whitespace-nowrap sticky left-0 bg-[var(--oc-panel)]">
                    {row.name}
                    {row.homeBranchName ? (
                      <div className="text-[10px] text-[var(--oc-muted4)]">{row.homeBranchName}</div>
                    ) : null}
                  </td>
                  {dates.map((d) => {
                    const cell = row.cells[d];
                    return (
                      <td key={d} className={compact ? "p-0.5 align-top" : "px-2 py-2 align-top"}>
                        <button
                          type="button"
                          disabled={!canEdit}
                          title={
                            cell.working
                              ? cell.segments
                                  .map(
                                    (s) =>
                                      `${s.branchName}${s.startTime && s.endTime ? ` ${s.startTime}–${s.endTime}` : ""}`,
                                  )
                                  .join(" · ")
                              : "Амарна"
                          }
                          onClick={() =>
                            canEdit &&
                            setEditing({
                              userId: row.id,
                              employeeName: row.name,
                              homeBranchId: row.homeBranchId,
                              homeBranchName: row.homeBranchName,
                              date: d,
                              cell,
                            })
                          }
                          className={`w-full rounded-lg border text-left transition-colors ${
                            compact ? "px-1 py-1 min-h-[28px]" : "px-2 py-1.5"
                          } ${
                            canEdit ? "cursor-pointer hover:border-[var(--oc-line2)]" : "cursor-default"
                          } ${
                            cell.working
                              ? cell.source === "default"
                                ? "border-[var(--oc-line)] bg-[var(--oc-panel2)]"
                                : "border-[var(--oc-accent)]/40 bg-[var(--oc-accent)]/[0.08]"
                              : "border-[var(--oc-line)] bg-transparent"
                          }`}
                        >
                          {cell.working ? (
                            compact ? (
                              <div className="text-[10px] text-[var(--oc-ink2)] truncate">
                                {cell.segments[0]?.branchName ?? "—"}
                                {cell.segments.length > 1 ? ` +${cell.segments.length - 1}` : ""}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                {cell.segments.map((seg, i) => (
                                  <div key={i}>
                                    <div className="text-xs text-[var(--oc-ink2)] truncate">
                                      {seg.branchName}
                                    </div>
                                    {seg.startTime && seg.endTime ? (
                                      <div className="font-plex-mono text-[10px] text-[var(--oc-muted3)]">
                                        {seg.startTime}–{seg.endTime}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )
                          ) : (
                            <div className="text-xs text-[var(--oc-muted4)]">Амарна</div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
    </div>
  );
}

type SegmentDraft = { branchId: string; startTime: string; endTime: string };

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

  function updateSegment(i: number, patch: Partial<SegmentDraft>) {
    setSegments((prev) => prev.map((seg, idx) => (idx === i ? { ...seg, ...patch } : seg)));
  }
  function addSegment() {
    setSegments((prev) => [...prev, { branchId: "", startTime: "", endTime: "" }]);
  }
  function removeSegment(i: number) {
    setSegments((prev) => prev.filter((_, idx) => idx !== i));
  }

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
          <div className="flex flex-col gap-2">
            <span className="text-xs text-[var(--oc-muted3)]">
              Салбар(ууд) — нэг өдөр хэд хэдэн салбарт дамжиж болно
            </span>
            {segments.map((seg, i) => (
              <div
                key={i}
                className="flex flex-col gap-1.5 rounded-lg border border-[var(--oc-line)] p-2.5"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select
                      name={`segmentBranch-${i}`}
                      value={seg.branchId}
                      onChange={(v) => updateSegment(i, { branchId: v })}
                      placeholder={homeBranchName ? `— ${homeBranchName} (үндсэн) —` : "— Сонгох —"}
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
                    <span className="text-[11px] text-[var(--oc-muted4)]">
                      Эхлэх (автомат бол хоосон)
                    </span>
                    <Select
                      name={`segmentStart-${i}`}
                      value={seg.startTime}
                      onChange={(v) => updateSegment(i, { startTime: v })}
                      placeholder="Автомат"
                      options={TIME_OPTIONS}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-[var(--oc-muted4)]">
                      Дуусах (автомат бол хоосон)
                    </span>
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
            {fe.segments ? (
              <p className="text-red-400 text-xs light:text-red-600">{fe.segments}</p>
            ) : null}
          </div>
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
