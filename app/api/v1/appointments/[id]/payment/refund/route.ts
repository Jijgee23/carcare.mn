import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import { requireAppointmentRefundPermission } from "@/lib/appointments/refund-permission";
import { logAudit } from "@/lib/audit";
import { formatTugrik } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { QPayService } from "@/lib/qpay";

/**
 * POST /api/v1/appointments/[id]/payment/refund
 * Permission: payments.delete — NOT payments.edit.
 *
 * Staff-realm equivalent of `refundAppointmentPaymentAction`
 * (`app/_actions/booking-revenue.ts`), which today is SuperAdmin-only and
 * gated by nothing but `requireSuperAdmin()` — no tenant `payments.*`
 * permission exists on that path at all. P2-B6 does not mirror that: a
 * refund is a destructive money mutation, so the Phase 1 invariant applies
 * here exactly as it does to
 * `app/api/v1/orders/[id]/payments/[paymentId]/reverse/route.ts` —
 * `payments.delete`. `payments.edit` (sufficient for retry/check, a
 * provider-status read-through) must NOT unlock this route; see the explicit
 * negative test in tests/appointment-payment-routes.test.ts.
 *
 * The persisted `AppointmentPayment` row (status, paymentType, qpayPaymentId)
 * is the only source of truth for whether/how a refund is possible — nothing
 * here is computed from a client-supplied scalar. The row is locked
 * (`FOR UPDATE`) and its status re-read inside the transaction immediately
 * before the write, so two concurrent refund requests for the same payment
 * cannot both observe "PAID" and both mutate: the second sees the first's
 * committed "REFUNDED" state and is rejected (double-refund rejection).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requireAppointmentRefundPermission(auth.user);
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;

  const { id } = await ctx.params;

  let note = "";
  try {
    const body = await req.json();
    if (typeof body?.note === "string") note = body.note.trim();
  } catch {
    // no body / invalid JSON — treated as missing note below
  }
  if (!note) {
    return jsonError(422, "Буцаах шалтгаан/тэмдэглэл заавал бөглөнө үү.", {
      code: "REFUND_NOTE_REQUIRED",
      fieldErrors: { note: "Заавал бөглөнө." },
    });
  }

  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;

  const appt = await prisma.appointment.findFirst({
    where: { id, tenantId: auth.user.tenantId },
    select: { id: true, branchId: true },
  });
  if (!appt) return jsonError(404, "Цаг захиалга олдсонгүй.");
  if (scopeResult.branchId != null && appt.branchId !== scopeResult.branchId) {
    return jsonError(404, "Цаг захиалга олдсонгүй.");
  }

  const payment = await prisma.appointmentPayment.findUnique({
    where: { appointmentId: appt.id },
    select: { id: true },
  });
  if (!payment) return jsonError(404, "Төлбөр олдсонгүй.");

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Row lock: re-read the persisted payment status under FOR UPDATE
      // immediately before deciding whether this refund may proceed, so a
      // concurrent refund attempt on the same row serializes behind this
      // one instead of racing on a pre-transaction read.
      await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "AppointmentPayment" WHERE id = ${payment.id} AND "tenantId" = ${auth.user.tenantId} FOR UPDATE
      `;
      const fresh = await tx.appointmentPayment.findFirst({
        where: { id: payment.id, tenantId: auth.user.tenantId, appointmentId: appt.id },
        select: {
          id: true,
          status: true,
          amount: true,
          currency: true,
          paymentType: true,
          qpayPaymentId: true,
        },
      });
      if (!fresh) {
        throw new AppointmentRefundError(404, "Төлбөр олдсонгүй.");
      }
      if (fresh.status !== "PAID") {
        throw new AppointmentRefundError(
          422,
          fresh.status === "REFUNDED"
            ? "Энэ төлбөр аль хэдийн буцаагдсан."
            : "Зөвхөн төлөгдсөн төлбөрийг буцаана.",
          fresh.status === "REFUNDED" ? "PAYMENT_ALREADY_REFUNDED" : "PAYMENT_NOT_PAID",
        );
      }

      let refundedVia: "QPAY" | "MANUAL" = "MANUAL";
      if (fresh.paymentType === "CARD" && fresh.qpayPaymentId) {
        const qpay = await QPayService.refundPayment(fresh.qpayPaymentId, note);
        if ("error" in qpay) {
          throw new AppointmentRefundError(
            502,
            `QPay-аар буцаах амжилтгүй: ${qpay.error}`,
            "QPAY_ERROR",
          );
        }
        refundedVia = "QPAY";
      }

      await tx.appointmentPayment.update({
        where: { id: fresh.id },
        data: {
          status: "REFUNDED",
          refundedAt: new Date(),
          refundNote: `[${[auth.user.firstName, auth.user.lastName].filter(Boolean).join(" ").trim() || auth.user.id}] ${note}`,
        },
      });

      await logAudit(
        {
          tenantId: auth.user.tenantId,
          userId: auth.user.id,
          branchId: appt.branchId,
          entity: "Appointment",
          entityId: appt.id,
          action: "PAYMENT_CHANGE",
          summary: `Цаг захиалгын хураамж буцаав (${refundedVia}) · ${formatTugrik(fresh.amount.toString())}`,
          after: {
            paymentId: fresh.id,
            status: "REFUNDED",
            refundedVia,
            amount: fresh.amount.toString(),
            currency: fresh.currency,
          },
        },
        tx,
      );

      return { paymentId: fresh.id, refundedVia, amount: fresh.amount.toString(), currency: fresh.currency };
    });

    return jsonOk({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AppointmentRefundError) {
      return jsonError(error.status, error.message, { code: error.code });
    }
    console.error("[appointments/payment/refund]", error instanceof Error ? error.name : "UnknownError");
    return jsonError(500, "Серверийн алдаа гарлаа. Дахин оролдоно уу.");
  }
}

class AppointmentRefundError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "APPOINTMENT_REFUND_REJECTED",
  ) {
    super(message);
    this.name = "AppointmentRefundError";
  }
}
