"use client";

import { useState } from "react";

type WeeklyRow = {
  weekday: string;
  label: string;
  isOpen: boolean;
  hours: string | null;
  isToday: boolean;
};

type Notice = { key: string; text: string };

/**
 * Mobile-ийн `_HoursDisclosure`-тэй ижил дизайн: violet өнгийн 12%/30%/5%
 * alpha tint-үүд, нээгдэхэд доод булан шулуудаж доор нь ижил tint-тэй панел
 * шууд наалдана, сум 200мс rotate хийнэ. Зөвхөн энэ жижиг харагдацын
 * нээх/хаах төлөв client талд — өгөгдөл бүгд server-ээс props-оор ирнэ.
 */
export function HoursDisclosure({
  weeklyRows,
  notices,
}: {
  weeklyRows: WeeklyRow[];
  notices: Notice[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={`w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-violet-300 font-bold text-[13px] bg-violet-500/[0.12] border border-violet-500/30 transition-colors ${
          expanded ? "rounded-t-2xl border-b-0" : "rounded-2xl"
        }`}
      >
        Бүтэн долоо хоногийн хуваарь
        <svg
          className="w-4 h-4 transition-transform duration-200"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {expanded ? (
        <div className="w-full px-3.5 pt-2.5 pb-3 bg-violet-500/[0.05] border-x border-b border-violet-500/30 rounded-b-2xl">
          <ul className="flex flex-col gap-1">
            {weeklyRows.map((row) => (
              <li
                key={row.weekday}
                className="flex items-center justify-between gap-3 py-0.5"
              >
                <span className={row.isToday ? "text-white/90 font-bold" : "text-white/60"}>
                  {row.label}
                  {row.isToday ? " (өнөөдөр)" : ""}
                </span>
                <span className={`tabular-nums ${row.isOpen ? "text-white/70" : "text-white/35"}`}>
                  {row.isOpen ? row.hours ?? "Нээлттэй" : "Хаалттай"}
                </span>
              </li>
            ))}
          </ul>
          {notices.length > 0 ? (
            <div className="mt-3 flex flex-col gap-1">
              <div className="text-xs font-semibold text-white/55">Онцгой өдрүүд</div>
              {notices.map((n) => (
                <div key={n.key} className="text-xs text-white/55">
                  {n.text}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
