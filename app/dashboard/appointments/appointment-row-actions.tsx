"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  type AppointmentActionState,
  confirmAppointment,
  markAppointmentArrived,
  markAppointmentNoShow,
  rejectAppointment,
  rescheduleAppointmentAction,
} from "@/app/_actions/appointments";
import { DatePicker, todayStr } from "@/app/_components/date-picker";
import { ConfirmForm } from "@/app/_components/confirm-form";
import { Btn } from "@/app/_components/landing-ops-ui";
import { useToast } from "@/app/_components/toast";

// Жагсаалтын мөр дэх "Батлах/Татгалзах/Ирээгүй" товчнууд. Урьд нь эдгээр
// action-ууд `Promise<void>` буцааж, `<form action={fn}>`-аар шууд дуудагддаг
// байсан — permission/branch scope/subscription lock зэрэг хүлээгдэж буй
// алдаа гарахад throw хийж, Next.js-ийн алдааны хуудас руу шидэгддэг байсан
// (хэрэглэгчид "алдаа шидээд гардаггүй" мэт харагддаг). Одоо бусад
// action-уудтай (status-controls.tsx) ижил `{ok,message}` хэлбэрт оруулж,
// toast-аар харуулна — алдаа гарсан ч мөр эвдрэхгүй.
export function AppointmentConfirmReject({
  appointmentId,
  canConfirm = true,
}: {
  appointmentId: string;
  canConfirm?: boolean;
}) {
  const toast = useToast();
  const [confirmState, confirmAction, confirmPending] = useActionState<
    AppointmentActionState,
    FormData
  >(confirmAppointment, null);
  const [rejectState, rejectAction, rejectPending] = useActionState<
    AppointmentActionState,
    FormData
  >(rejectAppointment, null);

  const handledConfirm = useRef<AppointmentActionState>(null);
  useEffect(() => {
    if (!confirmState || confirmState === handledConfirm.current) return;
    handledConfirm.current = confirmState;
    if (confirmState.ok) toast.success(confirmState.message ?? "Амжилттай.");
    else toast.error(confirmState.message ?? "Алдаа гарлаа.");
  }, [confirmState, toast]);

  const handledReject = useRef<AppointmentActionState>(null);
  useEffect(() => {
    if (!rejectState || rejectState === handledReject.current) return;
    handledReject.current = rejectState;
    if (rejectState.ok) toast.success(rejectState.message ?? "Амжилттай.");
    else toast.error(rejectState.message ?? "Алдаа гарлаа.");
  }, [rejectState, toast]);

  const pending = confirmPending || rejectPending;

  return (
    <>
      <form action={confirmAction}>
        <input type="hidden" name="id" value={appointmentId} />
        <button
          type="submit"
          disabled={pending || !canConfirm}
          title={canConfirm ? undefined : "Захиалгын хураамж төлөгдсөний дараа батална."}
          className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 light:bg-emerald-100 light:hover:bg-emerald-200 light:border-emerald-300 light:text-emerald-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {confirmPending
            ? "Батлаж байна..."
            : canConfirm
              ? "Батлах"
              : "Төлбөрийн дараа батална"}
        </button>
      </form>
      <ConfirmForm action={rejectAction} message="Энэ цагийн хүсэлтийг татгалзах уу?">
        <input type="hidden" name="id" value={appointmentId} />
        <button
          type="submit"
          disabled={pending}
          className="text-xs px-3 py-1.5 rounded-lg border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-400 light:text-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {rejectPending ? "Татгалзаж байна..." : "Татгалзах"}
        </button>
      </ConfirmForm>
    </>
  );
}

export function AppointmentArrivedButton({ appointmentId }: { appointmentId: string }) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<
    AppointmentActionState,
    FormData
  >(markAppointmentArrived, null);

  const handled = useRef<AppointmentActionState>(null);
  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (state.ok) toast.success(state.message ?? "Амжилттай.");
    else toast.error(state.message ?? "Алдаа гарлаа.");
  }, [state, toast]);

  return (
    <ConfirmForm action={formAction} message="Энэ цагт үйлчлүүлэгч ирсэн гэж тэмдэглэх үү?">
      <input type="hidden" name="id" value={appointmentId} />
      <Btn type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Тэмдэглэж байна..." : "Ирсэн"}
      </Btn>
    </ConfirmForm>
  );
}

