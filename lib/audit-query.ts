// P7-B1 — audit `where`/pagination builder, extracted from
// `app/dashboard/audit/page.tsx` so both the web page and
// `GET /api/v1/audit` filter identically. Pure: no Prisma client calls.

import type { Prisma } from "@/app/generated/prisma/client";

export const AUDIT_PAGE_SIZE = 50;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type AuditRangeParamError = { field: string; message: string };

/**
 * Validates the `from`/`to` query params for `GET /api/v1/audit`: both
 * optional, but if present must be `YYYY-MM-DD` and `from <= to`. Mirrors
 * `lib/reports.ts`'s `validateReportRangeParams` shape/style.
 */
export function validateAuditRangeParams(searchParams: {
  from?: string | null;
  to?: string | null;
}): AuditRangeParamError | null {
  const from = searchParams.from ?? undefined;
  const to = searchParams.to ?? undefined;

  for (const [field, value] of [["from", from], ["to", to]] as const) {
    if (value != null && !DATE_RE.test(value)) {
      return { field, message: `${field} нь YYYY-MM-DD хэлбэртэй байна.` };
    }
  }

  if (from && to) {
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T00:00:00`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return { field: "from", message: "Огноо буруу байна." };
    }
    if (fromDate.getTime() > toDate.getTime()) {
      return { field: "to", message: "to нь from-оос хойш байх ёстой." };
    }
  }

  return null;
}

export type AuditQueryFilters = {
  q?: string;
  action?: string;
  entity?: string;
  userId?: string;
  /** Inclusive, local calendar date (`YYYY-MM-DD`). */
  from?: string;
  /** Inclusive, local calendar date (`YYYY-MM-DD`). */
  to?: string;
};

/**
 * Builds the tenant-scoped `AuditLog` `where` clause from raw (already
 * trimmed/validated) filter strings. `from`/`to` are parsed as local-date
 * boundaries (start of day / end of day), matching the web `DatePicker`'s
 * `from`/`to` semantics elsewhere in the app.
 */
export function buildAuditWhere(
  tenantId: string,
  filters: AuditQueryFilters,
): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = { tenantId };
  if (filters.action) {
    where.action = filters.action as Prisma.EnumAuditActionFilter["equals"];
  }
  if (filters.entity) where.entity = filters.entity;
  if (filters.userId) where.userId = filters.userId;
  if (filters.q) {
    where.OR = [
      { summary: { contains: filters.q, mode: "insensitive" } },
      { entityId: { contains: filters.q } },
    ];
  }
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00`) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999`) } : {}),
    };
  }
  return where;
}

/** Parses a `page` query/search-param string to a page number, 1 or greater. */
export function parseAuditPage(pageStr: string | undefined): number {
  return Math.max(1, Number.parseInt(pageStr ?? "1", 10) || 1);
}

export type AuditPagination = {
  page: number;
  skip: number;
  take: number;
  pageSize: number;
};

/** `page` → Prisma `skip`/`take`, fixed at `AUDIT_PAGE_SIZE`. */
export function auditPagination(page: number): AuditPagination {
  return {
    page,
    skip: (page - 1) * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
    pageSize: AUDIT_PAGE_SIZE,
  };
}
