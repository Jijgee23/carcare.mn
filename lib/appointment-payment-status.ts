/**
 * Booking-fee state derived from the Appointment snapshot and its final
 * payment row. A missing fee means that this booking did not require payment;
 * AppointmentPayment is created only after QPay confirms full payment.
 */
export type AppointmentBookingPaymentStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "UNDERPAID"
  | "FAILED"
  | "PAID";

export function appointmentBookingPaymentStatus(input: {
  feeAmount: unknown;
  feeQpayInvoiceId: string | null;
  feeUnderpaidAmount: unknown;
  payment: { status: string } | null;
}): AppointmentBookingPaymentStatus {
  if (input.feeAmount == null) return "NOT_REQUIRED";
  if (input.payment?.status === "PAID") return "PAID";
  if (input.feeUnderpaidAmount != null) return "UNDERPAID";
  if (input.feeQpayInvoiceId) return "PENDING";
  return "FAILED";
}

export const APPOINTMENT_BOOKING_PAYMENT_LABEL: Record<
  AppointmentBookingPaymentStatus,
  string
> = {
  NOT_REQUIRED: "Төлбөр шаардлагагүй",
  PENDING: "Төлбөр хүлээгдэж байна",
  UNDERPAID: "Дутуу төлсөн",
  FAILED: "Төлбөрийн invoice алдаатай",
  PAID: "Төлбөр төлөгдсөн",
};

export const APPOINTMENT_BOOKING_PAYMENT_BADGE: Record<
  AppointmentBookingPaymentStatus,
  string
> = {
  NOT_REQUIRED: "bg-[var(--oc-panel2)] text-[var(--oc-muted3)] border-[var(--oc-line)]",
  PENDING: "bg-amber-500/10 text-amber-300 border-amber-500/25 light:text-amber-700 light:bg-amber-100 light:border-amber-300",
  UNDERPAID: "bg-orange-500/10 text-orange-300 border-orange-500/25 light:text-orange-700 light:bg-orange-100 light:border-orange-300",
  FAILED: "bg-red-500/10 text-red-300 border-red-500/25 light:text-red-700 light:bg-red-100 light:border-red-300",
  PAID: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25 light:text-emerald-700 light:bg-emerald-100 light:border-emerald-300",
};
