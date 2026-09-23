// P3-B5 — GET /api/v1/vehicles/[id]/history
// Thin adapter over `lib/vehicles/vehicle-history.ts` (DM-05 — the same
// query `app/dashboard/vehicles/[id]/page.tsx` now calls). Mirrors the
// auth/permission/404 conventions of the sibling
// `app/api/v1/vehicles/[id]/route.ts` exactly, including confirming the
// `TenantVehicle` link before returning anything — a vehicle that exists
// but has no link for this tenant must look identical to one that does not
// exist at all (404, never 403).

import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getVehicleHistory, isOwnerLocked } from "@/lib/vehicles/vehicle-history";

// GET /api/v1/vehicles/[id]/history
// Permission: vehicles.view
// Unbounded (matches the page's current behaviour: one vehicle's own
// history), unlike customer order history which is paginated.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "vehicles.view");
  if (denied) return denied;

  const { id } = await ctx.params;

  const link = await prisma.tenantVehicle.findUnique({
    where: { tenantId_vehicleId: { tenantId: auth.user.tenantId, vehicleId: id } },
    select: { id: true },
  });
  if (!link) return jsonError(404, "Машин олдсонгүй.");

  const history = await getVehicleHistory(auth.user.tenantId, id);

  return jsonOk({
    orders: history.orders,
    appointments: history.appointments,
    diagnosticReportCount: history.diagnosticReportCount,
    ownerLocked: isOwnerLocked(history),
  });
}
