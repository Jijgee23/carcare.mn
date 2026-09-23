import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { confirmAppointmentPayment } from "@/lib/appointment-payments";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/v1/appointments/[id]/payment
 * Permission: payments.view
 *
 * Staff-realm equivalent of `checkAppointmentPaymentAction`
 * (`app/_actions/appointment-payments.ts`), which the account-facing "pay"
 * page polls. Re-verifies the QPay checkout against the provider
 * (`confirmAppointmentPayment`) and, only on confirmed payment, creates the
 * `AppointmentPayment` ledger row under a branch row lock
 * (`recordLatePaymentUnderLock` inside `lib/appointment-payments.ts`) — this
 * route never trusts a client-supplied paid/amount value, it only asks the
 * shared command to re-check persisted/provider state.
 *
 * `payments.view` (not `.edit`) is deliberate per P2-B6: this is a read-through
 * status check for staff, mirroring the account app's own check endpoint,
 * which requires no special permission beyond account ownership.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "payments.view");
  if (denied) return denied;

  const { id } = await ctx.params;

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

  const result = await confirmAppointmentPayment(appt.id);
  return jsonOk(result);
}
