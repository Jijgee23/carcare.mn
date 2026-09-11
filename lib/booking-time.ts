// S13 (WEB_SCHEDULING_ASSESSMENT_2026-09-10.md): the only existing lookahead
// window was a bare inline literal in app/_actions/branches.ts's
// updateBranchAction (how far ahead an hours-change impact scan looks), while
// booking creation itself had no matching maximum advance-booking horizon at
// all. One shared constant closes that gap and gives both a common ceiling.
export const MAX_ADVANCE_BOOKING_DAYS = 366;

// Online booking operates in the product's Asia/Ulaanbaatar business time.
// Use an explicit offset for future slots, never the deployment host's timezone.
export function bookingDateKey(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid booking date");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function bookingDayBounds(dateStr: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new RangeError("Invalid booking date");
  const start = new Date(`${dateStr}T00:00:00+08:00`);
  if (!Number.isFinite(start.getTime()) || bookingDateKey(start) !== dateStr) {
    throw new RangeError("Invalid booking date");
  }
  return { start, end: new Date(start.getTime() + 86400000) };
}

export function bookingSlotTime(dateStr: string, minutes: number): Date {
  return new Date(bookingDayBounds(dateStr).start.getTime() + minutes * 60000);
}

// S07: staff forms (date-picker.tsx, status-controls.tsx datetime-local
// inputs) submit an offset-free "YYYY-MM-DDTHH:mm[:ss]" string that already
// represents a value the staff member picked/read in the branch's business
// timezone. Parsing that with `new Date(raw)` makes Node read it as UTC,
// shifting it by the host/business offset (+08:00 Asia/Ulaanbaatar) whenever
// the server isn't itself running in that zone. Parse it explicitly as
// business-local instead — never infer the zone from either machine.
const LOCAL_DATETIME_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseBusinessLocalDateTime(raw: string): Date {
  const m = LOCAL_DATETIME_RE.exec(raw.trim());
  if (!m) return new Date(NaN);
  const [, dateStr, hh, mm, ss] = m;
  return new Date(`${dateStr}T${hh}:${mm}:${ss ?? "00"}+08:00`);
}
