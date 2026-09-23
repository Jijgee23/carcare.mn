import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { parseBusinessLocalDateTime } from "@/lib/booking-time";
import { SUBSCRIPTION_LOCKED_MESSAGE } from "@/lib/subscription";
import {
  AppointmentCommandError,
  STAFF_SCOPE_MESSAGES,
  rescheduleAppointmentCommand,
} from "@/lib/appointments/appointment-commands";

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const local = parseBusinessLocalDateTime(value.trim());
  return Number.isFinite(local.getTime()) ? local : undefined;
}

/**
 * `assertStaffScope`/`assertActiveSubscription` inside the P2-B1 command
 * throw a plain `Error` for permission/branch/subscription rejection (not
 * `AppointmentCommandError`) — mirrors `knownAuthorizationMessage` handling
 * in `app/_actions/appointments.ts` for the same command.
 */
function commandErrorResponse(error: unknown) {
  if (error instanceof AppointmentCommandError) {
    return jsonError(error.status, error.message, {
      code: error.code,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    });
  }
  if (error instanceof Error && (STAFF_SCOPE_MESSAGES as readonly string[]).includes(error.message)) {
    return jsonError(403, error.message);
  }
  if (error instanceof Error && error.message === SUBSCRIPTION_LOCKED_MESSAGE) {
    return jsonError(403, error.message, { code: "SUBSCRIPTION_EXPIRED" });
  }
  console.error("[appointments/reschedule]", error instanceof Error ? error.name : "UnknownError");
  return jsonError(500, "Серверийн алдаа гарлаа. Дахин оролдоно уу.");
}

/**
 * POST /api/v1/appointments/[id]/reschedule
 * Body: { requestedAt: string, confirmed?: boolean }
 * Permission: appointments.edit
 * Thin adapter over the P2-B1 `rescheduleAppointmentCommand` — the same
 * command `app/_actions/appointments.ts`'s `rescheduleAppointmentAction`
 * calls. Working-hours validation applies; per D-111 the removed
 * capacity-blind generic overlap-confirm warning is NOT reintroduced here —
 * see the command's own D-111 note.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "appointments.edit");
  if (denied) return denied;

  const { id } = await ctx.params;

  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;

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
  const requestedAt = parseDate(input.requestedAt);
  if (!requestedAt) return jsonError(400, "requestedAt огноо шаардлагатай.");
  if (input.confirmed !== undefined && typeof input.confirmed !== "boolean") {
    return jsonError(400, "confirmed нь boolean байна.");
  }

  try {
    const result = await rescheduleAppointmentCommand({
      actor: { ...auth.user, workingBranchId: scopeResult.branchId ?? undefined },
      appointmentId: id,
      requestedAt,
      confirmed: input.confirmed === true,
    });
    return jsonOk({
      ok: true,
      appointmentId: result.appointmentId,
      orderId: result.orderId ?? null,
      linked: result.linked,
      requestedAt: requestedAt.toISOString(),
    });
  } catch (error) {
    return commandErrorResponse(error);
  }
}
