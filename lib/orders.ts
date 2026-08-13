export const ORDER_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  SCHEDULED: "Товлогдсон",
  IN_PROGRESS: "Хийгдэж байна",
  WAITING_PARTS: "Сэлбэг хүлээж буй",
  COMPLETED: "Дууссан",
  CANCELLED: "Цуцлагдсан",
};

export const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  SCHEDULED:
    "bg-amber-500/15 text-amber-400 border border-amber-500/25 light:bg-amber-100 light:border-amber-300 light:text-amber-700",
  IN_PROGRESS:
    "bg-blue-500/15 text-blue-400 border border-blue-500/25 light:bg-blue-100 light:border-blue-300 light:text-blue-700",
  WAITING_PARTS:
    "bg-purple-500/15 text-purple-300 border border-purple-500/25 light:bg-purple-100 light:border-purple-300 light:text-purple-700",
  COMPLETED:
    "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 light:bg-emerald-100 light:border-emerald-300 light:text-emerald-700",
  CANCELLED:
    "bg-red-500/10 text-red-400 border border-red-500/20 light:bg-red-100 light:border-red-300 light:text-red-700",
};

// Аль статус руу шилжих боломжтой вэ?
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_PARTS", "COMPLETED", "CANCELLED"],
  WAITING_PARTS: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

// Эцсийн (цоожтой) төлөв — захиалгын мэдээлэл засах, мөр нэмэх/устгах боломжгүй.
export function isOrderLocked(status: OrderStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

// Захиалга эхэлсэн үү — оношилгоо бөглөх боломжтой эсэх. Зөвхөн эхэлсэн идэвхтэй
// төлөвт (SCHEDULED биш, дууссан/цуцлагдсан биш) бөглөнө.
export function canFillDiagnostics(status: OrderStatus): boolean {
  return status === "IN_PROGRESS" || status === "WAITING_PARTS";
}

export const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Төлөгдөөгүй",
  PARTIAL: "Хагас",
  PAID: "Төлөгдсөн",
};

export const PAYMENT_STATUS_BADGE: Record<PaymentStatus, string> = {
  UNPAID:
    "bg-red-500/15 text-red-300 border border-red-500/25 light:bg-red-100 light:border-red-300 light:text-red-700",
  PARTIAL:
    "bg-amber-500/15 text-amber-300 border border-amber-500/25 light:bg-amber-100 light:border-amber-300 light:text-amber-700",
  PAID:
    "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 light:bg-emerald-100 light:border-emerald-300 light:text-emerald-700",
};

// Дараа төлбөрт (гэрээт) машин/захиалгын тэмдэг — олон хуудсанд нийтлэг.
export const POSTPAID_LABEL = "Дараа төлбөрт";
export const POSTPAID_BADGE =
  "bg-sky-500/15 text-sky-300 border border-sky-500/25 light:bg-sky-100 light:border-sky-300 light:text-sky-700";

export const ITEM_KINDS = ["LABOR", "DIAGNOSTIC", "PART", "FEE"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  LABOR: "Ажил",
  DIAGNOSTIC: "Оношилгоо",
  PART: "Сэлбэг",
  FEE: "Хураамж",
};

export const ITEM_KIND_BADGE: Record<ItemKind, string> = {
  LABOR:
    "bg-blue-500/15 text-blue-300 border border-blue-500/25 light:bg-blue-100 light:border-blue-300 light:text-blue-700",
  DIAGNOSTIC:
    "bg-violet-500/15 text-violet-300 border border-violet-500/25 light:bg-violet-100 light:border-violet-300 light:text-violet-700",
  PART: "bg-amber-500/15 text-amber-300 border border-amber-500/25 light:bg-amber-100 light:border-amber-300 light:text-amber-700",
  FEE: "bg-zinc-500/15 text-zinc-300 border border-zinc-500/25 light:bg-zinc-100 light:border-zinc-300 light:text-zinc-600",
};

export function formatTugrik(amount: number | string | null | undefined): string {
  if (amount == null) return "—";
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("mn-MN", { maximumFractionDigits: 2 })}₮`;
}
