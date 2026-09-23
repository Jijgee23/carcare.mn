// P3-B5 — Vehicle service history, extracted per DM-05 so the dashboard
// detail page and the new `app/api/v1/vehicles/[id]/history/route.ts` share
// one implementation instead of the page's inline Prisma queries.
//
// Re-measured against `app/dashboard/vehicles/[id]/page.tsx` as it stands
// after `6c4ecc1` ("vehicle-per-owner"): the plate-history model dropped by
// that commit is gone for good — the page's history is exactly ServiceOrder
// rows, Appointment rows and a DiagnosticReport count, each scoped
// `{ tenantId, vehicleId }`. This module reproduces that shape and nothing
// more; do not reintroduce the dropped concept here (D-153).
//
// `Vehicle` is a global hub model with no `tenantId` (a row is one owner's
// registration, shared cross-tenant since 6c4ecc1). Every query below scopes
// through the tenant's own `ServiceOrder`/`Appointment`/`DiagnosticReport`
// rows, never through the global `Vehicle` row — those three models each
// carry their own `tenantId` column, which is what makes this safe.

import { prisma } from "@/lib/prisma";

export type VehicleHistoryOrder = {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  scheduledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  totalAmount: string | null;
  branch: { name: string };
  itemCount: number;
};

export type VehicleHistoryAppointment = {
  id: string;
  status: string;
  requestedAt: Date;
  note: string | null;
  branch: { name: string };
  category: { name: string } | null;
};

export type VehicleHistory = {
  orders: VehicleHistoryOrder[];
  appointments: VehicleHistoryAppointment[];
  diagnosticReportCount: number;
};

/**
 * Loads a vehicle's full service history for one tenant: every ServiceOrder
 * and Appointment row scoped `{ tenantId, vehicleId }`, plus a
 * DiagnosticReport count. Unbounded (matches the page's current behaviour —
 * one vehicle's own history, not a tenant-wide list), unlike customer order
 * history which must be paginated (see `lib/customers/customer-history.ts`).
 *
 * Callers are responsible for confirming the vehicle is linked to the
 * caller's tenant (via `TenantVehicle`) before calling this — that 404 vs.
 * empty-history distinction belongs to the route/page, not this query.
 */
export async function getVehicleHistory(
  tenantId: string,
  vehicleId: string,
): Promise<VehicleHistory> {
  const [orders, appointments, diagnosticReportCount] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: { tenantId, vehicleId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        scheduledAt: true,
        completedAt: true,
        createdAt: true,
        totalAmount: true,
        branch: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { tenantId, vehicleId },
      orderBy: { requestedAt: "desc" },
      select: {
        id: true,
        status: true,
        requestedAt: true,
        note: true,
        branch: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.diagnosticReport.count({
      where: { tenantId, vehicleId },
    }),
  ]);

  return {
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      paymentStatus: o.paymentStatus,
      scheduledAt: o.scheduledAt,
      completedAt: o.completedAt,
      createdAt: o.createdAt,
      totalAmount: o.totalAmount?.toString() ?? null,
      branch: o.branch,
      itemCount: o._count.items,
    })),
    appointments,
    diagnosticReportCount,
  };
}

/**
 * Whether the vehicle's owner may be changed. Mirrors the page's prior
 * inline rule exactly: any order or diagnostic report locks the owner
 * (matching `updateVehicleAction`'s equivalent check). Kept here, next to
 * the queries it depends on, rather than in the page or the route, so both
 * callers compute it identically instead of re-deriving it from raw history
 * arrays — the page previously computed it inline from the same two facts.
 */
export function isOwnerLocked(history: Pick<VehicleHistory, "orders" | "diagnosticReportCount">): boolean {
  return history.orders.length > 0 || history.diagnosticReportCount > 0;
}