export function AppointmentNoShowButton({ appointmentId }: { appointmentId: string }) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<
    AppointmentActionState,
    FormData
  >(markAppointmentNoShow, null);

  const handled = useRef<AppointmentActionState>(null);
  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (state.ok) toast.success(state.message ?? "Амжилттай.");
    else toast.error(state.message ?? "Алдаа гарлаа.");
  }, [state, toast]);

  return (
    <ConfirmForm action={formAction} message="Энэ цагт үйлчлүүлэгч ирээгүй гэж тэмдэглэх үү?">
      <input type="hidden" name="id" value={appointmentId} />
      <Btn type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Тэмдэглэж байна..." : "Ирээгүй"}
      </Btn>
    </ConfirmForm>
  );
}

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// Баталгаажсан (CONFIRMED) цагийг өөр хугацаанд шилжүүлэх — "ирээгүй" гэж
// тэмдэглэхийн оронд, ирц алдсан цагийг сэргээх боломж. Давхцлын анхааруулга
// (findAppointmentRescheduleConflict) order-ийн RescheduleControl-той ижил
// зарчим: хатуу хориглол биш, дахин "Хадгалах" дарахад confirmed=true явна.
export function AppointmentRescheduleButton({
  appointmentId,
  requestedAt,
}: {
  appointmentId: string;
  requestedAt: string; // ISO
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<
    AppointmentActionState,
    FormData
  >(rescheduleAppointmentAction, null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [confirmArmed, setConfirmArmed] = useState(false);
  const [prevState, setPrevState] = useState<AppointmentActionState>(null);

  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) {
      toast.success(state.message ?? "Амжилттай.");
      setEditing(false);
      setConfirmArmed(false);
    } else if (state?.fieldErrors?.confirmNeeded) {
      setConfirmArmed(true);
    } else if (state) {
      toast.error(state.message ?? "Алдаа гарлаа.");
      setConfirmArmed(false);
    }
  }

  const conflictMessage =
    state && !state.ok && state.fieldErrors?.confirmNeeded ? state.message : null;

  if (!editing) {
    return (
      <Btn
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setValue(toLocalDatetimeInput(requestedAt));
          setConfirmArmed(false);
          setEditing(true);
        }}
      >
        Шилжүүлэх
      </Btn>
    );
  }

  return (
    <ConfirmForm
      action={formAction}
      className="flex w-full flex-wrap items-center gap-2"
      enabled={!confirmArmed}
      message="Энэ цагийн захиалгыг сонгосон шинэ хугацаа руу шилжүүлэх үү?"
    >
      <input type="hidden" name="id" value={appointmentId} />
      <input type="hidden" name="confirmed" value={confirmArmed ? "true" : ""} />
      <DatePicker
        withTime
        min={todayStr()}
        value={value}
        onChange={(v) => {
          setValue(v);
          setConfirmArmed(false);
        }}
        className="w-40"
      />
      <input type="hidden" name="requestedAt" value={value} />
      {conflictMessage ? (
        <span className="text-[11px] text-[var(--oc-warn)] max-w-[180px]">
          {conflictMessage}
        </span>
      ) : null}
      <button
        type="submit"
        disabled={pending || !value}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60 whitespace-nowrap ${
          confirmArmed ? "bg-[var(--oc-warn)]" : "bg-[var(--oc-accent)]"
        }`}
      >
        {pending ? "..." : confirmArmed ? "Тийм, хадгалах" : "Хадгалах"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded-lg border border-[var(--oc-line)] bg-white/[0.04] px-2.5 py-1.5 text-xs text-[var(--oc-ink2)] hover:bg-white/[0.08] whitespace-nowrap"
      >
        Болих
      </button>
    </ConfirmForm>
  );
}
