"use client";

import { useState } from "react";
import { changeOrderPaymentStatusAction } from "@/app/_actions/orders";
import type { PaymentStatus } from "@/lib/orders";

/* Идэвхтэй статусын товч тод "сонгогдсон" (✓, өнгөт), бусад нь сул нейтрал
   төлөвт — аль нь одоогийн статус, аль нь үйлдэл болох нь ялгарна. */
function segCls(active: boolean, color: "emerald" | "amber" | "red"): string {
  const base =
    "w-full text-sm font-medium px-3 py-2 rounded-xl transition-colors border";
  if (!active) {
    return `${base} bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.06]`;
  }
  const activeMap = {
    emerald:
      "bg-emerald-500/25 border-emerald-400/50 text-emerald-200 light:bg-emerald-100 light:text-emerald-800",
    amber:
      "bg-amber-500/25 border-amber-400/50 text-amber-200 light:bg-amber-100 light:text-amber-800",
    red: "bg-red-500/25 border-red-400/50 text-red-200 light:bg-red-100 light:text-red-800",
  } as const;
  return `${base} ${activeMap[color]} cursor-default`;
}

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
            className={segCls(paymentStatus === "PAID", "emerald")}
          >
            {paymentStatus === "PAID" ? "✓ " : ""}Төлөгдсөн
          </button>
        </form>
        <button
          type="button"
          onClick={() => setShowPartial((v) => !v)}
          className={`flex-1 ${segCls(
            paymentStatus === "PARTIAL" || showPartial,
            "amber",
          )} ${paymentStatus === "PARTIAL" ? "" : "cursor-pointer"}`}
        >
          {paymentStatus === "PARTIAL" ? "✓ " : ""}Хагас
        </button>
        <form action={changeOrderPaymentStatusAction} className="flex-1">
          <input type="hidden" name="id" value={orderId} />
          <input type="hidden" name="paymentStatus" value="UNPAID" />
          <button
            type="submit"
            disabled={paymentStatus === "UNPAID"}
            className={segCls(paymentStatus === "UNPAID", "red")}
          >
            {paymentStatus === "UNPAID" ? "✓ " : ""}Төлөгдөөгүй
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
