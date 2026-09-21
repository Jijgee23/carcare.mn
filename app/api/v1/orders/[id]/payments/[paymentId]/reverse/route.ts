import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import { OrderPaymentCommandError, reverseOrderPaymentCommand } from "@/lib/orders/order-payment-commands";

function commandError(error: unknown) {
  if (error instanceof OrderPaymentCommandError) return jsonError(error.status, error.message, { code: error.code, ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}) });
  console.error("[orders/payments/reverse] command failed", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
  return jsonError(500, "Серверийн алдаа гарлаа. Дахин оролдоно уу.");
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string; paymentId: string }> }) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "payments.delete");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;
  const { id, paymentId } = await ctx.params;
  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;
  try {
    const result = await reverseOrderPaymentCommand({ actor: auth.user, orderId: id, paymentId, scope: scopeResult.branchId });
    return jsonOk({ ok: true, paymentId: result.paymentId, order: { paidAmount: result.totals.paid.toString(), paymentStatus: result.totals.status, totalAmount: result.totals.total.toString(), remainingAmount: result.totals.remaining.toString() } });
  } catch (error) {
    return commandError(error);
  }
}
