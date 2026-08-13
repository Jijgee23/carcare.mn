import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped context — Postgres RLS-д зориулж аль tenant-ийн нэрийн
 * өмнөөс query явуулж байгааг (эсвэл cross-tenant bypass эсэхийг) тээж явна.
 * `enterWith`-ээр тохируулснаар дуудагч талыг callback-аар wrap хийх
 * шаардлагагүй — тухайн цэгээс хойшхи бүх async үргэлжлэлд автоматаар үзэгдэнэ
 * (Node.js HTTP request бүр өөрийн гэсэн async execution context дээр
 * эхэлдэг тул зэрэгцээ хүсэлтүүд холилдохгүй).
 */
export type TenantContext =
  | { mode: "tenant"; tenantId: string }
  | { mode: "bypass" };

// `globalThis`-д хадгална — Next.js/Turbopack dev дотор энэ модуль хэд хэдэн
// тусдаа bundle chunk-д давхардаж ачаалагдаж болзошгүй (lib/prisma.ts дахь
// Prisma client-той адил учир шалтгаанаар); тусдаа AsyncLocalStorage instance
// үүсвэл setTenantContext/getTenantContext өөр өөр объект дээр ажиллаж, context
// "алдагдсан" мэт харагдана.
const globalForTenantContext = globalThis as unknown as {
  __tenantContextStorage?: AsyncLocalStorage<TenantContext>;
};

const storage =
  globalForTenantContext.__tenantContextStorage ??
  new AsyncLocalStorage<TenantContext>();
globalForTenantContext.__tenantContextStorage = storage;

/** Тухайн tenant-ийн нэрийн өмнөөс query явуулна (RLS: app.tenant_id). */
export function setTenantContext(tenantId: string): void {
  storage.enterWith({ mode: "tenant", tenantId });
}

/**
 * Cross-tenant үйлдэл (system admin, cron, webhook, Account-ийн олон
 * tenant-д хамаарах түүх) — RLS-г бүхэлд нь тойрч гарна. Зөвхөн код дотроо
 * аль хэдийн зохих хамгаалалттай (permission шалгалт, accountId/phone filter
 * гэх мэт) цэгүүдэд ашиглана.
 */
export function setBypassContext(): void {
  storage.enterWith({ mode: "bypass" });
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}
