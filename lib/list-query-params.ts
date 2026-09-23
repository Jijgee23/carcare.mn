// P3-B6 — the customer and vehicle list query builders share these small
// parsing primitives. Mirrors `lib/orders/order-list-query.ts` (P1-B1): pure,
// no Prisma client calls, no env, no auth. Each primitive returns either the
// parsed value or a `{ ok: false, field, message }` error shape so callers
// can short-circuit with `if (typeof x === "object") return x;`.

const MAX_PAGE_SIZE = 100;

export type ListQueryParseError = { ok: false; field: string; message: string };

export function optionalText(
  searchParams: URLSearchParams,
  name: string,
): string | undefined {
  const value = searchParams.get(name)?.trim();
  return value || undefined;
}

/** `"yes"` / `"no"` tri-state, matching the dashboard filter selects' values. */
export function parseYesNo(
  searchParams: URLSearchParams,
  name: string,
): "yes" | "no" | undefined | ListQueryParseError {
  const raw = searchParams.get(name);
  if (raw == null) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "yes" || value === "no") return value;
  return { ok: false, field: name, message: `${name} утга буруу байна.` };
}

export function parsePositiveInteger(
  searchParams: URLSearchParams,
  name: string,
  defaultValue: number,
  maxValue?: number,
): number | ListQueryParseError {
  const raw = searchParams.get(name);
  if (raw == null) return defaultValue;
  const value = raw.trim();
  if (!/^\d+$/.test(value)) {
    return { ok: false, field: name, message: `${name} утга буруу байна.` };
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || (maxValue != null && parsed > maxValue)) {
    return { ok: false, field: name, message: `${name} утга буруу байна.` };
  }
  return parsed;
}

export type ParsedPage = { page: number; pageSize: number; skip: number; take: number };

/**
 * `page` + `pageSize` (canonical) / `limit` (accepted alias, mirroring
 * `lib/orders/order-list-query.ts`). If both `pageSize` and `limit` are
 * present, both are validated but `pageSize` wins.
 */
export function parsePagination(
  searchParams: URLSearchParams,
): ParsedPage | ListQueryParseError {
  const page = parsePositiveInteger(searchParams, "page", 1);
  if (typeof page === "object") return page;

  let pageSize: number;
  if (searchParams.has("pageSize")) {
    const parsedPageSize = parsePositiveInteger(searchParams, "pageSize", 50, MAX_PAGE_SIZE);
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
  return { page, pageSize, skip, take: pageSize };
}

/**
 * Reject any query parameter name that is not in `allowed` — an invalid or
 * unknown parameter must be rejected, not silently ignored (P3-B6).
 */
export function rejectUnknownParams(
  searchParams: URLSearchParams,
  allowed: readonly string[],
): ListQueryParseError | undefined {
  for (const key of searchParams.keys()) {
    if (!allowed.includes(key)) {
      return { ok: false, field: key, message: `${key} параметр танигдсангүй.` };
    }
  }
  return undefined;
}
