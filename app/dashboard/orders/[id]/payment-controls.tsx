"use client";

import { useState } from "react";
import { changeOrderPaymentStatusAction } from "@/app/_actions/orders";
import type { PaymentStatus } from "@/lib/orders";

export function PaymentControls({
  orderId,
  paymentStatus,
  totalAmount,
}: {
  orderId: string;
  paymentStatus: PaymentStatus;
  totalAmount: string;
}) {
  const [showPartial, setShowPartial] = useState(paymentStatus === "PARTIAL");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        <form action={changeOrderPaymentStatusAction} className="flex-1">
          <input type="hidden" name="id" value={orderId} />
          <input type="hidden" name="paymentStatus" value="PAID" />
          <button
            type="submit"
            disabled={paymentStatus === "PAID"}
            className="w-full text-sm font-medium px-3 py-2 rounded-xl transition-colors bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Төлөгдсөн
          </button>
        </form>
        <button
          type="button"
          onClick={() => setShowPartial((v) => !v)}
          className={`flex-1 text-sm font-medium px-3 py-2 rounded-xl transition-colors border ${
            showPartial || paymentStatus === "PARTIAL"
              ? "bg-amber-500/20 text-amber-200 border-amber-500/40"
              : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/25"
          }`}
        >
          Хагас
        </button>
        <form action={changeOrderPaymentStatusAction} className="flex-1">
          <input type="hidden" name="id" value={orderId} />
          <input type="hidden" name="paymentStatus" value="UNPAID" />
          <button
            type="submit"
            disabled={paymentStatus === "UNPAID"}
            className="w-full text-sm font-medium px-3 py-2 rounded-xl transition-colors bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Төлөгдөөгүй
          </button>
        </form>
      </div>

      {showPartial ? (
        <form
          action={changeOrderPaymentStatusAction}
          className="flex gap-2 mt-1"
        >
          <input type="hidden" name="id" value={orderId} />
          <input type="hidden" name="paymentStatus" value="PARTIAL" />
          <input
            type="text"
            inputMode="decimal"
            name="paidAmount"
            required
            placeholder={`0 / ${totalAmount}`}
            className="compact-input flex-1 text-sm"
          />
          <button
            type="submit"
            className="text-sm font-medium px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 transition-colors"
          >
            Хадгалах
          </button>
        </form>
      ) : null}
    </div>
  );
}
