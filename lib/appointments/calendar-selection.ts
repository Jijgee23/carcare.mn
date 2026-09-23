/**
 * Shared, pure calendar day-view rule: which interval rows belong to the
 * appointments-only day view, and the schedule-issue label strings shown
 * next to them.
 *
 * Lifted out of `app/dashboard/appointments/calendar/day-rows.tsx`'s
 * `buildDayRows` (P2-B4/P2-X1 — see TENANT_MOBILE_SLICES.md "Wave 2 spec
 * corrections") so `lib/appointments/calendar-day-model.ts` (the API/mobile
 * day-grid truth model) no longer re-expresses the same selection rule and
 * label strings independently. `day-rows.tsx` keeps its JSX, server-action
 * bindings and row-action wiring — only this pure selection/labels piece
 * moved here, and both sides now import it instead of each owning a copy.
 *
 * The rule: `buildBranchSchedule` suppresses a booked appointment's OWN
 * interval once its linked order contributes a visible occupancy interval
 * (correct for capacity/overlap purposes), which would otherwise leave the
 * appointments-only view with nothing to render for that appointment. This
 * resolves an order-sourced interval back to the appointment it represents
 * instead of losing the row.
 */

import type { ScheduleInterval, ScheduleIssue } from "@/lib/branch-schedule";

export const SCHEDULE_ISSUE_LABEL: Record<ScheduleIssue["reason"], string> = {
  "missing-estimate": "Тооцоолсон хугацаа дутуу",
  "unknown-occupancy": "Ажлын байрны эзэмшил тодорхойгүй",
  "missing-order": "Холбогдсон захиалга олдсонгүй",
  "linked-order-not-occupying": "Холбогдсон захиалга ажлын байр эзлэхгүй байна",
  "missing-start": "Эхэлсэн цаг тэмдэглэгдээгүй",
  "invalid-interval": "Хугацааны муж буруу",
  "payment-expired": "Хураамж төлөгдөөгүй тул хугацаа дууссан",
};

export type AppointmentIdentityRow = {
  id: string;
  serviceOrderId: string | null;
};

export type AppointmentIntervalRow<A extends AppointmentIdentityRow> = ScheduleInterval & {
  appt: A | undefined;
};

export type AppointmentIntervalSelection<A extends AppointmentIdentityRow> = {
  rows: AppointmentIntervalRow<A>[];
  issueBySourceId: Map<string, ScheduleIssue>;
};

/**
 * Only appointments (bookings) belong in this view — orders/walk-ins are not
 * part of it at all, regardless of who's looking. Rows are sorted by start
 * time; each row carries the resolved appointment (`appt`), which is
 * `undefined` only if the schedule data is inconsistent (an order-sourced
 * row whose order has no linked appointment — should not happen given
 * `buildBranchSchedule`'s invariants, but callers must still handle it).
 */
export function selectAppointmentIntervals<A extends AppointmentIdentityRow>(input: {
  intervals: readonly ScheduleInterval[];
  issues: readonly ScheduleIssue[];
  appointments: readonly A[];
}): AppointmentIntervalSelection<A> {
  const appointmentById = new Map(input.appointments.map((a) => [a.id, a]));
  const appointmentByOrderId = new Map(
    input.appointments
      .filter((a) => a.serviceOrderId)
      .map((a) => [a.serviceOrderId as string, a]),
  );

  const appointmentIntervals = input.intervals.filter(
    (row) => row.source === "appointment" || appointmentByOrderId.has(row.id),
  );

  const issues = input.issues.filter((issue) => issue.source === "appointment");
  const issueBySourceId = new Map(issues.map((issue) => [`appointment:${issue.id}`, issue]));

  const rows: AppointmentIntervalRow<A>[] = appointmentIntervals
    .slice()
    .sort((a, b) => a.startMs - b.startMs)
    .map((row) => ({
      ...row,
      appt:
        row.source === "appointment"
          ? appointmentById.get(row.id)
          : appointmentByOrderId.get(row.id),
    }));

  return { rows, issueBySourceId };
}
