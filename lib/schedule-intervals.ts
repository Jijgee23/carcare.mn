import { bookingDateKey, bookingDayBounds } from "@/lib/booking-time";

/**
 * Schedule intervals use half-open semantics: [start, end). An item ending
 * exactly at midnight belongs to the previous business day only; it does not
 * create a zero-length row on the following day.
 */
export type ScheduleDaySegment = {
  dateStr: string;
  dayStart: Date;
  dayEnd: Date;
  start: Date;
  end: Date;
  startsBeforeDay: boolean;
  endsAfterDay: boolean;
};

export function isValidScheduleInterval(start: Date, end: Date): boolean {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
}

/** Split an interval into the business-date windows it actually intersects. */
export function splitScheduleInterval(start: Date, end: Date): ScheduleDaySegment[] {
  if (!isValidScheduleInterval(start, end)) return [];

  const startMs = start.getTime();
  const endMs = end.getTime();
  const segments: ScheduleDaySegment[] = [];
  let cursorMs = startMs;

  while (cursorMs < endMs) {
    const dateStr = bookingDateKey(new Date(cursorMs));
    const { start: dayStart, end: dayEnd } = bookingDayBounds(dateStr);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayEnd.getTime();
    const segmentStartMs = Math.max(startMs, dayStartMs);
    const segmentEndMs = Math.min(endMs, dayEndMs);

    if (segmentStartMs < segmentEndMs) {
      segments.push({
        dateStr,
        dayStart,
        dayEnd,
        start: new Date(segmentStartMs),
        end: new Date(segmentEndMs),
        startsBeforeDay: startMs < dayStartMs,
        endsAfterDay: endMs > dayEndMs,
      });
    }

    // The business timezone is currently a fixed +08:00 zone, but advancing
    // via the resolved day boundary keeps this helper correct if that changes.
    if (dayEndMs <= cursorMs) break;
    cursorMs = dayEndMs;
  }

  return segments;
}

export function scheduleIntervalCrossesBusinessDate(start: Date, end: Date): boolean {
  return splitScheduleInterval(start, end).length > 1;
}
