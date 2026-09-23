// P3-B6 — one validated Vehicle list/search query contract, shared by the
// dashboard page (`app/dashboard/vehicles/page.tsx`) and the mobile API
// route (`app/api/v1/vehicles/route.ts` GET). Mirrors
// `lib/orders/order-list-query.ts` (P1-B1): pure, no Prisma client calls, no
// env, no auth — the caller owns `tenantId` and `orderBy`. Tenant isolation
// runs through `TenantVehicle`, never the global `Vehicle` row (Phase 3
// invariant), matching the current GET handler and the dashboard page.
//
// Measured before this slice — the two callers actually diverged:
//   - Dashboard search: vehicle plate/make/model/vin (case-insensitive) OR
//     customer fullName (case-insensitive) OR customer phone (case-sensitive).
//   - API route search: vehicle plate/make/model/vin only — no customer name
//     or phone match.
//   - Dashboard also filters `assigned` (yes/no, on `customerId`) and
//     `postpaid` (yes/no, on `isPostpaid`); the API route has neither.
//   - The API route filters an exact `customerId`; the dashboard does not.
// The task's acceptance bar is "search matches the same rows as the
// dashboard does today", so the dashboard's broader six-clause search is
// adopted as the one canonical field set — this is a deliberate WIDENING of
// what `GET /api/v1/vehicles?q=` matches (it now also matches on owner name
// and phone, same as the dashboard always has). `assigned` and `postpaid`
// are added to the shared contract because the dashboard page needs them and
// now goes through this same builder; they were not invented for mobile,
// they already existed as dashboard-only params. `customerId` (exact) is
// kept for the mobile/API caller's existing use. If both `customerId` and
// `assigned` are supplied, the exact `customerId` filter wins — no existing
// caller combines them today, but a URL splicing both must not fall over.

import { Prisma } from "@/app/generated/prisma/client";
import {
  optionalText,
  parsePagination,
  parseYesNo,
  rejectUnknownParams,
  type ListQueryParseError,
} from "@/lib/list-query-params";

const ALLOWED_PARAMS = [
  "q",
  "customerId",
  "assigned",
  "postpaid",
  "page",
  "pageSize",
  "limit",
] as const;

export type VehicleListQuery = {
  q?: string;
  customerId?: string;
  assigned?: "yes" | "no";
  postpaid?: "yes" | "no";
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type VehicleListQueryParseResult =
  | { ok: true; value: VehicleListQuery }
  | ListQueryParseError;

/** Parse and validate the shared vehicles list/search query. */
export function parseVehicleListQuery(
  searchParams: URLSearchParams,
): VehicleListQueryParseResult {
  const unknown = rejectUnknownParams(searchParams, ALLOWED_PARAMS);
  if (unknown) return unknown;

  const assigned = parseYesNo(searchParams, "assigned");
  if (typeof assigned === "object") return assigned;
  const postpaid = parseYesNo(searchParams, "postpaid");
  if (typeof postpaid === "object") return postpaid;

  const pagination = parsePagination(searchParams);
  if ("ok" in pagination) return pagination;

  return {
    ok: true,
    value: {
      q: optionalText(searchParams, "q"),
      customerId: optionalText(searchParams, "customerId"),
      assigned,
      postpaid,
      ...pagination,
    },
  };
}

function searchWhere(q: string): Prisma.TenantVehicleWhereInput["OR"] {
  return [
    { vehicle: { plate: { contains: q, mode: "insensitive" } } },
    { vehicle: { make: { contains: q, mode: "insensitive" } } },
    { vehicle: { model: { contains: q, mode: "insensitive" } } },
    { vehicle: { vin: { contains: q, mode: "insensitive" } } },
    { customer: { fullName: { contains: q, mode: "insensitive" } } },
    { customer: { phone: { contains: q } } },
  ];
}

export type BuildVehicleListWhereOptions = {
  tenantId: string;
};

/** Build the tenant-scoped `TenantVehicle` predicate for the vehicles list query. */
export function buildVehicleListWhere(
  query: VehicleListQuery,
  options: BuildVehicleListWhereOptions,
): Prisma.TenantVehicleWhereInput {
  const where: Prisma.TenantVehicleWhereInput = { tenantId: options.tenantId };
  if (query.q) where.OR = searchWhere(query.q);
  if (query.customerId) {
    where.customerId = query.customerId;
  } else if (query.assigned === "yes") {
    where.customerId = { not: null };
  } else if (query.assigned === "no") {
    where.customerId = null;
  }
  if (query.postpaid === "yes") where.isPostpaid = true;
  else if (query.postpaid === "no") where.isPostpaid = false;
  return where;
}
