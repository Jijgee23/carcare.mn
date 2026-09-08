export type CapacityInterval = { startMs: number; endMs: number };

/** Peak occupancy within [start, end), not the number of jobs touching it. */
export function peakOccupancy(
  intervals: readonly CapacityInterval[],
  startMs: number,
  endMs: number,
): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new RangeError("Invalid capacity window");
  }
  const events = new Map<number, number>();
  for (const interval of intervals) {
    if (!Number.isFinite(interval.startMs) || !Number.isFinite(interval.endMs) ||
        interval.endMs <= interval.startMs) {
      throw new RangeError("Invalid occupied interval");
    }
    const start = Math.max(startMs, interval.startMs);
    const end = Math.min(endMs, interval.endMs);
    if (start >= end) continue;
    events.set(start, (events.get(start) ?? 0) + 1);
    events.set(end, (events.get(end) ?? 0) - 1);
  }
  let current = 0;
  let peak = 0;
  // Combine ends and starts at the same instant: adjacent jobs don't overlap.
  for (const [, delta] of [...events].sort(([a], [b]) => a - b)) {
    current += delta;
    peak = Math.max(peak, current);
  }
  return peak;
}
