"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  type OrderActionState,
  changeOrderStatusAction,
  reviseExpectedFinishAction,
} from "@/app/_actions/orders";
import { ConfirmForm } from "@/app/_components/confirm-form";
import { DatePicker } from "@/app/_components/date-picker";
import { useToast } from "@/app/_components/toast";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";

const STATUS_BTN_STYLE: Record<OrderStatus, string> = {
  SCHEDULED:
    "bg-[var(--oc-warn)]/20 hover:bg-[var(--oc-warn)]/30 text-[var(--oc-warn)] border border-[var(--oc-warn)]/30",
  IN_PROGRESS:
    "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 light:text-blue-700",
  COMPLETED:
    "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 light:text-emerald-700",
  CANCELLED:
    "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 light:text-red-700",
};

const STATUS_BTN_LABEL: Record<OrderStatus, string> = {
  SCHEDULED: "Товлох",
  IN_PROGRESS: "Эхлүүлэх",
  COMPLETED: "Дуусгах",
  CANCELLED: "Цуцлах",
};

export function StatusControls({
  orderId,
  transitions,
  disabled,
  currentStatus,
  expectedFinishAt,
  estimatedDurationMinutes,
  serviceItemDurationMinutes = null,
  attentionHref,
  workDayCloseAt = null,
}: {
  orderId: string;
  transitions: OrderStatus[];
  disabled: boolean;
  currentStatus: OrderStatus;
  expectedFinishAt: Date | null;
  estimatedDurationMinutes: number | null;
  serviceItemDurationMinutes?: number | null;
  attentionHref?: string;
  // Ажил эхэлсэн өдрийн салбарын ажлын цагийн төгсгөл — "Дуусах хугацаа"-г
  // үүнээс цааш сунгахгүй байхаар DatePicker-т дамжина (сервер талд ч мөн
  // адил хязгаарлана, харах: reviseExpectedFinishAction).
  workDayCloseAt?: Date | null;
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<
    OrderActionState,
    FormData
  >(changeOrderStatusAction, null);
  const [finishState, finishAction, finishPending] = useActionState<
    OrderActionState,
    FormData
  >(reviseExpectedFinishAction, null);
  // Бүх статус шилжилтийн товчийг нэг л "Үйлдэл" товчийн ард нуух —
  // дарахад доор нь гулсаж гарна (grid-template-rows 0fr→1fr trick, өндрийг
  // JS-ээр хэмжихгүйгээр гөлгөр анимацилна).
  const [showActions, setShowActions] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [startHours, setStartHours] = useState("");
  const [startMinutes, setStartMinutes] = useState("");
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
  const [finishConflictIsPossible, setFinishConflictIsPossible] = useState(false);

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

  // React-ийн зөвлөдөг "render-ийн үед нөхцөлт setState" загвар (useEffect
  // биш) — амжилттай шилжилтийн дараа "Үйлдэл" жагсаалтыг хаана.
  const [prevState, setPrevState] = useState<OrderActionState>(null);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) setShowActions(false);
  }

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
      setFinishConflictIsPossible(false);
    } else if (finishState?.fieldErrors?.confirmNeeded) {
      setFinishConflict(finishState.message ?? "Хугацаа өөр ажилтай давхцаж байна.");
      setFinishConflictIsPossible(finishState.fieldErrors.conflictKind === "possible");
    } else if (finishState) {
      setFinishConflict(null);
      setFinishConflictIsPossible(false);
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
      <div>
        <button
          type="button"
          onClick={() => setShowActions((v) => !v)}
          aria-expanded={showActions}
          className={`w-full flex items-center justify-center gap-1.5 text-sm font-medium px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${showActions ? "rounded-t-xl rounded-b-none" : "rounded-xl"} ${STATUS_BTN_STYLE[currentStatus]}`}
        >
          {ORDER_STATUS_LABEL[currentStatus]}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-300 ${showActions ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {/* grid-template-rows 0fr→1fr trick — JS-ээр өндөр хэмжихгүйгээр
            гөлгөр "гулсаж гарах/орох" анимаци. Дотор нь давхар wrapper
            (overflow-hidden) заавал хэрэгтэй, эс бөгөөс шилжилтийн явцад
            дотоод контент тайрагдахгүй харагдана. */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            showActions ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div
              className={`flex flex-col gap-2 p-2 rounded-b-xl bg-white/[0.03] border border-t-0 border-[var(--oc-line)] transition-[opacity,transform] duration-300 ease-out ${
                showActions ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
              }`}
            >
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
        ) : next === "IN_PROGRESS" &&
          estimatedDurationMinutes == null &&
          serviceItemDurationMinutes == null ? (
          // Тооцоолол алга бол ажлыг эхлүүлэхийн өмнө ойролцоо үргэлжлэх
          // хугацааг заавал асууна — эс бөгөөс энэ захиалга хугацаагүй ажлын
          // байрыг эзэлж, бага багтаамжтай салбарт бүх цаг захиалгыг хаадаг
          // (server: changeOrderStatusAction-ийн "duration" fieldError).
          <button
            key={next}
            type="button"
            disabled={disabled || pending}
            onClick={() => setConfirmStart(true)}
            className={`w-full text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${STATUS_BTN_STYLE[next]}`}
          >
            {STATUS_BTN_LABEL[next]}
          </button>
        ) : (
          <ConfirmForm
            key={next}
            action={formAction}
            enabled={next === "COMPLETED"}
            message="Энэ засварын хуудсыг дууссан гэж тэмдэглэх үү? Энэ үйлдлийг буцаах боломжгүй."
          >
            <input type="hidden" name="id" value={orderId} />
            <input type="hidden" name="status" value={next} />
            <button
              type="submit"
              disabled={disabled || pending}
              className={`w-full text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${STATUS_BTN_STYLE[next]}`}
            >
              {STATUS_BTN_LABEL[next]}
            </button>
          </ConfirmForm>
        ),
            )}
            </div>
          </div>
        </div>
      </div>

      {currentStatus === "IN_PROGRESS" ? (
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
                  setFinishConflictIsPossible(false);
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
                max={workDayCloseAt ? toDatetimeLocalValue(workDayCloseAt).slice(0, 10) : undefined}
                maxTime={workDayCloseAt ? toDatetimeLocalValue(workDayCloseAt).slice(11) : undefined}
                onChange={(v) => {
                  setFinishValue(v);
                  setFinishConflict(null);
                  setFinishConflictIsPossible(false);
                }}
              />
              {workDayCloseAt ? (
                <p className="text-[11px] text-[var(--oc-muted3)]">
                  Тухайн өдрийн ажлын цагийн төгсгөлөөс ({formatDateTime(workDayCloseAt).slice(-8, -3)}) хэтрэхгүй байх ёстой.
                </p>
              ) : null}
              {finishConflict ? (
                <div className="space-y-1">
                  <p className="text-xs text-[var(--oc-warn)]">
                    {finishConflict}
                  </p>
                  {finishConflictIsPossible && attentionHref ? (
                    <Link
                      href={attentionHref}
                      className="inline-block text-xs text-[var(--oc-warn)] underline underline-offset-2 hover:opacity-80"
                    >
                      Хоцорсон ажлуудыг шалгах →
                    </Link>
                  ) : null}
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={finishPending}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60 ${
                    finishConflict ? "bg-[var(--oc-warn)]" : "bg-[var(--oc-accent)]"
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
                    setFinishConflictIsPossible(false);
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


      {confirmStart && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Хаах"
                onClick={() => setConfirmStart(false)}
                className="fixed inset-0 z-[100] cursor-default bg-black/60"
              />
              <div
                role="alertdialog"
                aria-modal="true"
                className="fixed left-1/2 top-1/2 z-[110] w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[var(--surface)] p-5 shadow-2xl backdrop-blur-xl"
              >
                <div className="min-w-0">
                  <h3 className="font-semibold text-white">
                    Ойролцоо үргэлжлэх хугацаа
                  </h3>
                  <p className="mt-1 text-sm text-white/50">
                    Энэ захиалгад хугацааны тооцоолол алга байна. Ажлын байрны
                    эзэмшлийг зөв тооцоолохын тулд ажлыг эхлүүлэхийн өмнө
                    ойролцоо хугацааг оруулна уу.
                  </p>
                </div>
                <form action={formAction} className="mt-4 flex flex-col gap-2">
                  <input type="hidden" name="id" value={orderId} />
                  <input type="hidden" name="status" value="IN_PROGRESS" />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="durationHours"
                      min={0}
                      placeholder="Цаг"
                      value={startHours}
                      onChange={(e) => setStartHours(e.target.value)}
                      className="w-20 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white outline-none focus:border-[var(--oc-accent)]/60"
                    />
                    <span className="text-sm text-white/40">ц</span>
                    <input
                      type="number"
                      name="durationMinutes"
                      min={0}
                      max={59}
                      placeholder="Мин"
                      value={startMinutes}
                      onChange={(e) => setStartMinutes(e.target.value)}
                      className="w-20 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white outline-none focus:border-[var(--oc-accent)]/60"
                    />
                    <span className="text-sm text-white/40">мин</span>
                  </div>
                  {state?.fieldErrors?.duration ? (
                    <p className="text-xs text-red-400">{state.fieldErrors.duration}</p>
                  ) : null}
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmStart(false)}
                      disabled={pending}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      Болих
                    </button>
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {pending ? "Эхлүүлж байна..." : "Эхлүүлэх"}
                    </button>
                  </div>
                </form>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
