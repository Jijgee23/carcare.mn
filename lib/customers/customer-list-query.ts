// P3-B6 — one validated Customer list/search query contract, shared by the
// dashboard page (`app/dashboard/customers/page.tsx`) and the mobile API
// route (`app/api/v1/customers/route.ts` GET). Mirrors
// `lib/orders/order-list-query.ts` (P1-B1): pure, no Prisma client calls, no
// env, no auth — the caller owns `tenantId` and `orderBy`.
//
// Measured before this slice: both callers already search the exact same
// three fields (`fullName` case-insensitive, `phone` case-sensitive, `email`
// case-insensitive) with an identical `OR`, so the search field set is
// unchanged by this extraction. The one difference was ordering — the
// dashboard sorts `createdAt desc`, the API route sorts `fullName asc` — and
// that is deliberately left to each caller (not part of this contract),
// exactly like `buildOrderListWhere` leaves ordering to its callers.

import { Prisma } from "@/app/generated/prisma/client";
import {
  optionalText,
  parsePagination,
  rejectUnknownParams,
  type ListQueryParseError,
} from "@/lib/list-query-params";

const ALLOWED_PARAMS = ["q", "page", "pageSize", "limit"] as const;

export type CustomerListQuery = {
  q?: string;
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type CustomerListQueryParseResult =
  | { ok: true; value: CustomerListQuery }
  | ListQueryParseError;

/** Parse and validate the shared customers list/search query. */
export function parseCustomerListQuery(
  searchParams: URLSearchParams,
): CustomerListQueryParseResult {
  const unknown = rejectUnknownParams(searchParams, ALLOWED_PARAMS);
  if (unknown) return unknown;

  const pagination = parsePagination(searchParams);
  if ("ok" in pagination) return pagination;

  return {
    ok: true,
    value: {
      q: optionalText(searchParams, "q"),
      ...pagination,
    },
  };
}

export type BuildCustomerListWhereOptions = {
  tenantId: string;
};

/** Build the tenant-scoped Prisma predicate for the customers list query. */
export function buildCustomerListWhere(
  query: CustomerListQuery,
  options: BuildCustomerListWhereOptions,
): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { tenantId: options.tenantId };
  if (query.q) {
    where.OR = [
      { fullName: { contains: query.q, mode: "insensitive" } },
      { phone: { contains: query.q } },
      { email: { contains: query.q, mode: "insensitive" } },
    ];
  }
  return where;
}
