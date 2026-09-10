import Link from "next/link";
import {
  APPOINTMENT_STATUS_BADGE,
  APPOINTMENT_STATUS_LABEL,
} from "@/lib/appointments";
import { customerLabel } from "@/lib/customers";
import type { ScheduleIssue } from "@/lib/branch-schedule";
import {
  type BranchScheduleAppointmentRow,
  type BranchScheduleOrderRow,
} from "@/lib/branch-schedule-loader";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL, ORDER_STATUS_TRANSITIONS } from "@/lib/orders";
import {
  AppointmentArrivedButton,
  AppointmentConfirmReject,
  AppointmentNoShowButton,
  AppointmentRescheduleButton,
} from "@/app/dashboard/appointments/appointment-row-actions";
import { StatusControls } from "@/app/dashboard/orders/[id]/status-controls";
import {
  APPOINTMENT_BOOKING_PAYMENT_BADGE,
  APPOINTMENT_BOOKING_PAYMENT_LABEL,
  appointmentBookingPaymentStatus,
} from "@/lib/appointment-payment-status";

export const SCHEDULE_ISSUE_LABEL: Record<ScheduleIssue["reason"], string> = {
  "missing-estimate": "Тооцоолсон хугацаа дутуу",
  "unknown-occupancy": "Ажлын байрны эзэмшил тодорхойгүй",
  overdue: "Тооцоолсон хугацаанаас хэтэрсэн",
  "missing-order": "Холбогдсон захиалга олдсонгүй",
  "missing-start": "Эхэлсэн цаг тэмдэглэгдээгүй",
  "invalid-interval": "Хугацааны муж буруу",
};

export function appointmentDisplayName(a: BranchScheduleAppointmentRow): string {
  return customerLabel({
    fullName: a.account?.name ?? a.customer?.fullName,
    phone: a.account?.phone ?? a.customer?.phone,
  });
}

export function orderDisplayName(o: BranchScheduleOrderRow): string {
  const vehicle = o.vehicle
    ? `${o.vehicle.plate} · ${o.vehicle.make} ${o.vehicle.model}`
    : null;
  const customer = customerLabel({
    fullName: o.customer?.fullName,
    phone: o.customer?.phone,
  });
  return vehicle ? `${customer} — ${vehicle}` : customer;
}

export type DayRow = {
  key: string;
  source: "appointment" | "order";
  id: string;
  startMs: number;
  endMs: number;
  continuesFromPreviousDay: boolean;
  endsAtDayBoundary: boolean;
  uncertain: boolean;
  name: string;
  statusLabel: string;
  statusClass: string;
  paymentStatusLabel: string | null;
  paymentStatusClass: string | null;
  issueLabel: string | null;
  actions: React.ReactNode | null;
};

