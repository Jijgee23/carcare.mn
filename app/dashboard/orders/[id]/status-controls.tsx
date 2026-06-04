"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type OrderActionState,
  changeOrderStatusAction,
} from "@/app/_actions/orders";
import { useToast } from "@/app/_components/toast";
import type { OrderStatus } from "@/lib/orders";

const STATUS_BTN_STYLE: Record<OrderStatus, string> = {
  SCHEDULED:
    "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30",
  IN_PROGRESS:
    "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30",
  WAITING_PARTS:
    "bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30",
  COMPLETED:
    "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30",
  CANCELLED:
    "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30",
};

const STATUS_BTN_LABEL: Record<OrderStatus, string> = {
  SCHEDULED: "Товлох",
  IN_PROGRESS: "Эхлүүлэх",
  WAITING_PARTS: "Сэлбэг хүлээх",
  COMPLETED: "Дуусгах",
  CANCELLED: "Цуцлах",
};

export function StatusControls({
  orderId,
  transitions,
  disabled,
}: {
  orderId: string;
  transitions: OrderStatus[];
  disabled: boolean;
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<
    OrderActionState,
    FormData
  >(changeOrderStatusAction, null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Үр дүнг toast-аар харуулна (нэг үр дүнг давхар харуулахгүй).
  const handled = useRef<OrderActionState>(null);
  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    // Цуцлах амжилттай бол захиалга эцсийн төлөвт орох тул энэ компонент өөрөө
    // unmount болж диалог хаагдана — тусдаа хаах шаардлагагүй.
    if (state.ok) toast.success(state.message ?? "Статус шинэчлэгдлээ.");
    else toast.error(state.message ?? "Алдаа гарлаа.");
  }, [state, toast]);

  return (
    <div className="flex flex-col gap-2">
      {transitions.map((next) =>
        // Цуцлах нь буцаах боломжгүй тул эхлээд диалогоор баталгаажуулна.
        next === "CANCELLED" ? (
          <button
            key={next}
            type="button"
            disabled={disabled || pending}
            onClick={() => setConfirmCancel(true)}
            className={`w-full text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${STATUS_BTN_STYLE[next]}`}
          >
            {STATUS_BTN_LABEL[next]}
          </button>
        ) : (
          <form key={next} action={formAction}>
            <input type="hidden" name="id" value={orderId} />
            <input type="hidden" name="status" value={next} />
            <button
              type="submit"
              disabled={disabled || pending}
              className={`w-full text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${STATUS_BTN_STYLE[next]}`}
            >
              {STATUS_BTN_LABEL[next]}
            </button>
          </form>
        ),
      )}

      {confirmCancel && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Хаах"
                onClick={() => setConfirmCancel(false)}
                className="fixed inset-0 z-[100] cursor-default bg-black/60"
              />
              <div
                role="alertdialog"
                aria-modal="true"
                className="fixed left-1/2 top-1/2 z-[110] w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#14141f]/95 p-5 shadow-2xl backdrop-blur-xl"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-300">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <path d="M12 9v4M12 17h.01" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white">Захиалга цуцлах уу?</h3>
                    <p className="mt-1 text-sm text-white/50">
                      Энэ үйлдлийг буцаах боломжгүй. Захиалгыг цуцлахдаа итгэлтэй
                      байна уу?
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    disabled={pending}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    Болих
                  </button>
                  <form action={formAction}>
                    <input type="hidden" name="id" value={orderId} />
                    <input type="hidden" name="status" value="CANCELLED" />
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {pending ? "Цуцалж байна..." : "Тийм, цуцлах"}
                    </button>
                  </form>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
