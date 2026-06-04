"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Modern, responsive date picker — single & range modes.
 *
 * - Controlled: pass `value` + `onChange`.
 * - Uncontrolled / native form: pass `defaultValue` + `name` (single) or
 *   `fromName`/`toName` (range); hidden inputs carry the value on submit.
 * - `withTime` (single only) keeps a HH:mm field → value is "YYYY-MM-DDTHH:mm"
 *   (drop-in replacement for <input type="datetime-local">).
 *
 * Desktop: floating popover anchored to the trigger. Mobile: bottom sheet.
 */

export type DateRangeValue = { from: string; to: string };

type CommonProps = {
  /** Applied to the wrapper — control width/placement from the call site. */
  className?: string;
  disabled?: boolean;
  error?: boolean;
  /** Bounds as "YYYY-MM-DD" (inclusive). */
  min?: string;
  max?: string;
  placeholder?: string;
  id?: string;
};

type SingleProps = CommonProps & {
  mode?: "single";
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  withTime?: boolean;
  required?: boolean;
};

type RangeProps = CommonProps & {
  mode: "range";
  value?: DateRangeValue;
  defaultValue?: DateRangeValue;
  onChange?: (value: DateRangeValue) => void;
  fromName?: string;
  toName?: string;
};

export type DatePickerProps = SingleProps | RangeProps;

const WEEKDAYS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayStr(): string {
  return ymd(new Date());
}

function splitDateTime(value: string): [string, string] {
  if (!value) return ["", ""];
  const [date, time] = value.split("T");
  return [date ?? "", time?.slice(0, 5) ?? ""];
}

function fmtDisplay(date: string): string {
  return date ? date.replaceAll("-", ".") : "";
}

