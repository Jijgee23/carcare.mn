"use client";

import { useActionState } from "react";
import {
  type TenantActionState,
  updateAppointmentReminderLeadAction,
} from "@/app/_actions/tenant";
import { Field, FormError } from "@/app/_components/auth-shell";
import { Btn } from "@/app/_components/landing-ops-ui";

export function AppointmentReminderForm({
  initialMinutes,
}: {
  initialMinutes: number;
}) {
  const [state, formAction, pending] = useActionState<
    TenantActionState,
    FormData
  >(updateAppointmentReminderLeadAction, null);

  const fe = state?.fieldErrors ?? {};
  const days = Math.floor(initialMinutes / (24 * 60));
  const hours = Math.floor((initialMinutes % (24 * 60)) / 60);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state?.ok && state.message ? (
        <div className="bg-[var(--oc-ok)]/10 border border-[var(--oc-ok)]/25 rounded-lg px-3 py-2 text-sm text-[var(--oc-ok)]">
          {state.message}
        </div>
      ) : null}
      <FormError
        message={state?.message && !state.ok ? state.message : undefined}
      />

      <div className="flex flex-wrap items-end gap-4">
        <Field label="Хоног" htmlFor="leadDays" error={fe.leadDays} className="w-28">
          <input
            id="leadDays"
            name="leadDays"
            type="number"
            inputMode="numeric"
            min={0}
            max={7}
            defaultValue={days}
            className="auth-input h-11 font-plex-mono"
          />
        </Field>
        <Field label="Цаг" htmlFor="leadHours" error={fe.leadHours} className="w-28">
          <input
            id="leadHours"
            name="leadHours"
            type="number"
            inputMode="numeric"
            min={0}
            max={23}
            defaultValue={hours}
            className="auth-input h-11 font-plex-mono"
          />
        </Field>
        <Btn type="submit" disabled={pending} size="md" className="h-11">
          {pending ? "..." : "Хадгалах"}
        </Btn>
      </div>

      <p className="text-xs text-[var(--oc-muted3)] max-w-lg">
        Баталгаажсан цаг захиалгын товлосон цагаас өмнө үйлчлүүлэгчид SMS/мэдэгдлээр
        сануулга илгээнэ. Жишээ нь 1 хоног 6 цаг гэж тохируулбал, цаг захиалгаас
        30 цагийн өмнө сануулна. Анхдагч: 24 цаг.
      </p>
    </form>
  );
}
