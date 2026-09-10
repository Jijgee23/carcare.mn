/**
 * Single source of truth for "what interval does this order actually occupy
 * right now" — shared by lib/branch-schedule.ts (calendar/attention
 * projection), lib/branch-schedule-loader.ts (carry-over detection), and
 * lib/category-duration.ts (live slot-availability capacity check). These
 * three previously reimplemented the same scheduled/start/duration logic with
 * subtly different guards, which let a bad estimatedDurationMinutes value
 * (non-integer, <= 0) or a corrupt expectedFinishAt (<= start) produce
 * different occupancy conclusions depending which module read it.
 */
export type ScheduleOrderLike = {
  status: string;
  scheduledAt: Date | null;
  startedAt: Date | null;
  estimatedDurationMinutes: number | null;
  expectedFinishAt: Date | null;
  occupiesCapacity: boolean | null;
};

export type ResolvedOrderInterval = {
  /** True while the order is still a plain untouched SCHEDULED booking (uses scheduledAt); false once work has actually started (uses startedAt). */
  scheduled: boolean;
  start: Date | null;
  /** Null means no positive evidence of an end (missing/invalid estimate or unknown occupancy) — caller decides the conservative fallback. */
  end: Date | null;
  /** True when an end WAS computed but is <= start — corrupt data, distinct from simply missing an estimate. */
  invalid: boolean;
};

function positiveIntegerMinutes(value: number | null): number | null {
  return value != null && Number.isInteger(value) && value > 0 ? value : null;
}

export function isOrderScheduledPhase(
  o: Pick<ScheduleOrderLike, "status" | "occupiesCapacity">,
): boolean {
  return o.status === "SCHEDULED" && o.occupiesCapacity !== true;
}

export function resolveOrderEffectiveInterval(
  o: ScheduleOrderLike,
): ResolvedOrderInterval {
  const scheduled = isOrderScheduledPhase(o);
  const start = scheduled ? o.scheduledAt : o.startedAt;
  if (!start) return { scheduled, start: null, end: null, invalid: false };

  const duration = positiveIntegerMinutes(o.estimatedDurationMinutes);
  const end =
    o.expectedFinishAt ??
    (scheduled && duration != null
      ? new Date(start.getTime() + duration * 60000)
      : null);

  if (end != null && end.getTime() <= start.getTime()) {
    return { scheduled, start, end: null, invalid: true };
  }
  return { scheduled, start, end, invalid: false };
}
