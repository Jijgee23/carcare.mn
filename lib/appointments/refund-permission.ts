import { requirePermission } from "@/lib/api";
import type { ApiUser } from "@/lib/auth/api-token";

/**
 * The appointment refund boundary is deliberately kept separate from the
 * route's database work so it can be exercised without a database connection.
 * Refund is a destructive payment mutation: edit/check access is insufficient.
 */
export function requireAppointmentRefundPermission(
  user: ApiUser,
) {
  return requirePermission(user, "payments.delete");
}
