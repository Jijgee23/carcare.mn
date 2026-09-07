"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  type AppointmentActionState,
  confirmAppointment,
  markAppointmentNoShow,
  rejectAppointment,
} from "@/app/_actions/appointments";
import { Btn } from "@/app/_components/landing-ops-ui";
import { useToast } from "@/app/_components/toast";

// Жагсаалтын мөр дэх "Батлах/Татгалзах/Ирээгүй" товчнууд. Урьд нь эдгээр
// action-ууд `Promise<void>` буцааж, `<form action={fn}>`-аар шууд дуудагддаг
// байсан — permission/branch scope/subscription lock зэрэг хүлээгдэж буй
// алдаа гарахад throw хийж, Next.js-ийн алдааны хуудас руу шидэгддэг байсан
// (хэрэглэгчид "алдаа шидээд гардаггүй" мэт харагддаг). Одоо бусад
// action-уудтай (status-controls.tsx) ижил `{ok,message}` хэлбэрт оруулж,
// toast-аар харуулна — алдаа гарсан ч мөр эвдрэхгүй.
export function AppointmentConfirmReject({ appointmentId }: { appointmentId: string }) {
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
          disabled={pending}
          className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 light:bg-emerald-100 light:hover:bg-emerald-200 light:border-emerald-300 light:text-emerald-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {confirmPending ? "Батлаж байна..." : "Батлах"}
        </button>
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="id" value={appointmentId} />
        <button
          type="submit"
          disabled={pending}
          className="text-xs px-3 py-1.5 rounded-lg border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-400 light:text-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {rejectPending ? "Татгалзаж байна..." : "Татгалзах"}
        </button>
      </form>
    </>
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
    <form action={formAction}>
      <input type="hidden" name="id" value={appointmentId} />
      <Btn type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Тэмдэглэж байна..." : "Ирээгүй"}
      </Btn>
    </form>
  );
}
