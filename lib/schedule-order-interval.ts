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

/**
 * D-068 read-path input, additive alongside the ServiceOrder scalars: when a
 * caller has the order's OrderTimeBooking rows on hand, pass them and the
 * most recent row (by startAt) is used as "the" currently represented
 * booking instead of the scalar fields — the multi-row equivalent of what
 * scheduledAt/startedAt/expectedFinishAt used to hold alone. Omit this
 * argument (or pass an empty array) to keep today's scalar-only behavior;
 * every existing caller does so until it migrates individually.
 */
export type OrderTimeBookingLike = {
  kind: "SCHEDULED" | "ACTIVE";
  startAt: Date;
  endAt: Date | null;
  closedAt: Date | null;
};

function positiveIntegerMinutes(value: number | null): number | null {
  return value != null && Number.isInteger(value) && value > 0 ? value : null;
}

export function isOrderScheduledPhase(
  o: Pick<ScheduleOrderLike, "status" | "occupiesCapacity">,
): boolean {
  return o.status === "SCHEDULED" && o.occupiesCapacity !== true;
}

function toResolvedInterval(
  scheduled: boolean,
  start: Date,
  end: Date | null,
): ResolvedOrderInterval {
  if (end != null && end.getTime() <= start.getTime()) {
    return { scheduled, start, end: null, invalid: true };
  }
  return { scheduled, start, end, invalid: false };
}

function resolveFromScalars(o: ScheduleOrderLike): ResolvedOrderInterval {
  const scheduled = isOrderScheduledPhase(o);
  const start = scheduled ? o.scheduledAt : o.startedAt;
  if (!start) return { scheduled, start: null, end: null, invalid: false };

  const duration = positiveIntegerMinutes(o.estimatedDurationMinutes);
  const end =
    o.expectedFinishAt ??
    (scheduled && duration != null
      ? new Date(start.getTime() + duration * 60000)
      : null);
  return toResolvedInterval(scheduled, start, end);
}

/**
 * D-076 (COWORK.md): an order may have at most one open ACTIVE booking (what
 * it occupies right now) and, independently, at most one open SCHEDULED
 * booking (a follow-up reserved for later, e.g. booked while still
 * IN_PROGRESS, or a return time booked while released POSTPONED) — never
 * two of the same kind open at once. `current` is the row that answers "what
 * does this order occupy/reserve right now" — the open ACTIVE row if one
 * exists, else the same "latest by startAt" fallback used when there's only
 * ever been at most one booking (terminal orders, the plain single-SCHEDULED
 * case). `upcoming` is every other OPEN row — i.e. a follow-up that is not
 * itself the current interval. This is a strict superset of
 * resolveOrderEffectiveInterval: whenever at most one booking is open (true
 * for every order as of this decision, until the follow-up feature is
 * actually used), `current` is identical to what that function already
 * returns and `upcoming` is empty.
 */
export function resolveOrderIntervals(
  o: ScheduleOrderLike,
  bookings?: OrderTimeBookingLike[],
): { current: ResolvedOrderInterval; upcoming: ResolvedOrderInterval[] } {
  if (!bookings || bookings.length === 0) {
    return { current: resolveFromScalars(o), upcoming: [] };
  }

  // Priority: (1) the open ACTIVE row — what's physically happening right
  // now, if anything is; (2) else the latest-by-startAt CLOSED row — the
  // most recent thing that actually happened, e.g. a completed order's real
  // history. An open SCHEDULED row (a future follow-up) must never win this
  // over real closed history just because its startAt is later — that would
  // make a completed order's "current" interval silently become a future
  // reservation instead of its actual finish. (3) Only when neither exists
  // — no open ACTIVE and no closed rows at all — does the sole remaining
  // row (necessarily a lone open SCHEDULED booking, per the D-076 invariant)
  // become current: a not-yet-started order, or a return time booked before
  // any work has ever occurred on this order.
  const openActive = bookings.find((b) => b.kind === "ACTIVE" && b.closedAt == null);
  const closedRows = bookings.filter((b) => b.closedAt != null);
  const primary =
    openActive ??
    (closedRows.length > 0
      ? closedRows.reduce((a, b) => (b.startAt.getTime() > a.startAt.getTime() ? b : a))
      : bookings.reduce((a, b) => (b.startAt.getTime() > a.startAt.getTime() ? b : a)));
  const current = toResolvedInterval(primary.kind === "SCHEDULED", primary.startAt, primary.endAt);

  const upcoming = bookings
    .filter((b) => b !== primary && b.closedAt == null)
    .map((b) => toResolvedInterval(b.kind === "SCHEDULED", b.startAt, b.endAt));

  return { current, upcoming };
}

export function resolveOrderEffectiveInterval(
  o: ScheduleOrderLike,
  bookings?: OrderTimeBookingLike[],
): ResolvedOrderInterval {
  return resolveOrderIntervals(o, bookings).current;
}
