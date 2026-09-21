import { Prisma } from "@/app/generated/prisma/client";
import {
  PAYMENT_STATUSES,
  type PaymentStatus,
} from "@/lib/orders";
import { bookingDayBounds } from "@/lib/booking-time";

const MAX_PAGE_SIZE = 100;

export type PostpaidQuery = {
  vehicleId?: string;
  paymentStatus?: PaymentStatus;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type PostpaidQueryParseResult =
  | { ok: true; value: PostpaidQuery }
  | { ok: false; field: string; message: string };

export type PostpaidScopeOptions = {
  tenantId: string;
  workingBranchId?: string | null;
  readWhere: Prisma.ServiceOrderWhereInput;
};

function optionalText(
  searchParams: URLSearchParams,
  name: string,
): string | undefined {
  const value = searchParams.get(name)?.trim();
  return value || undefined;
}

function parsePaymentStatus(
  searchParams: URLSearchParams,
): PaymentStatus | undefined | PostpaidQueryParseResult {
  const raw = searchParams.get("paymentStatus");
  if (raw == null) return undefined;
  const value = raw.trim();
  if (PAYMENT_STATUSES.includes(value as PaymentStatus)) {
    return value as PaymentStatus;
  }
  return {
    ok: false,
    field: "paymentStatus",
    message: "paymentStatus утга буруу байна.",
  };
}

function parseDate(
  searchParams: URLSearchParams,
  name: "dateFrom" | "dateTo",
): string | undefined | PostpaidQueryParseResult {
  const raw = searchParams.get(name);
  if (raw == null) return undefined;
  const value = raw.trim();
  try {
    bookingDayBounds(value);
  } catch {
    return { ok: false, field: name, message: `${name} огноо буруу байна.` };
  }
  return value;
}

function parsePositiveInteger(
  searchParams: URLSearchParams,
  name: string,
  defaultValue: number,
  maxValue?: number,
): number | PostpaidQueryParseResult {
  const raw = searchParams.get(name);
  if (raw == null) return defaultValue;
  const value = raw.trim();
  if (!/^\d+$/.test(value)) {
    return { ok: false, field: name, message: `${name} утга буруу байна.` };
  }
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    (maxValue != null && parsed > maxValue)
  ) {
    return { ok: false, field: name, message: `${name} утга буруу байна.` };
  }
  return parsed;
}

/** Parse the complete, strictly validated postpaid query string. */
export function parsePostpaidQuery(
  searchParams: URLSearchParams,
): PostpaidQueryParseResult {
  const paymentStatus = parsePaymentStatus(searchParams);
  if (typeof paymentStatus === "object") return paymentStatus;
  const dateFrom = parseDate(searchParams, "dateFrom");
  if (typeof dateFrom === "object") return dateFrom;
  const dateTo = parseDate(searchParams, "dateTo");
  if (typeof dateTo === "object") return dateTo;

  const page = parsePositiveInteger(searchParams, "page", 1);
  if (typeof page === "object") return page;

  // pageSize is canonical. Validate a supplied legacy limit even when
  // pageSize wins, so malformed input never silently reaches Prisma.
  let pageSize: number;
  if (searchParams.has("pageSize")) {
    const parsedPageSize = parsePositiveInteger(
      searchParams,
      "pageSize",
      50,
      MAX_PAGE_SIZE,
    );
    if (typeof parsedPageSize === "object") return parsedPageSize;
    pageSize = parsedPageSize;
    if (searchParams.has("limit")) {
      const limit = parsePositiveInteger(searchParams, "limit", 50, MAX_PAGE_SIZE);
      if (typeof limit === "object") return limit;
    }
  } else {
    const limit = parsePositiveInteger(searchParams, "limit", 50, MAX_PAGE_SIZE);
    if (typeof limit === "object") return limit;
    pageSize = limit;
  }

  const skip = (page - 1) * pageSize;
  if (!Number.isSafeInteger(skip)) {
    return { ok: false, field: "page", message: "page утга буруу байна." };
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return {
      ok: false,
      field: "dateFrom",
      message: "dateFrom нь dateTo-оос хойш байж болохгүй.",
    };
  }

  return {
    ok: true,
    value: {
      vehicleId: optionalText(searchParams, "vehicleId"),
      paymentStatus,
      dateFrom: typeof dateFrom === "string" ? dateFrom : undefined,
      dateTo: typeof dateTo === "string" ? dateTo : undefined,
      page,
      pageSize,
      skip,
      take: pageSize,
    },
  };
}

