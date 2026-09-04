"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  refundAppointmentPaymentAction,
  type RefundActionState,
} from "@/app/_actions/booking-revenue";
import { useToast } from "@/app/_components/toast";

export function RefundButton({
  paymentId,
  paymentType,
}: {
  paymentId: string;
  paymentType: string | null;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    RefundActionState,
    FormData
  >(refundAppointmentPaymentAction, null);
  const handled = useRef<RefundActionState>(null);

  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (state.ok) {
      // revalidatePath (action дотор) шинэ өгөгдлийг татаж, эцэг компонент
      // "Буцаагдсан" төлөвт шилжинэ — энэ компонент дагаад unmount болно.
      toast.success("Буцаагдлаа", state.message);
    } else {
      toast.error("Буцаах боломжгүй", state.message);
    }
  }, [state, toast]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-red-300 hover:text-red-200 light:text-red-600 light:hover:text-red-700 underline underline-offset-2"
      >
        Буцаах
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1.5 w-56">
      <input type="hidden" name="paymentId" value={paymentId} />
      <p className="text-[10.5px] text-[var(--oc-muted3)]">
        {paymentType === "CARD"
          ? "QPay-аар автоматаар буцаагдана."
          : "P2P (шилжүүлэг) — QPay API дэмждэггүй тул гараар буцаагаад л энд тэмдэглэнэ."}
      </p>
      <textarea
        name="note"
        required
        rows={2}
        placeholder="Буцаах шалтгаан..."
        className="text-xs px-2 py-1.5 rounded-lg bg-[var(--oc-panel2)] border border-[var(--oc-line)] text-[var(--oc-ink2)] placeholder:text-[var(--oc-muted4)] resize-none focus:outline-none focus:border-red-500/40"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 light:bg-red-100 light:hover:bg-red-200 light:border-red-300 light:text-red-700 transition-colors px-2.5 py-1 rounded-lg font-medium disabled:opacity-60"
        >
          {pending ? "..." : "Баталгаажуулах"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[var(--oc-muted3)] hover:text-[var(--oc-muted)]"
        >
          Цуцлах
        </button>
      </div>
    </form>
  );
}
