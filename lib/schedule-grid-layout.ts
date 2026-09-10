/**
 * Pure layout math shared by every visual timeline grid in the app —
 * lib/dashboard/appointments/calendar/grid-schedule.tsx (the real, interactive
 * staff calendar) and app/_components/schedule-preview-grid.tsx (the
 * read-only preview embedded in the appointment/order creation forms). No
 * branch/schedule/Prisma dependency: given a set of already-resolved
 * intervals and an axis window, decide sub-lane stacking and pixel/percent
 * positions. Kept framework-agnostic so both call sites can share one
 * implementation instead of drifting.
 */

export type GridInterval = { startMs: number; endMs: number };

/**
 * Assigns overlapping intervals to sub-lanes (greedy interval scheduling) so
 * simultaneous bookings stack side by side instead of hiding one another —
 * there is no per-bay/stall model, a branch has one aggregate capacity, so
 * more than one job can legitimately run at the same time.
 */
export function assignLanes<T extends GridInterval>(
  rows: readonly T[],
): (T & { lane: number })[] {
  const sorted = [...rows].sort((a, b) => a.startMs - b.startMs);
  const laneEndMs: number[] = [];
  const positioned: (T & { lane: number })[] = [];
  for (const row of sorted) {
    let lane = laneEndMs.findIndex((end) => end <= row.startMs);
    if (lane === -1) {
      lane = laneEndMs.length;
      laneEndMs.push(row.endMs);
    } else {
      laneEndMs[lane] = row.endMs;
    }
    positioned.push({ ...row, lane });
  }
  return positioned;
}

/** Clamped percent position of `ms` along [axisStartMs, axisStartMs + axisSpanMs). */
export function pctOf(ms: number, axisStartMs: number, axisSpanMs: number): number {
  return Math.min(100, Math.max(0, ((ms - axisStartMs) / axisSpanMs) * 100));
}

/** Hour-boundary tick marks (ms) between axisStartMs and axisEndMs, inclusive of axisStartMs's hour. */
export function hourMarksBetween(axisStartMs: number, axisEndMs: number): number[] {
  const marks: number[] = [];
  const start = new Date(axisStartMs);
  start.setMinutes(0, 0, 0);
  for (let t = start.getTime(); t <= axisEndMs; t += 60 * 60 * 1000) {
    if (t >= axisStartMs) marks.push(t);
  }
  return marks;
}
