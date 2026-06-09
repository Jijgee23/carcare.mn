"use client";

import { useState } from "react";
import type { Weekday } from "@/lib/branches";

// Inline (popover биш) сарын календарь — салбар сонгомогц шууд харагдана.
const WEEKDAYS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

// JS getDay() (0=Ня..6=Бя) → Weekday enum.
const JS_DAY_TO_WEEKDAY: Weekday[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Даваагаар эхэлсэн 42 нүдтэй (6 долоо хоног) сарын тор.
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function BookingCalendar({
  value,
  today,
  onChange,
  openWeekdays,
}: {
  value: string;
  today: string; // YYYY-MM-DD — өнөөдөр (минимум сонголт)
  onChange: (dateStr: string) => void;
  // Салбарын ажилладаг гарагууд. Заагдвал бусад (амардаг) гарагийг disabled.
  openWeekdays?: Weekday[];
}) {
  const [view, setView] = useState(() => {
    const base = value || today;
    const [y, m] = base.split("-").map(Number);
    return { year: y, month: m - 1 };
  });

  const grid = monthGrid(view.year, view.month);

  function prevMonth() {
    setView((v) =>
      v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 },
    );
  }
  function nextMonth() {
    setView((v) =>
      v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 },
    );
  }

  return (
    <div className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Өмнөх сар"
        >
          ‹
        </button>
        <div className="text-sm font-medium text-white">
          {view.year} оны {view.month + 1}-р сар
        </div>
        <button
          type="button"
          onClick={nextMonth}
          className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Дараах сар"
        >
          ›
        </button>
      </div>

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

      <div className="grid grid-cols-7 gap-1">
        {grid.map((d) => {
          const ds = ymd(d);
          const inMonth = d.getMonth() === view.month;
          const closed =
            openWeekdays != null &&
            !openWeekdays.includes(JS_DAY_TO_WEEKDAY[d.getDay()]);
          const disabled = ds < today || closed;
          const selected = ds === value;
          const isToday = ds === today;
          return (
            <button
              key={ds}
              type="button"
              disabled={disabled}
              title={closed ? "Амарна" : undefined}
              onClick={() => onChange(ds)}
              className={`relative grid h-11 place-items-center rounded-lg text-sm transition-colors ${
                disabled
                  ? "cursor-not-allowed text-white/15"
                  : selected
                    ? "bg-violet-600 font-semibold text-white"
                    : inMonth
                      ? "text-white/85 hover:bg-white/10"
                      : "text-white/25 hover:bg-white/5"
              } ${isToday && !selected ? "ring-1 ring-inset ring-violet-400/50" : ""}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