/** 42-cell (6-week) grid for the given year/month, Monday-first. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7; // 0 = Mon … 6 = Sun
  const start = new Date(year, month, 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function DatePicker(props: DatePickerProps) {
  const isRange = props.mode === "range";
  const single = !isRange ? (props as SingleProps) : null;
  const range = isRange ? (props as RangeProps) : null;
  const withTime = Boolean(single?.withTime);

  const controlled = isRange
    ? range!.value !== undefined
    : single!.value !== undefined;

  const [internal, setInternal] = useState<DateRangeValue>(() => {
    if (isRange) {
      const dv = range!.defaultValue;
      return { from: dv?.from ?? "", to: dv?.to ?? "" };
    }
    return { from: single!.defaultValue ?? "", to: "" };
  });

  const current: DateRangeValue = controlled
    ? isRange
      ? { from: range!.value!.from, to: range!.value!.to }
      : { from: single!.value ?? "", to: "" }
    : internal;

  const [datePart, timePart] = splitDateTime(current.from);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = datePart || (range?.value?.from ?? "") || todayStr();
    const d = new Date(base);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId();
  const id = props.id ?? generatedId;

  // Overlay is portaled to <body> to escape the .glass cards' stacking
  // contexts (backdrop-filter creates one), so it can never render under a
  // sibling card. Desktop uses fixed coords measured from the trigger.
  const [isMobile, setIsMobile] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function updatePosition() {
    const el = triggerRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const mobile = window.innerWidth < 640;
    setIsMobile(mobile);
    if (mobile) {
      setPos(null);
      return;
    }
    const PANEL_W = 312; // 19.5rem
    const EST_H = 380;
    let left = Math.min(r.left, window.innerWidth - PANEL_W - 8);
    left = Math.max(8, left);
    let top = r.bottom + 8;
    if (top + EST_H > window.innerHeight - 8 && r.top - EST_H - 8 > 8) {
      top = r.top - EST_H - 8; // flip above the trigger
    }
    setPos({ top, left });
  }

  // While open: close on Escape, reposition on scroll/resize.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onReflow = () => updatePosition();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  function openPanel() {
    if (props.disabled) return;
    const base = datePart || current.from || todayStr();
    const d = new Date(base);
    if (!Number.isNaN(d.getTime())) {
      setView({ year: d.getFullYear(), month: d.getMonth() });
    }
    updatePosition();
    setOpen(true);
  }

  function commit(next: DateRangeValue) {
    if (!controlled) setInternal(next);
    if (isRange) range!.onChange?.(next);
    else single!.onChange?.(next.from);
  }

  function isDisabledDate(dateStr: string): boolean {
    if (props.min && dateStr < props.min) return true;
    if (props.max && dateStr > props.max) return true;
    return false;
  }

  function pickDay(dateStr: string) {
    if (isDisabledDate(dateStr)) return;
    if (isRange) {
      const { from, to } = current;
      if (!from || (from && to)) {
        commit({ from: dateStr, to: "" });
      } else if (dateStr < from) {
        commit({ from: dateStr, to: from });
        setOpen(false);
      } else {
        commit({ from, to: dateStr });
        setOpen(false);
      }
      return;
    }
    const value = withTime ? `${dateStr}T${timePart || "09:00"}` : dateStr;
    commit({ from: value, to: "" });
    if (!withTime) setOpen(false);
  }

  function setTime(time: string) {
    if (!datePart) return;
    commit({ from: `${datePart}T${time}`, to: "" });
  }

  function clearAll() {
    commit({ from: "", to: "" });
    setOpen(false);
  }

  // ---- display ----
  let triggerText = "";
  if (isRange) {
    if (current.from && current.to)
      triggerText = `${fmtDisplay(current.from)} – ${fmtDisplay(current.to)}`;
    else if (current.from) triggerText = `${fmtDisplay(current.from)} –`;
  } else if (datePart) {
    triggerText = `${fmtDisplay(datePart)}${withTime && timePart ? ` ${timePart}` : ""}`;
  }
  const placeholder =
    props.placeholder ?? (isRange ? "Огнооны муж" : "Огноо сонгох");

  const grid = monthGrid(view.year, view.month);
  const today = todayStr();

  return (
    <div ref={wrapRef} className={`relative ${props.className ?? ""}`}>
      {/* hidden inputs for native form submission */}
      {!isRange && single!.name ? (
        <input type="hidden" name={single!.name} value={current.from} />
      ) : null}
      {isRange && range!.fromName ? (
        <input type="hidden" name={range!.fromName} value={current.from} />
      ) : null}
      {isRange && range!.toName ? (
        <input type="hidden" name={range!.toName} value={current.to} />
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={props.disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-lg border bg-white/[0.04] px-3 py-2 text-left text-sm text-white outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          props.error
            ? "border-red-500/50"
            : open
              ? "border-violet-500/60 shadow-[0_0_0_2px_rgba(108,71,255,0.15)]"
              : "border-white/10 hover:border-white/20"
        }`}
      >
        <CalendarIcon />
        <span className={triggerText ? "text-white" : "text-white/35"}>
          {triggerText || placeholder}
        </span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Хаах"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-[100] cursor-default bg-black/50 sm:bg-transparent"
              />
              <div
                role="dialog"
                style={!isMobile && pos ? { top: pos.top, left: pos.left } : undefined}
                className={`fixed z-[110] border border-white/10 bg-[#14141f]/95 p-4 shadow-2xl backdrop-blur-xl ${
                  isMobile || !pos
                    ? "inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-2xl"
                    : "w-[19.5rem] rounded-2xl"
                }`}
              >
            {/* mobile grabber */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 sm:hidden" />

            {/* header */}
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setView((v) => {
                    const m = v.month - 1;
                    return m < 0
                      ? { year: v.year - 1, month: 11 }
                      : { year: v.year, month: m };
                  })
                }
                className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Өмнөх сар"
              >
                <Chevron dir="left" />
              </button>
              <div className="text-sm font-medium text-white">
                {view.year} оны {view.month + 1}-р сар
              </div>
              <button
                type="button"
                onClick={() =>
                  setView((v) => {
                    const m = v.month + 1;
                    return m > 11
                      ? { year: v.year + 1, month: 0 }
                      : { year: v.year, month: m };
                  })
                }
                className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Дараах сар"
              >
                <Chevron dir="right" />
              </button>
            </div>

            {/* weekday header */}
            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="grid h-7 place-items-center text-[11px] font-medium text-white/35"
                >
                  {w}
                </div>
              ))}
            </div>

            {/* days */}
            <div className="grid grid-cols-7 gap-1">
              {grid.map((d) => {
                const ds = ymd(d);
                const inMonth = d.getMonth() === view.month;
                const disabled = isDisabledDate(ds);
                const isToday = ds === today;

                let selected = false;
                let rangeStart = false;
                let rangeEnd = false;
                let inRange = false;
                if (isRange) {
                  rangeStart = Boolean(current.from) && ds === current.from;
                  rangeEnd = Boolean(current.to) && ds === current.to;
                  inRange =
                    Boolean(current.from) &&
                    Boolean(current.to) &&
                    ds > current.from &&
                    ds < current.to;
                } else {
                  selected = Boolean(datePart) && ds === datePart;
                }
                const active = selected || rangeStart || rangeEnd;

                return (
                  <button
                    key={ds}
                    type="button"
                    disabled={disabled}
                    onClick={() => pickDay(ds)}
                    className={`relative grid h-9 place-items-center rounded-lg text-sm transition-colors ${
                      disabled
                        ? "cursor-not-allowed text-white/15"
                        : active
                          ? "bg-violet-600 font-semibold text-white"
                          : inRange
                            ? "bg-violet-500/15 text-white"
                            : inMonth
                              ? "text-white/85 hover:bg-white/10"
                              : "text-white/25 hover:bg-white/5"
                    } ${
                      isToday && !active
                        ? "ring-1 ring-inset ring-violet-400/50"
                        : ""
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            {/* time field (single + withTime) */}
            {withTime ? (
              <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
                <span className="text-xs text-white/40">Цаг</span>
                <input
                  type="time"
                  value={timePart || "09:00"}
                  disabled={!datePart}
                  onChange={(e) => setTime(e.target.value)}
                  style={{ colorScheme: "dark" }}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-sm text-white outline-none focus:border-violet-500/60 disabled:opacity-40"
                />
              </div>
            ) : null}

            {/* footer */}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-white/40 transition-colors hover:text-white/80"
              >
                Цэвэрлэх
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => pickDay(today)}
                  className="rounded-lg px-2.5 py-1 text-xs text-violet-300 transition-colors hover:bg-violet-500/10"
                >
                  Өнөөдөр
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-violet-500"
                >
                  Болсон
                </button>
              </div>
            </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0 text-white/40"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}
