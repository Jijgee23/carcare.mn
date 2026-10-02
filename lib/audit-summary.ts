import { ITEM_KIND_LABEL, ORDER_STATUS_LABEL, SERVICE_ITEM_STATUS_LABEL } from "@/lib/orders";

// Status/kind кодууд давхцдаггүй (LABOR/DIAGNOSTIC/PART/FEE vs статус) тул нэг map-д нийлүүлнэ.
const LABELS: Record<string, string> = {
  ...ITEM_KIND_LABEL,
  ...SERVICE_ITEM_STATUS_LABEL,
  ...ORDER_STATUS_LABEL,
};

const ORDER_REF_RE = /засварын хуудас #([a-z0-9]{20,})/g;
const ITEM_REF_RE = /мөр ([a-z0-9]{20,})/g;

/** Summary доторх засварын хуудас / мөрийн cuid-уудыг цуглуулна (хуудас дээр нэг дор хайхад). */
export function extractAuditRefs(summary: string): { orderIds: string[]; itemIds: string[] } {
  return {
    orderIds: Array.from(summary.matchAll(ORDER_REF_RE), (m) => m[1]),
    itemIds: Array.from(summary.matchAll(ITEM_REF_RE), (m) => m[1]),
  };
}

export type AuditRefMaps = {
  orderNumbers?: Map<string, string | number>;
  itemLabels?: Map<string, string>;
};

/** Аудит summary доторх "IN_PROGRESS → COMPLETED" мэт кодыг монгол шошго болгоно (хуучин мөрүүдэд ч ажиллана). */
export function humanizeAuditSummary(summary: string, refs?: AuditRefMaps): string {
  return summary
    .replace(ORDER_REF_RE, (whole, id: string) => {
      const n = refs?.orderNumbers?.get(id);
      return n === undefined ? whole : `засварын хуудас #${n}`;
    })
    .replace(ITEM_REF_RE, (_whole, id: string) => {
      const label = refs?.itemLabels?.get(id);
      return label ? `мөр «${label}»` : "мөр";
    })
    .replace(/\b[A-Z][A-Z_]+\b/g, (code) => LABELS[code] ?? code);
}
