import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { TenantQPayService } from "@/lib/qpay-tenant";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "payments.edit");
  if (denied) return denied;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  const paymentId = (body as Record<string, unknown>).paymentId as string;
  if (!paymentId) return jsonError(400, "paymentId шаардлагатай.");

  const payment = await prisma.orderPayment.findFirst({
    where: { id: paymentId, tenantId: auth.user.tenantId, orderId: id },
    include: { order: true },
  });
  if (!payment) return jsonError(404, "Төлбөр олдсонгүй.");
  if (payment.status === "PAID") return jsonOk({ paid: true });
  if (!payment.qpayInvoiceId) {
    return jsonError(422, "QPay invoice байхгүй.");
  }

  const check = await TenantQPayService.checkPayment(
    auth.user.tenantId,
    payment.qpayInvoiceId,
  );
  if ("error" in check) return jsonError(502, check.error);
  if (!check.paid) {
    return jsonOk({ paid: false, message: "Төлбөр төлөгдөөгүй байна." });
  }

  const paidAt = check.paidAt ?? new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.orderPayment.findUnique({
        where: { id: payment.id },
        select: { status: true },
      });
      if (fresh?.status === "PAID") return;

      await tx.orderPayment.update({
        where: { id: payment.id },
        data: { status: "PAID", paidAt, qpayPaymentId: check.paymentId },
      });

      const total = payment.order.totalAmount ?? new Prisma.Decimal(0);
      const prevPaid = payment.order.paidAmount ?? new Prisma.Decimal(0);
      const newPaid = prevPaid.plus(payment.amount);
      const nextStatus = newPaid.gte(total) ? "PAID" : "PARTIAL";

      await tx.serviceOrder.update({
        where: { id: payment.orderId },
        data: {
          paidAmount: newPaid,
          paymentStatus: nextStatus,
          paidAt: nextStatus === "PAID" ? paidAt : null,
        },
      });

      await logAudit(
        {
          tenantId: auth.user.tenantId,
          userId: auth.user.id,
          entity: "ServiceOrder",
          entityId: payment.orderId,
          action: "PAYMENT_CHANGE",
          summary: `QPay PAID · ${payment.amount.toString()}₮ → ${nextStatus}`,
          after: {
            paymentId: payment.id,
            qpayPaymentId: check.paymentId,
            newPaidAmount: newPaid.toString(),
            paymentStatus: nextStatus,
          },
        },
        tx,
      );
    });
  } catch (e) {
    return jsonError(500, e instanceof Error ? e.message : "Хадгалахад алдаа.");
  }

  return jsonOk({ paid: true });
}
