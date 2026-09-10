import {
  ORDER_POSTPONE_REASON_TAG_LABEL,
  ORDER_STATUS_LABEL,
  type OrderPostponeReasonTag,
  type OrderStatus,
} from "@/lib/orders";

// Customer-facing status timeline (D-079). Consumes the filtered shape from
// ORDER_STATUS_HISTORY_CUSTOMER_SELECT (lib/orders.ts) — no `reason` free
// text, no `changedBy` staff identity, only the transition/reasonTag/time.
export type CustomerOrderStatusHistoryRow = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reasonTag: OrderPostponeReasonTag | null;
  createdAt: Date;
};

function fmtDateTime(d: Date): string {
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function OrderStatusHistorySection({
  entries,
}: {
  entries: CustomerOrderStatusHistoryRow[];
}) {
  if (!entries.length) return null;
  return (
    <div>
      <h2 className="font-semibold text-[var(--oc-ink2)] text-sm mb-2">
        Төлвийн түүх
      </h2>
      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5">
        <ol className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3">
              <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--oc-accent)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap text-sm text-[var(--oc-ink2)]">
                  {entry.fromStatus ? (
                    <>
                      <span>{ORDER_STATUS_LABEL[entry.fromStatus]}</span>
                      <span className="text-[var(--oc-muted3)]">→</span>
                    </>
                  ) : null}
                  <span className="font-medium">
                    {ORDER_STATUS_LABEL[entry.toStatus]}
                  </span>
                </div>
                {entry.reasonTag ? (
                  <span className="text-xs text-[var(--oc-muted2)]">
                    {ORDER_POSTPONE_REASON_TAG_LABEL[entry.reasonTag]}
                  </span>
                ) : null}
                <div className="text-xs text-[var(--oc-muted3)] tabular-nums mt-0.5">
                  {fmtDateTime(entry.createdAt)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
