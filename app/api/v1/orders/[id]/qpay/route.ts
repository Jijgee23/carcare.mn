import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { branchScopeId } from "@/lib/auth/roles";
import { canEditOrder, canViewOrder } from "@/lib/auth/order-access";
import {
  cancelOrderQPayInvoice,
  createOrReuseOrderQPayInvoice,
} from "@/lib/order-payments";
import { prisma } from "@/lib/prisma";
import { TenantQPayService } from "@/lib/qpay-tenant";

const STATUS_BY_REASON = {
  already_paid: 422,
  no_remaining: 422,
  qpay_error: 502,
} as const;

/**
 * Төлбөрийн банкны deeplink `urls`-ийг буцаана. Хадгалагдсан байвал шууд,
 * үгүй бол (хуучин pending, эсвэл create-ийн хариунд ирээгүй) QPay-аас дахин
 * татаж DB-д нөхөж хадгална. Ингэснээр mobile үргэлж бүрэн urls хүлээж авна.
 */
async function resolvePaymentUrls(
  tenantId: string,
  payment: { id: string; qpayInvoiceId: string | null; qpayUrls: unknown },
): Promise<unknown[]> {
  if (Array.isArray(payment.qpayUrls) && payment.qpayUrls.length > 0) {
    return payment.qpayUrls;
  }
  if (!payment.qpayInvoiceId) return [];

  const urls = await TenantQPayService.getInvoiceUrls(
    tenantId,
    payment.qpayInvoiceId,
  );
  if (urls && urls.length > 0) {
    await prisma.orderPayment.update({
      where: { id: payment.id },
      data: { qpayUrls: urls },
    });
    return urls;
  }
  return Array.isArray(payment.qpayUrls) ? payment.qpayUrls : [];
}

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
    select: { id: true, assignedToId: true },
  });
  if (!order) return jsonError(404, "Засварын хуудас олдсонгүй.");
  if (!canViewOrder(auth.user, order)) return jsonError(403, "Танд энэ засварын хуудсыг харах эрх байхгүй.");

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
      select: {
        id: true,
        qrImage: true,
        qrText: true,
        amount: true,
        qpayUrls: true,
        qpayInvoiceId: true,
      },
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
          urls: await resolvePaymentUrls(auth.user.tenantId, pending),
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
  if (!order) return jsonError(404, "Засварын хуудас олдсонгүй.");
  if (!canEditOrder(auth.user, order)) return jsonError(403, "Танд энэ засварын хуудсыг засах эрх байхгүй.");

  // Invoice үүсгэх/дахин ашиглах логик хуваалцсан цөмд шилжсэн — мөн
  // app/_actions/order-payments.ts-ийн createOrderQPayInvoiceAction
  // (dashboard) дуудна (харах: lib/order-payments.ts-ийн comment).
  const result = await createOrReuseOrderQPayInvoice(auth.user.tenantId, auth.user.id, order);
  if (!result.ok) return jsonError(STATUS_BY_REASON[result.reason], result.message);

  return jsonOk({
    payment: {
      id: result.payment.id,
      qrImage: result.payment.qrImage,
      qrText: result.payment.qrText,
      amount: result.payment.amount,
      urls: await resolvePaymentUrls(auth.user.tenantId, result.payment),
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
  const order = await prisma.serviceOrder.findFirst({ where: { id, tenantId: auth.user.tenantId, ...(branchScopeId(auth.user) ? { branchId: branchScopeId(auth.user)! } : {}) }, select: { assignedToId: true } });
  if (!order) return jsonError(404, "Засварын хуудас олдсонгүй.");
  if (!canEditOrder(auth.user, order)) return jsonError(403, "Танд энэ төлбөрийг засах эрх байхгүй.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  const paymentId = (body as Record<string, unknown>).paymentId as string;
  if (!paymentId) return jsonError(400, "paymentId шаардлагатай.");

  // Цуцлах логик хуваалцсан цөмд шилжсэн — мөн app/_actions/order-payments.ts-ийн
  // cancelOrderQPayPaymentAction (dashboard) дуудна (харах:
  // lib/order-payments.ts-ийн comment).
  await cancelOrderQPayInvoice(auth.user.tenantId, auth.user.id, paymentId, id);

  return jsonOk({ ok: true });
}
