import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { SUBSCRIPTION_LOCKED_MESSAGE } from "@/lib/subscription";
import {
  AppointmentCommandError,
  STAFF_SCOPE_MESSAGES,
  rejectAppointmentCommand,
} from "@/lib/appointments/appointment-commands";

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
  console.error("[appointments/reject]", error instanceof Error ? error.name : "UnknownError");
  return jsonError(500, "Серверийн алдаа гарлаа. Дахин оролдоно уу.");
}

/**
 * POST /api/v1/appointments/[id]/reject
 * Permission: appointments.edit
 * Thin adapter over the P2-B1 `rejectAppointmentCommand` — the same command
 * `app/_actions/appointments.ts`'s `rejectAppointmentAction` calls.
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

  try {
    const result = await rejectAppointmentCommand({
      actor: { ...auth.user, workingBranchId: scopeResult.branchId ?? undefined },
      appointmentId: id,
    });
    return jsonOk({ ok: true, appointmentId: result.appointmentId, status: "REJECTED" });
  } catch (error) {
    return commandErrorResponse(error);
  }
}
