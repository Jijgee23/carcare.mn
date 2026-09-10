"use client";

import { useActionState } from "react";
import {
  recordOrderPaymentAction,
  reverseOrderPaymentAction,
  type OrderPaymentActionState,
} from "@/app/_actions/order-payments";
import { Btn } from "@/app/_components/landing-ops-ui";
import {
  ORDER_PAYMENT_METHODS,
  ORDER_PAYMENT_METHOD_BADGE,
  ORDER_PAYMENT_METHOD_LABEL,
  ORDER_PAYMENT_STATUS_LABEL,
  formatTugrik,
} from "@/lib/orders";

// Захиалгын мөрд plain string-ээр дамжина (Decimal/Date биш).
export type OrderPaymentRow = {
  id: string;
  amount: string;
  method: string;
  status: string;
  createdAt: string; // ISO
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// order-items.tsx-тэй адил шалтгаанаар Intl.toLocaleString("mn-MN")
// ашиглахгүй (client/server ICU ялгаатай бол hydration mismatch).
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Гараар бүртгэх сонголтоос QPay-г хасав — QPay төлбөр амжилттай болмогц
// QPayWidget-ийн урсгал (createOrderQPayInvoiceAction/checkOrderQPayPaymentAction)
// аль хэдийн QPAY төрөлтэй OrderPayment мөрийг автоматаар үүсгэж/PAID болгодог.
const MANUAL_PAYMENT_METHODS = ORDER_PAYMENT_METHODS.filter((m) => m !== "QPAY");

export function OrderPaymentsList({
  orderId,
  payments,
  remaining,
  canRecord,
  canReverse,
}: {
  orderId: string;
  payments: OrderPaymentRow[];
  remaining: string;
  canRecord: boolean;
  canReverse: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    OrderPaymentActionState,
    FormData
  >(recordOrderPaymentAction, null);

  const remainingNum = Number.parseFloat(remaining);
  const hasRemaining = Number.isFinite(remainingNum) && remainingNum > 0;

  return (
    <div className="flex flex-col gap-3">
      {payments.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {payments.map((p) => (
            <li
              key={p.id}
              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${p.status === "CANCELLED"
                ? "border-[var(--oc-line)] opacity-50"
                : "border-[var(--oc-line)] bg-[var(--oc-panel2)]"
                }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`shrink-0 font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full ${ORDER_PAYMENT_METHOD_BADGE[p.method] ?? ORDER_PAYMENT_METHOD_BADGE.OTHER
                    }`}
                >
                  {ORDER_PAYMENT_METHOD_LABEL[p.method] ?? p.method}
                </span>
                <span
                  className={`font-plex-mono font-semibold tabular-nums ${p.status === "CANCELLED" ? "line-through" : "text-[var(--oc-ink2)]"}`}
                >
                  {formatTugrik(p.amount)}
                </span>
                <span className="shrink-0 text-[var(--oc-muted4)] whitespace-nowrap">
                  {fmtDateTime(p.createdAt)}
                </span>
                {p.status === "CANCELLED" ? (
                  <span className="shrink-0 text-[var(--oc-muted4)]">
                    · {ORDER_PAYMENT_STATUS_LABEL.CANCELLED}
                  </span>
                ) : null}
              </div>
              {canReverse && p.status === "PAID" ? (
                <form action={reverseOrderPaymentAction}>
                  <input type="hidden" name="paymentId" value={p.id} />
                  <button
                    type="submit"
                    title="Бүртгэлийг цуцлах"
                    className="shrink-0 text-[var(--oc-muted4)] hover:text-red-400 light:hover:text-red-600 transition-colors"
                  >
                    Цуцлах
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {canRecord && hasRemaining ? (
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="orderId" value={orderId} />
          {state?.message ? (
            <p className="text-xs text-red-400 light:text-red-600">{state.message}</p>
          ) : null}
          <div className="flex gap-2">
            <select
              name="method"
              defaultValue="CASH"
              className="compact-input flex-1"
            >
              {MANUAL_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {ORDER_PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="decimal"
              name="amount"
              required
              placeholder={`0 / ${remaining}`}
              className="compact-input flex-1"
            />
          </div>
          <Btn type="submit" size="md" disabled={pending}>
            {pending ? "Бүртгэж..." : "Төлбөр бүртгэх"}
          </Btn>
        </form>
      ) : null}
    </div>
  );
}
