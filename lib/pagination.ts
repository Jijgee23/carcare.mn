/**
 * Хуудаслалтын (pagination) нийтлэг туслахууд.
 *
 * - Server component (dashboard хуудсууд) `searchParams`-аас `page`-ийг уншиж
 *   Prisma `skip`/`take`-руу буулгана.
 * - Route handler-ууд (mobile API) `page` + `pageSize`/`limit` query-г уншина.
 *
 * Хариу/линкийг нэгтгэхийн тулд `buildMeta` нь нийт тоо, хуудасны тоог тооцоолно.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_API_PAGE_SIZE = 50;
export const MAX_API_PAGE_SIZE = 200;

export type PageInfo = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

/** `page` query-г 1-ээс багагүй бүхэл тоо болгож хувиргана. */
export function parsePage(value: string | string[] | undefined | null): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Server component-д: `searchParams.page`-аас Prisma-д өгөх `skip`/`take`-г гаргана.
 */
export function getPageInfo(
  pageValue: string | string[] | undefined | null,
  pageSize: number = DEFAULT_PAGE_SIZE,
): PageInfo {
  const page = parsePage(pageValue);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * Route handler-д: `page` + `pageSize` (эсвэл хуучин `limit`) query-г уншина.
 * `limit`-ийг буцаах нийцтэй байлгахын тулд `pageSize`-ийн нэр болгон хүлээж авна.
 */
export function getApiPageInfo(
  searchParams: URLSearchParams,
  opts?: { defaultSize?: number; maxSize?: number },
): PageInfo {
  const defaultSize = opts?.defaultSize ?? DEFAULT_API_PAGE_SIZE;
  const maxSize = opts?.maxSize ?? MAX_API_PAGE_SIZE;
  const sizeRaw =
    searchParams.get("pageSize") ?? searchParams.get("limit") ?? String(defaultSize);
  const pageSize = Math.min(
    Math.max(Number.parseInt(sizeRaw, 10) || defaultSize, 1),
    maxSize,
  );
  const page = parsePage(searchParams.get("page"));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** Нийт тоо + одоогийн хуудаснаас meta-г бүрдүүлнэ. */
export function buildMeta(
  total: number,
  page: number,
  pageSize: number,
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(page, 1), totalPages);
  return {
    page: clampedPage,
    pageSize,
    total,
    totalPages,
    hasPrev: clampedPage > 1,
    hasNext: clampedPage < totalPages,
  };
}
