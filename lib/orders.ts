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
  SCHEDULED: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  IN_PROGRESS: "bg-blue-500/15 text-blue-400 border border-blue-500/25",
  WAITING_PARTS: "bg-purple-500/15 text-purple-300 border border-purple-500/25",
  COMPLETED: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
  CANCELLED: "bg-red-500/10 text-red-400 border border-red-500/20",
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

export const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Төлөгдөөгүй",
  PARTIAL: "Хагас",
  PAID: "Төлөгдсөн",
};

export const PAYMENT_STATUS_BADGE: Record<PaymentStatus, string> = {
  UNPAID: "bg-red-500/15 text-red-300 border border-red-500/25",
  PARTIAL: "bg-amber-500/15 text-amber-300 border border-amber-500/25",
  PAID: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
};

export const ITEM_KINDS = ["LABOR", "DIAGNOSTIC", "PART", "FEE"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  LABOR: "Ажил",
  DIAGNOSTIC: "Оношилгоо",
  PART: "Сэлбэг",
  FEE: "Хураамж",
};

export const ITEM_KIND_BADGE: Record<ItemKind, string> = {
  LABOR: "bg-blue-500/15 text-blue-300 border border-blue-500/25",
  DIAGNOSTIC: "bg-violet-500/15 text-violet-300 border border-violet-500/25",
  PART: "bg-amber-500/15 text-amber-300 border border-amber-500/25",
  FEE: "bg-zinc-500/15 text-zinc-300 border border-zinc-500/25",
};

export function formatTugrik(amount: number | string | null | undefined): string {
  if (amount == null) return "—";
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("mn-MN", { maximumFractionDigits: 2 })}₮`;
}
