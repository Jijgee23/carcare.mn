import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { branchScopeId } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { TenantQPayService } from "@/lib/qpay-tenant";

// GET — pending QPay payment info
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const { id } = await ctx.params;
  const scope = branchScopeId(auth.user);

  const order = await prisma.serviceOrder.findFirst({
    where: {
      id,
      tenantId: auth.user.tenantId,
      ...(scope ? { branchId: scope } : {}),
    },
    select: { id: true },
  });
  if (!order) return jsonError(404, "Захиалга олдсонгүй.");

  const [qpayConfig, pending] = await Promise.all([
    prisma.tenantQPaySettings.findUnique({
      where: { tenantId: auth.user.tenantId },
      select: { enabled: true },
    }),
    prisma.orderPayment.findFirst({
      where: {
        orderId: id,
        tenantId: auth.user.tenantId,
        status: "PENDING",
        method: "QPAY",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, qrImage: true, qrText: true, amount: true },
    }),
  ]);

  return jsonOk({
    qpayEnabled: Boolean(qpayConfig?.enabled),
    pending: pending
      ? {
          id: pending.id,
          qrImage: pending.qrImage,
          qrText: pending.qrText,
          amount: pending.amount.toString(),
          urls: pending.qpayUrls ?? [],
        }
      : null,
  });
}

// POST — create QPay invoice
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "payments.create");
  if (denied) return denied;

  const { id } = await ctx.params;
  const scope = branchScopeId(auth.user);

  const order = await prisma.serviceOrder.findFirst({
    where: {
      id,
      tenantId: auth.user.tenantId,
      ...(scope ? { branchId: scope } : {}),
    },
    include: { customer: { select: { fullName: true, phone: true } } },
  });
  if (!order) return jsonError(404, "Захиалга олдсонгүй.");
  if (order.paymentStatus === "PAID") {
    return jsonError(422, "Захиалга бүрэн төлөгдсөн.");
  }

  const total = order.totalAmount ?? new Prisma.Decimal(0);
  const paid = order.paidAmount ?? new Prisma.Decimal(0);
  const remaining = total.minus(paid);
  if (remaining.lte(0)) return jsonError(422, "Үлдэгдэл байхгүй.");

  // Pending байвал дахин ашиглана
  const existing = await prisma.orderPayment.findFirst({
    where: {
      orderId: id,
      tenantId: auth.user.tenantId,
      status: "PENDING",
      method: "QPAY",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, qrImage: true, qrText: true, amount: true, qpayUrls: true },
  });
  if (existing) {
    return jsonOk({
      payment: {
        id: existing.id,
        qrImage: existing.qrImage,
        qrText: existing.qrText,
        amount: existing.amount.toString(),
        urls: existing.qpayUrls ?? [],
      },
    });
  }

  const payment = await prisma.orderPayment.create({
    data: {
      tenantId: auth.user.tenantId,
      orderId: id,
      amount: remaining,
      method: "QPAY",
      status: "PENDING",
    },
    select: { id: true },
  });

  const inv = await TenantQPayService.createInvoice({
    tenantId: auth.user.tenantId,
    senderInvoiceNo: payment.id,
    invoiceReceiverCode:
      order.customer.fullName || order.customer.phone,
    invoiceDescription: `Захиалга #${order.number}`,
    amount: Number.parseFloat(remaining.toString()),
  });

  if ("error" in inv) {
    await prisma.orderPayment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    return jsonError(502, inv.error);
  }

  const updated = await prisma.orderPayment.update({
    where: { id: payment.id },
    data: {
      qpayInvoiceId: inv.invoice_id,
      qrText: inv.qr_text,
      qrImage: inv.qr_image,
      qpayUrls: inv.urls ?? [],
    },
    select: { id: true, qrImage: true, qrText: true, amount: true, qpayUrls: true },
  });

  await logAudit({
    tenantId: auth.user.tenantId,
    userId: auth.user.id,
    entity: "ServiceOrder",
    entityId: id,
    action: "PAYMENT_CHANGE",
    summary: `QPay QR үүсгэв · ${remaining.toString()}₮`,
    after: { paymentId: payment.id, amount: remaining.toString() },
  });

  return jsonOk({
    payment: {
      id: updated.id,
      qrImage: updated.qrImage,
      qrText: updated.qrText,
      amount: updated.amount.toString(),
      urls: updated.qpayUrls ?? [],
    },
  });
}

// DELETE — cancel pending QPay payment
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "payments.delete");
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

  await prisma.orderPayment.updateMany({
    where: {
      id: paymentId,
      tenantId: auth.user.tenantId,
      orderId: id,
      status: "PENDING",
    },
    data: { status: "CANCELLED" },
  });

  return jsonOk({ ok: true });
}
