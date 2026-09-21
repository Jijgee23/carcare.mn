import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import { confirmOrderQPayPaymentCommand, notifyOrderPaymentReceived, OrderPaymentCommandError } from "@/lib/orders/order-payment-commands";

function commandError(error: unknown) {
  if (error instanceof OrderPaymentCommandError) return jsonError(error.status, error.message, { code: error.code, ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}) });
  console.error("[orders/qpay/check] command failed", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
  return jsonError(500, "Серверийн алдаа гарлаа. Дахин оролдоно уу.");
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "payments.edit");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;
  const { id } = await ctx.params;
  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError(400, "JSON body шаардлагатай."); }
  if (body == null || typeof body !== "object" || Array.isArray(body)) return jsonError(400, "JSON object шаардлагатай.");
  const paymentId = (body as Record<string, unknown>).paymentId;
  if (typeof paymentId !== "string" || !paymentId.trim()) return jsonError(400, "paymentId шаардлагатай.");
  try {
    const result = await confirmOrderQPayPaymentCommand({ actor: auth.user, orderId: id, paymentId: paymentId.trim(), scope: scopeResult.branchId });
    if (!result.paid) return jsonOk({ paid: false, message: result.message });
    if (result.newlyPaid) await notifyOrderPaymentReceived({ tenantId: auth.user.tenantId, orderId: result.orderId, amount: result.amount, accountId: result.accountId, appointmentId: result.appointmentId });
    return jsonOk({ paid: true });
  } catch (error) {
    return commandError(error);
  }
}
