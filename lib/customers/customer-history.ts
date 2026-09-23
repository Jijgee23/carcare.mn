// P3-B5 — Customer order history. Does not exist anywhere on the web today:
// the customer detail page shows only `_count.serviceOrders`, and staff
// reach history by navigating to the orders list filtered by `customerId`.
// Built fresh here, mirroring `lib/vehicles/vehicle-history.ts`'s shape for
// consistency between the two history endpoints.
//
// Unlike vehicle history (one vehicle's own rows, bounded in practice), a
// long-standing customer's order list is unbounded, so this is paginated
// using the repo's existing `lib/pagination.ts` helper — the same one the
// list routes use — rather than a bespoke cursor/limit scheme.

import { prisma } from "@/lib/prisma";
import { buildMeta, type PageInfo, type PaginationMeta } from "@/lib/pagination";

export type CustomerHistoryOrder = {
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
  vehicle: { id: string; plate: string; make: string; model: string } | null;
};

export type CustomerHistoryPage = {
  orders: CustomerHistoryOrder[];
  meta: PaginationMeta;
};

/**
 * Loads one page of a customer's tenant-scoped order history, newest first —
 * the same ordering and row shape as the vehicle detail page's order list,
 * plus the vehicle identity since a customer can have several vehicles.
 *
 * Callers are responsible for confirming the customer belongs to the
 * caller's tenant before calling this (this function itself also scopes by
 * `tenantId`, so a mismatched id simply yields an empty page — the route
 * still owns the 404-vs-cross-tenant distinction via its own customer
 * lookup, matching the sibling detail route's convention).
 */
export async function getCustomerOrderHistory(
  tenantId: string,
  customerId: string,
  page: PageInfo,
): Promise<CustomerHistoryPage> {
  const where = { tenantId, customerId };

  const [orders, total] = await Promise.all([
    prisma.serviceOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page.skip,
      take: page.take,
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
        vehicle: { select: { id: true, plate: true, make: true, model: true } },
      },
    }),
    prisma.serviceOrder.count({ where }),
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
      vehicle: o.vehicle,
    })),
    meta: buildMeta(total, page.page, page.pageSize),
  };
}
