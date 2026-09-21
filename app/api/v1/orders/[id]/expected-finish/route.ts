import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { parseBusinessLocalDateTime } from "@/lib/booking-time";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import {
  OrderScheduleCommandError,
  reviseExpectedFinishCommand,
} from "@/lib/orders/order-schedule-commands";

function parseDate(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const local = parseBusinessLocalDateTime(value.trim());
  return Number.isFinite(local.getTime()) ? local : undefined;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.edit");
  if (denied && !auth.user.role?.permissions.includes("orders.editOwn")) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;
  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return jsonError(400, "JSON object body шаардлагатай.");
  }
  const input = body as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(input, "expectedFinishAt")) {
    return jsonError(400, "expectedFinishAt шаардлагатай.");
  }
  const expectedFinishAt = parseDate(input.expectedFinishAt);
  if (expectedFinishAt === undefined) return jsonError(400, "expectedFinishAt огноо буруу.");
  if (input.confirmed !== undefined && typeof input.confirmed !== "boolean") {
    return jsonError(400, "confirmed нь boolean байна.");
  }

  try {
    const result = await reviseExpectedFinishCommand({
      actor: auth.user,
      orderId: id,
      expectedFinishAt,
      confirmed: input.confirmed === true,
      scope: scopeResult.branchId,
    });
    return jsonOk({
      ok: true,
      orderId: result.orderId,
      expectedFinishAt: result.expectedFinishAt?.toISOString() ?? null,
    });
  } catch (error) {
    if (error instanceof OrderScheduleCommandError) {
      return jsonError(error.status, error.message, {
        code: error.code,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      });
    }
    console.error("[orders expected-finish]", error instanceof Error ? error.name : "UnknownError");
    return jsonError(500, "Серверийн алдаа гарлаа. Дахин оролдоно уу.");
  }
}