// `DaySchedule` (жагсаалт) болон `GridSchedule` (визуал grid) хоёулаа ижил
// мөрийн тодорхойлолт ашиглана — үйлдлийн товчнуудыг (server action bindings)
// нэг л газар (энд) угсарч, харагдацын код зөвхөн байршуулалтад анхаарна.
export function buildDayRows(
  schedule: {
    intervals: Array<{
      id: string;
      source: "appointment" | "order";
      startMs: number;
      endMs: number;
      uncertain: boolean;
    }>;
    issues: ScheduleIssue[];
    appointments: BranchScheduleAppointmentRow[];
    orders: BranchScheduleOrderRow[];
    rangeEnd: Date;
  },
  canRespondAppointments: boolean,
  canEditOrders: boolean,
  // Одоогийн хуваарийн хуудасны URL (interval/anchor/branchId г.м. хэвээр) —
  // "Засварын хуудас үүсгэх" линкэд `next`-ээр дамжуулж, захиалга
  // үүсгэсний дараа яг энэ хуудас руу буцаах боломж олгоно.
  returnTo?: string,
): { rows: DayRow[]; issues: ScheduleIssue[]; carriedOverCount: number } {
  const appointmentById = new Map(schedule.appointments.map((a) => [a.id, a]));
  const orderById = new Map(schedule.orders.map((o) => [o.id, o]));
  const isHiddenCarryOverOrder = (id: string) => {
    const order = orderById.get(id);
    return order?.carriedOver === true && order.continuesIntoDay !== true;
  };

  const filteredIntervals = schedule.intervals.filter(
    (row) => row.source !== "order" || !isHiddenCarryOverOrder(row.id),
  );
  const issues = schedule.issues.filter(
    (issue) => issue.source !== "order" || !isHiddenCarryOverOrder(issue.id),
  );
  const issueBySourceId = new Map(issues.map((issue) => [`${issue.source}:${issue.id}`, issue]));
  const carriedOverCount = schedule.orders.filter(
    (o) => o.carriedOver && !o.continuesIntoDay,
  ).length;

  const rows: DayRow[] = filteredIntervals
    .sort((a, b) => a.startMs - b.startMs)
    .map((row) => {
      const issue = issueBySourceId.get(`${row.source}:${row.id}`);
      const appt = row.source === "appointment" ? appointmentById.get(row.id) : null;
      const order = row.source === "order" ? orderById.get(row.id) : null;
      const name = appt
        ? appointmentDisplayName(appt)
        : order
          ? orderDisplayName(order)
          : "—";
      const statusLabel = appt
        ? APPOINTMENT_STATUS_LABEL[appt.status]
        : order
          ? ORDER_STATUS_LABEL[order.status]
          : "";
      const statusClass = appt
        ? APPOINTMENT_STATUS_BADGE[appt.status]
        : order
          ? ORDER_STATUS_BADGE[order.status]
          : "";
      const paymentStatus = appt ? appointmentBookingPaymentStatus(appt) : null;

      const showConfirmReject = appt?.status === "PENDING" && canRespondAppointments;
      const showArrivalActions =
        appt?.status === "CONFIRMED" && canRespondAppointments && !appt.arrivedAt;
      const showCreateOrderLink =
        appt?.status === "CONFIRMED" && canRespondAppointments && !appt.serviceOrderId;
      const orderTransitions = order ? ORDER_STATUS_TRANSITIONS[order.status] : [];
      const showOrderControls = Boolean(order) && canEditOrders && orderTransitions.length > 0;
      const hasActions =
        showConfirmReject || showArrivalActions || showCreateOrderLink || showOrderControls;
      const orderHref = appt
        ? `/dashboard/orders/new?${new URLSearchParams({
            customerId: appt.customerId ?? "",
            vehicleId: appt.vehicleId ?? "",
            branchId: appt.branchId,
            scheduledAt: new Date(row.startMs).toISOString(),
            note: appt.note ?? "",
            appointmentId: appt.id,
            ...(returnTo ? { next: returnTo } : {}),
          }).toString()}`
        : "";

      const actions = hasActions ? (
        <>
          {showConfirmReject && appt ? (
            <AppointmentConfirmReject
              appointmentId={appt.id}
              canConfirm={paymentStatus === "NOT_REQUIRED" || paymentStatus === "PAID"}
            />
          ) : null}
          {showArrivalActions && appt ? (
            <>
              <AppointmentArrivedButton appointmentId={appt.id} />
              <AppointmentNoShowButton appointmentId={appt.id} />
              <AppointmentRescheduleButton
                appointmentId={appt.id}
                requestedAt={appt.requestedAt.toISOString()}
              />
            </>
          ) : null}
          {showCreateOrderLink ? (
            <Link
              href={orderHref}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--oc-line)] bg-[var(--oc-panel2)] text-[var(--oc-ink2)] hover:border-[var(--oc-line2)] hover:bg-white/[0.05] transition-colors"
            >
              Засварын хуудас үүсгэх →
            </Link>
          ) : null}
          {showOrderControls && order ? (
            <div className="w-64">
              <StatusControls
                orderId={order.id}
                transitions={orderTransitions}
                disabled={false}
                currentStatus={order.status}
                occupiesCapacity={order.occupiesCapacity}
                expectedFinishAt={order.expectedFinishAt}
                attentionHref={`/dashboard/appointments/calendar?view=attention&branchId=${encodeURIComponent(order.branchId)}`}
              />
            </div>
          ) : null}
        </>
      ) : null;

      return {
        key: `${row.source}-${row.id}`,
        source: row.source,
        id: row.id,
        startMs: row.startMs,
        endMs: row.endMs,
        continuesFromPreviousDay: order?.continuesIntoDay === true,
        endsAtDayBoundary: row.endMs === schedule.rangeEnd.getTime(),
        uncertain: row.uncertain,
        name,
        statusLabel,
        statusClass,
        paymentStatusLabel:
          paymentStatus && paymentStatus !== "NOT_REQUIRED"
            ? APPOINTMENT_BOOKING_PAYMENT_LABEL[paymentStatus]
            : null,
        paymentStatusClass:
          paymentStatus && paymentStatus !== "NOT_REQUIRED"
            ? APPOINTMENT_BOOKING_PAYMENT_BADGE[paymentStatus]
            : null,
        issueLabel: issue ? SCHEDULE_ISSUE_LABEL[issue.reason] : null,
        actions,
      };
    });

  return { rows, issues, carriedOverCount };
}