/** Build the mandatory tenant/working-branch/access scope for postpaid orders. */
export function buildPostpaidScopeWhere(
  options: PostpaidScopeOptions,
): Prisma.ServiceOrderWhereInput {
  return {
    tenantId: options.tenantId,
    isPostpaid: true,
    ...(options.workingBranchId
      ? { branchId: options.workingBranchId }
      : {}),
    // Keep access predicates conjunctive. A client filter must never be able
    // to overwrite viewOwn or the empty predicate for a user with no access.
    AND: [options.readWhere],
  };
}

/** Build the history predicate; cancelled orders remain in history. */
export function buildPostpaidHistoryWhere(
  query: PostpaidQuery,
  options: PostpaidScopeOptions,
): Prisma.ServiceOrderWhereInput {
  const scheduledAt: Prisma.DateTimeNullableFilter = {};
  if (query.dateFrom) scheduledAt.gte = bookingDayBounds(query.dateFrom).start;
  if (query.dateTo) scheduledAt.lt = bookingDayBounds(query.dateTo).end;

  return {
    ...buildPostpaidScopeWhere(options),
    ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    ...(query.dateFrom || query.dateTo ? { scheduledAt } : {}),
  };
}

/** Build the all-time aggregate predicate. Cancelled orders never contribute. */
export function buildPostpaidAggregateWhere(
  options: PostpaidScopeOptions,
): Prisma.ServiceOrderWhereInput {
  return {
    ...buildPostpaidScopeWhere(options),
    status: { not: "CANCELLED" },
  };
}

/** Build the predicate used to discover links visible to the current user. */
export function buildPostpaidVisibleOrdersWhere(
  options: PostpaidScopeOptions,
): Prisma.ServiceOrderWhereInput {
  return buildPostpaidScopeWhere(options);
}

export type PostpaidVehicleLink = {
  vehicle: {
    id: string;
    plate: string;
    make: string;
    model: string;
  };
  customer: { id: string; fullName: string; phone: string } | null;
};

export type PostpaidAggregateGroup = {
  vehicleId: string;
  _count: { _all: number };
  _sum: { totalAmount: unknown; paidAmount: unknown };
};

export type PostpaidVehicleAggregate = {
  id: string;
  plate: string;
  make: string;
  model: string;
  customer: { id: string; fullName: string; phone: string } | null;
  orderCount: number;
  totalAmount: string;
  paidAmount: string;
  balanceAmount: string;
};

function decimalString(value: unknown): string {
  if (value == null) return "0";
  return String(value);
}

/** Serialize Prisma aggregate rows without leaking Decimal objects to JSON. */
export function serializePostpaidVehicleAggregates(
  links: readonly PostpaidVehicleLink[],
  groups: readonly PostpaidAggregateGroup[],
): PostpaidVehicleAggregate[] {
  const groupByVehicle = new Map(groups.map((group) => [group.vehicleId, group]));
  return links.map((link) => {
    const group = groupByVehicle.get(link.vehicle.id);
    const total = new Prisma.Decimal(decimalString(group?._sum.totalAmount));
    const paid = new Prisma.Decimal(decimalString(group?._sum.paidAmount));
    return {
      id: link.vehicle.id,
      plate: link.vehicle.plate,
      make: link.vehicle.make,
      model: link.vehicle.model,
      customer: link.customer,
      orderCount: group?._count._all ?? 0,
      totalAmount: total.toString(),
      paidAmount: paid.toString(),
      balanceAmount: total.minus(paid).toString(),
    };
  });
}
