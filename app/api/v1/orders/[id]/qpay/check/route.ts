import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { canEditOrder } from "@/lib/auth/order-access";
import { branchScopeId } from "@/lib/auth/roles";
import { confirmOrderQPayPayment } from "@/lib/order-payments";
import { prisma } from "@/lib/prisma";

const STATUS_BY_REASON = {
  not_found: 404,
  no_invoice: 422,
  qpay_error: 502,
  save_failed: 500,
} as const;

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
  const scope = branchScopeId(auth.user);
  if ((scope && payment.order.branchId !== scope) || !canEditOrder(auth.user, payment.order)) {
    return jsonError(403, "Танд энэ төлбөрийг засах эрх байхгүй.");
  }

  // Жинхэнэ QPay шалгалт + PAID болгох логик хуваалцсан цөмд шилжсэн — мөн
  // dashboard-ийн app/_actions/order-payments.ts-ийн checkOrderQPayPaymentAction
  // дуудна (харах: lib/order-payments.ts-ийн comment).
  const result = await confirmOrderQPayPayment(auth.user.tenantId, auth.user.id, paymentId);
  if (!result.ok) return jsonError(STATUS_BY_REASON[result.reason], result.message);
  if (!result.paid) return jsonOk({ paid: false, message: result.message });

  return jsonOk({ paid: true });
}
