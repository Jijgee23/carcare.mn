import { bookingDayBounds } from "@/lib/booking-time";

/** Prisma selection for one date's effective branch schedule inputs. */
export function branchScheduleForDateSelect(dateStr: string) {
  // `@db.Date` is compared at UTC calendar midnight. Appointment timestamps
  // still use bookingDayBounds; this value is only for DATE relations/ranges.
  const day = new Date(`${dateStr}T00:00:00.000Z`);
  bookingDayBounds(dateStr);
  return {
    openTime: true,
    closeTime: true,
    schedules: {
      select: {
        weekday: true,
        isOpen: true,
        openTime: true,
        closeTime: true,
      },
    },
    scheduleExceptions: {
      where: { date: day },
      select: {
        date: true,
        isOpen: true,
        openTime: true,
        closeTime: true,
        label: true,
      },
    },
    scheduleSeasons: {
      where: {
        isActive: true,
        startsOn: { lte: day },
        endsOn: { gt: day },
      },
      select: {
        name: true,
        startsOn: true,
        endsOn: true,
        isActive: true,
        days: {
          select: {
            weekday: true,
            isOpen: true,
            openTime: true,
            closeTime: true,
          },
        },
      },
    },
  };
}

/** Full schedule inputs for branch/admin/discovery views that inspect future dates. */
export function branchScheduleDisplaySelect() {
  return {
    openTime: true,
    closeTime: true,
    schedules: {
      select: {
        weekday: true,
        isOpen: true,
        openTime: true,
        closeTime: true,
      },
    },
    scheduleExceptions: {
      orderBy: { date: "asc" as const },
      select: {
        date: true,
        isOpen: true,
        openTime: true,
        closeTime: true,
        label: true,
      },
    },
    scheduleSeasons: {
      where: { isActive: true },
      orderBy: { startsOn: "asc" as const },
      select: {
        name: true,
        startsOn: true,
        endsOn: true,
        isActive: true,
        days: {
          select: {
            weekday: true,
            isOpen: true,
            openTime: true,
            closeTime: true,
          },
        },
      },
    },
  };
}
