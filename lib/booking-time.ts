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
