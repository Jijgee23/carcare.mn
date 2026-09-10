"use client";

import { useMemo } from "react";
import { assignLanes, pctOf, hourMarksBetween } from "@/lib/schedule-grid-layout";

const ROW_HEIGHT = 40;
const MIN_BLOCK_WIDTH_PCT = 2.5;

// Асиа/Улаанбаатар цагийн бүсээр цаг форматлана — сервер өөр бүсэд байршиж болзошгүй.
function fmtUbTime(ms: number): string {
  return new Intl.DateTimeFormat("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

export type SchedulePreviewRow = {
  key: string;
  startMs: number;
  endMs: number;
  uncertain: boolean;
  name: string;
  statusLabel: string;
  statusClass: string;
  paymentStatusLabel: string | null;
  paymentStatusClass: string | null;
  continuesFromPreviousDay: boolean;
  endsAtDayBoundary: boolean;
};

export type SchedulePreviewGhost = {
  startMs: number;
  endMs: number;
  label: string;
};

/**
 * Read-only day timeline — the same visual language as
 * app/dashboard/appointments/calendar/grid-schedule.tsx's GridSchedule (axis,
 * lane-stacked blocks, status/payment badges), but with every interactive
 * piece removed: no click-to-select, no detail panel, no empty-space
 * create-dialog. Meant to be embedded directly in the appointment/order
 * creation forms so staff can see the real day instead of guessing from a
 * bare slot-availability grid.
 *
 * `ghost` is the one thing GridSchedule doesn't have: a dashed, distinctly
 * styled block representing the entry currently being filled in on the form
 * — recomputed by the caller on every relevant field change (time, duration).
 */
export function SchedulePreviewGrid({
  rows,
  axisStartMs,
  axisEndMs,
  ghost,
}: {
  rows: SchedulePreviewRow[];
  axisStartMs: number;
  axisEndMs: number;
  ghost?: SchedulePreviewGhost | null;
}) {
  const axisSpan = Math.max(1, axisEndMs - axisStartMs);
  const pct = (ms: number) => pctOf(ms, axisStartMs, axisSpan);

  const hourMarks = useMemo(
    () => hourMarksBetween(axisStartMs, axisEndMs),
    [axisStartMs, axisEndMs],
  );

  const ghostRow: SchedulePreviewRow | null = ghost
    ? {
        key: "__ghost__",
        startMs: ghost.startMs,
        endMs: ghost.endMs,
        uncertain: false,
        name: ghost.label,
        statusLabel: "",
        statusClass: "",
        paymentStatusLabel: null,
        paymentStatusClass: null,
        continuesFromPreviousDay: false,
        endsAtDayBoundary: false,
      }
    : null;

  const positioned = useMemo(
    () => assignLanes(ghostRow ? [...rows, ghostRow] : rows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, ghost],
  );
  const laneCount = Math.max(1, ...positioned.map((r) => r.lane + 1));

  // Ghost блок жинхэнэ бүртгэлтэй давхцаж байгаа эсэх — давхцвал тодруулж
  // (амбер) харуулна, зөвхөн зэрэгцсэн lane-ээр төдийгүй өнгөөр ч мэдэгдэнэ.
  const ghostOverlaps =
    ghost != null && rows.some((r) => r.startMs < ghost.endMs && r.endMs > ghost.startMs);

  return (
    <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden">
      <div className="relative h-6 border-b border-[var(--oc-line)]">
        {hourMarks.map((t, i) => (
          <span
            key={t}
            className={`absolute top-0.5 font-plex-mono text-[9px] text-[var(--oc-muted3)] ${
              i === 0 ? "" : i === hourMarks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
            }`}
            style={{ left: `${pct(t)}%` }}
          >
            {fmtUbTime(t)}
          </span>
        ))}
      </div>

      <div
        className="relative"
        style={{ height: `${Math.max(1, laneCount) * ROW_HEIGHT + 6}px` }}
      >
        {hourMarks.map((t) => (
          <div
            key={t}
            className="absolute top-0 bottom-0 w-px bg-[var(--oc-line)]/60 pointer-events-none"
            style={{ left: `${pct(t)}%` }}
          />
        ))}

        {rows.length === 0 && !ghost ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-[var(--oc-muted4)]">
            Энэ өдөр хуваарь хоосон байна.
          </div>
        ) : null}

        {positioned.map((row) => {
          const isGhost = row.key === "__ghost__";
          const left = pct(row.startMs);
          const right = row.uncertain ? 100 : pct(row.endMs);
          const width = Math.max(MIN_BLOCK_WIDTH_PCT, right - left);
          return (
            <div
              key={row.key}
              title={row.name}
              className={`absolute flex items-center gap-1.5 overflow-hidden rounded-md border px-1.5 text-left text-[11px] ${
                isGhost
                  ? ghostOverlaps
                    ? "border-dashed border-amber-500 bg-amber-500/20 z-10"
                    : "border-dashed border-[var(--oc-accent)] bg-[var(--oc-accent)]/15 z-10"
                  : "border-[var(--oc-line2)] bg-[var(--oc-panel2)]"
              }`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                top: `${row.lane * ROW_HEIGHT + 3}px`,
                height: `${ROW_HEIGHT - 6}px`,
                backgroundImage: row.uncertain
                  ? "repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(245,158,11,0.15) 6px, rgba(245,158,11,0.15) 12px)"
                  : undefined,
              }}
            >
              <span className="font-plex-mono text-[9px] text-[var(--oc-muted3)] shrink-0">
                {row.continuesFromPreviousDay ? "Өмнөх өдөр → " : null}
                {fmtUbTime(row.startMs)}
              </span>
              <span
                className={`truncate ${
                  isGhost
                    ? ghostOverlaps
                      ? "text-amber-400 font-medium"
                      : "text-[var(--oc-accent)] font-medium"
                    : "text-[var(--oc-ink2)]"
                }`}
              >
                {row.name}
              </span>
              {row.paymentStatusLabel ? (
                <span
                  className={`shrink-0 rounded-full border px-1 py-0.5 font-plex-mono text-[8px] ${row.paymentStatusClass}`}
                >
                  {row.paymentStatusLabel}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
