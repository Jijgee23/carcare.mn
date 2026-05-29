export type ServiceKind = "LABOR" | "DIAGNOSTIC" | "GOODS";

// Хэрэглэгчийн UI-д DIAGNOSTIC оруулахгүй — оношилгоо нь DiagnosticTemplate-аар удирдагдана.
export const SERVICE_KINDS: ServiceKind[] = ["LABOR", "GOODS"];

export const SERVICE_KIND_LABEL: Record<ServiceKind, string> = {
  LABOR: "Ажил",
  DIAGNOSTIC: "Оношилгоо",
  GOODS: "Сэлбэг/Бараа",
};

export const SERVICE_KIND_DESCRIPTION: Record<ServiceKind, string> = {
  LABOR: "Гүйцэтгэх ажил (жишээ: тосны солилт)",
  DIAGNOSTIC: "Оношилгооны үйлчилгээ (жишээ: хөдөлгүүрийн оношилгоо)",
  GOODS: "Зарагдах бараа, сэлбэг (нөөц хяналттай)",
};

export const SERVICE_KIND_BADGE: Record<ServiceKind, string> = {
  LABOR: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  DIAGNOSTIC: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  GOODS: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
};

export const SERVICE_KIND_SLUG: Record<ServiceKind, string> = {
  LABOR: "labor",
  DIAGNOSTIC: "diagnostics",
  GOODS: "goods",
};

export const SERVICE_KIND_BY_SLUG: Record<string, ServiceKind> = {
  labor: "LABOR",
  goods: "GOODS",
};

export const LOW_STOCK_THRESHOLD = 5;

export type StockLevel = "out" | "low" | "ok";

export function stockLevel(stock: number): StockLevel {
  if (stock <= 0) return "out";
  if (stock < LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}

export const STOCK_BADGE: Record<StockLevel, string> = {
  out: "bg-red-500/15 text-red-400 border border-red-500/25",
  low: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  ok: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
};

export const STOCK_LABEL: Record<StockLevel, string> = {
  out: "Дууссан",
  low: "Бага үлдэгдэл",
  ok: "Хүрэлцээтэй",
};

export function formatStock(
  qty: number | string,
  unit: string | null,
): string {
  const n = typeof qty === "string" ? Number.parseFloat(qty) : qty;
  if (!Number.isFinite(n)) return "—";
  const text = Number.isInteger(n)
    ? n.toLocaleString("mn-MN")
    : n.toLocaleString("mn-MN", { maximumFractionDigits: 3 });
  return unit ? `${text} ${unit}` : text;
}

export function formatDuration(
  value: number | string | null | undefined,
  unitName: string | null | undefined,
): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(n)) return "—";
  const text = Number.isInteger(n)
    ? n.toLocaleString("mn-MN")
    : n.toLocaleString("mn-MN", { maximumFractionDigits: 3 });
  return unitName ? `${text} ${unitName}` : text;
}
