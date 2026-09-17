/**
 * Жагсаалтын хуудсанд "олноор сонгож" нэг зэрэг ажиллуулдаг action-уудын
 * (захиалгын статус/хариуцагч, цаг захиалгын ажлын төрөл г.м.) нийтлэг
 * хэсгүүд. All-or-nothing БИШ загвар — сонголт бүрийг тус тусад нь
 * боловсруулж, амжилтгүй болсныг (`errors`) тусад нь мэдээлнэ, бусдыг
 * зогсоохгүй (харах: app/_actions/orders.ts-ийн bulkChangeOrderStatusAction).
 */
export type BulkActionState = {
  ok: boolean;
  message?: string;
  succeeded?: number;
  failed?: number;
  errors?: string[];
} | null;

/** Клиент талаас `JSON.stringify(string[])`-ээр илгээсэн id-уудыг задална. */
export function parseIdsJson(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
  } catch {
    return [];
  }
}
