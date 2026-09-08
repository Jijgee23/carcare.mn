"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type OrderActionState,
  changeOrderStatusAction,
  reviseExpectedFinishAction,
  setOrderCapacityAction,
} from "@/app/_actions/orders";
import { DatePicker } from "@/app/_components/date-picker";
import { useToast } from "@/app/_components/toast";
import type { OrderStatus } from "@/lib/orders";

const STATUS_BTN_STYLE: Record<OrderStatus, string> = {
  SCHEDULED:
    "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 light:text-amber-700",
  IN_PROGRESS:
    "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 light:text-blue-700",
  WAITING_PARTS:
    "bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 light:text-purple-700",
  COMPLETED:
    "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 light:text-emerald-700",
  CANCELLED:
    "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 light:text-red-700",
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
  currentStatus,
  occupiesCapacity,
  expectedFinishAt,
}: {
  orderId: string;
  transitions: OrderStatus[];
  disabled: boolean;
  currentStatus: OrderStatus;
  occupiesCapacity: boolean | null;
  expectedFinishAt: Date | null;
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<
    OrderActionState,
    FormData
  >(changeOrderStatusAction, null);
  const [capacityState, capacityAction, capacityPending] = useActionState<
    OrderActionState,
    FormData
  >(setOrderCapacityAction, null);
  const [finishState, finishAction, finishPending] = useActionState<
    OrderActionState,
    FormData
  >(reviseExpectedFinishAction, null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmWaitingParts, setConfirmWaitingParts] = useState(false);
  const [editingFinish, setEditingFinish] = useState(false);
  // Controlled оруулга — React 19 form action дуусахад uncontrolled
  // (defaultValue) талбарыг анхны утга руу автоматаар "reset" хийдэг тул
  // (native form submit-ийн ердийн зан), давхцлын анхааруулга гарахад
  // ажилтны бичсэн шинэ утга алга болдог байсан. Controlled болгосноор React
  // өөрөө утгыг удирдана — reset-д алдагдахгүй.
  const [finishValue, setFinishValue] = useState("");
  // Бай/лифтийн загваргүй тул давхцал зөвхөн анхааруулга — хатуу хориглолгүй
  // (харах: reviseExpectedFinishAction). Давхцал илэрвэл энд мессежийг
  // хадгалж, дараагийн "Хадгалах" дарахад confirmed=true явуулна.
  const [finishConflict, setFinishConflict] = useState<string | null>(null);

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

  const handledCapacity = useRef<OrderActionState>(null);
  useEffect(() => {
    if (!capacityState || capacityState === handledCapacity.current) return;
    handledCapacity.current = capacityState;
    if (capacityState.ok) toast.success(capacityState.message ?? "Амжилттай.");
    else toast.error(capacityState.message ?? "Алдаа гарлаа.");
  }, [capacityState, toast]);

  const handledFinish = useRef<OrderActionState>(null);
  useEffect(() => {
    if (!finishState || finishState === handledFinish.current) return;
    handledFinish.current = finishState;
    if (finishState.ok) toast.success(finishState.message ?? "Амжилттай.");
    else if (!finishState.fieldErrors?.confirmNeeded) {
      // Давхцлын анхааруулгыг toast биш, тасралтгүй харагдах текстээр
      // (доор) харуулна — тул энд түүнийг toast-оор давхар үзүүлэхгүй.
      toast.error(finishState.message ?? "Алдаа гарлаа.");
    }
  }, [finishState, toast]);

  // React-ийн зөвлөдөг "render-ийн үед нөхцөлт setState" загвар (useEffect
  // биш) — сервэрийн шинэ хариу ирэхэд диалог хаах/анхааруулга харуулах
  // байдлыг синхрончилно. Гар аргаар дараагийн санал асуулгад confirmed=true
  // явуулахын тулд (харах: reviseExpectedFinishAction) анхааруулгыг энд
  // тогтвортой хадгална, харин цаг өөрчлөгдмөгц (input onChange) арилна.
  const [prevFinishState, setPrevFinishState] = useState<OrderActionState>(null);
  if (finishState !== prevFinishState) {
    setPrevFinishState(finishState);
    if (finishState?.ok) {
      setEditingFinish(false);
      setFinishConflict(null);
    } else if (finishState?.fieldErrors?.confirmNeeded) {
      setFinishConflict(finishState.message ?? "Хугацаа өөр ажилтай давхцаж байна.");
    } else if (finishState) {
      setFinishConflict(null);
    }
  }

  // datetime-local input-д зориулж локал цагийн бүсээр (offset-гүй) хөрвүүлнэ.
  function toDatetimeLocalValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Server/client ICU locale-ийн ялгаанаас hydration mismatch гарахаас
  // сэргийлж toLocaleString ашиглахгүй — гараар, тогтмол форматална.
  function formatDateTime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

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
        ) : next === "WAITING_PARTS" ? (
          // Ажлын байрыг хэвээр эзэлж байгаа эсэхийг ажилтнаас тодорхой асууна
          // (шууд submit биш) — D-хугацааны шинэ шийдвэр, COWORK.md-г үз.
          <button
            key={next}
            type="button"
            disabled={disabled || pending}
            onClick={() => setConfirmWaitingParts(true)}
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

      {currentStatus === "WAITING_PARTS" ? (
        <form action={capacityAction}>
          <input type="hidden" name="id" value={orderId} />
          <input
            type="hidden"
            name="occupiesCapacity"
            value={occupiesCapacity ? "false" : "true"}
          />
          <button
            type="submit"
            disabled={disabled || capacityPending}
            className="w-full text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white/[0.04] hover:bg-white/[0.08] text-[var(--oc-ink2)] border border-[var(--oc-line)]"
          >
            {capacityPending
              ? "Хадгалж байна..."
              : occupiesCapacity
                ? "Ажлын байрыг суллах"
                : "Ажлын байрыг сэргээх"}
          </button>
        </form>
      ) : null}

      {currentStatus === "IN_PROGRESS" || currentStatus === "WAITING_PARTS" ? (
        <div className="rounded-xl border border-[var(--oc-line)] bg-white/[0.02] p-3">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs text-[var(--oc-muted3)]">Дуусах хугацаа</span>
            {!editingFinish ? (
              <button
                type="button"
                onClick={() => {
                  setFinishValue(
                    expectedFinishAt ? toDatetimeLocalValue(expectedFinishAt) : "",
                  );
                  setFinishConflict(null);
                  setEditingFinish(true);
                }}
                disabled={disabled}
                className="font-plex-mono text-[11px] font-medium px-2.5 py-1 rounded-full border border-[var(--oc-accent)]/40 bg-[var(--oc-accent)]/10 text-[var(--oc-accent)] hover:bg-[var(--oc-accent)]/20 hover:border-[var(--oc-accent)]/60 transition-colors disabled:opacity-50"
              >
                Засах
              </button>
            ) : null}
          </div>
          {!editingFinish ? (
            <div className="text-sm text-[var(--oc-ink2)]">
              {expectedFinishAt ? formatDateTime(expectedFinishAt) : "—"}
            </div>
          ) : (
            <form action={finishAction} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={orderId} />
              <input
                type="hidden"
                name="confirmed"
                value={finishConflict ? "true" : ""}
              />
              <DatePicker
                name="expectedFinishAt"
                withTime
                value={finishValue}
                onChange={(v) => {
                  setFinishValue(v);
                  setFinishConflict(null);
                }}
              />
              {finishConflict ? (
                <p className="text-xs text-amber-400 light:text-amber-700">
                  {finishConflict}
                </p>
              ) : null}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={finishPending}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60 ${
                    finishConflict ? "bg-amber-600" : "bg-[var(--oc-accent)]"
                  }`}
                >
                  {finishPending
                    ? "Хадгалж байна..."
                    : finishConflict
                      ? "Тийм, хадгалах"
                      : "Хадгалах"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingFinish(false);
                    setFinishConflict(null);
                  }}
                  className="rounded-lg border border-[var(--oc-line)] bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--oc-ink2)] hover:bg-white/[0.08]"
                >
                  Болих
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}

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
                className="fixed left-1/2 top-1/2 z-[110] w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[var(--surface)] p-5 shadow-2xl backdrop-blur-xl"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-300 light:text-red-700">
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
                    <h3 className="font-semibold text-white">Засварын хуудас цуцлах уу?</h3>
                    <p className="mt-1 text-sm text-white/50">
                      Энэ үйлдлийг буцаах боломжгүй. Засварын хуудсыг цуцлахдаа итгэлтэй
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

      {confirmWaitingParts && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Хаах"
                onClick={() => setConfirmWaitingParts(false)}
                className="fixed inset-0 z-[100] cursor-default bg-black/60"
              />
              <div
                role="alertdialog"
                aria-modal="true"
                className="fixed left-1/2 top-1/2 z-[110] w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[var(--surface)] p-5 shadow-2xl backdrop-blur-xl"
              >
                <div className="min-w-0">
                  <h3 className="font-semibold text-white">
                    Ажлын байрыг хэвээр эзэлж байна уу?
                  </h3>
                  <p className="mt-1 text-sm text-white/50">
                    Сэлбэг хүлээж байх хугацаанд машин ажлын байранд байрлаж
                    байвал хэвээр эзэлнэ. Хэрэв машиныг гаргаж, ажлын байрыг
                    сулласан бол &quot;Суллах&quot;-ыг сонго.
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmWaitingParts(false)}
                    disabled={pending}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    Болих
                  </button>
                  <form action={formAction} onSubmit={() => setConfirmWaitingParts(false)}>
                    <input type="hidden" name="id" value={orderId} />
                    <input type="hidden" name="status" value="WAITING_PARTS" />
                    <input type="hidden" name="occupiesCapacity" value="false" />
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.08] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Суллах
                    </button>
                  </form>
                  <form action={formAction} onSubmit={() => setConfirmWaitingParts(false)}>
                    <input type="hidden" name="id" value={orderId} />
                    <input type="hidden" name="status" value="WAITING_PARTS" />
                    <input type="hidden" name="occupiesCapacity" value="true" />
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg bg-purple-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Хэвээр эзэлнэ
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
