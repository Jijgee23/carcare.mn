export type SortDir = "asc" | "desc";

export function parseSort<K extends string>(
  sp: { sort?: string; dir?: string },
  allowed: readonly K[],
  fallback: { key: K; dir: SortDir },
): { key: K; dir: SortDir } {
  const key = (allowed as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as K) : null;
  if (!key) return fallback;
  return { key, dir: sp.dir === "asc" ? "asc" : "desc" };
}

export function toggleSortHref(params: URLSearchParams, key: string, current: { key: string; dir: SortDir }): string {
  const next = new URLSearchParams(params);
  next.delete("page");
  next.set("sort", key);
  next.set("dir", current.key === key && current.dir === "desc" ? "asc" : "desc");
  return `?${next.toString()}`;
}

const UB_OFFSET_MS = 8 * 60 * 60 * 1000; // Asia/Ulaanbaatar, no DST
const p2 = (n: number) => String(n).padStart(2, "0");

export function formatShortDateTime(d: Date, now: Date = new Date()): string {
  const ub = new Date(d.getTime() + UB_OFFSET_MS);
  const nowUb = new Date(now.getTime() + UB_OFFSET_MS);
  const md = `${p2(ub.getUTCMonth() + 1)}.${p2(ub.getUTCDate())} ${p2(ub.getUTCHours())}:${p2(ub.getUTCMinutes())}`;
  return ub.getUTCFullYear() === nowUb.getUTCFullYear() ? md : `${ub.getUTCFullYear()}.${md}`;
}
