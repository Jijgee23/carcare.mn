"use client";

import { useActionState } from "react";
import {
  type TenantActionState,
  updateTenantAction,
} from "@/app/_actions/tenant";
import { Field, FormError } from "@/app/_components/auth-shell";
import { Btn } from "@/app/_components/landing-ops-ui";

type Initial = {
  name: string;
  registerNumber: string;
  email: string;
  phone1: string;
  phone2: string | null;
  acceptsOnlineBooking: boolean;
};

const FIELD_MW = "max-w-xs";

export function TenantForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState<
    TenantActionState,
    FormData
  >(updateTenantAction, null);

  const fe = state?.fieldErrors ?? {};

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

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Field label="Байгууллагын нэр" htmlFor="name" error={fe.name} className={FIELD_MW}>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={initial.name}
            className={`auth-input ${fe.name ? "border-red-500/50" : ""}`}
          />
        </Field>
        <Field
          label="Регистр"
          htmlFor="registerNumber"
          hint="7 оронтой тоо"
          error={fe.registerNumber}
          className={FIELD_MW}
        >
          <input
            id="registerNumber"
            name="registerNumber"
            type="text"
            inputMode="numeric"
            pattern="\d{7}"
            maxLength={7}
            required
            defaultValue={initial.registerNumber}
            className={`auth-input font-plex-mono ${fe.registerNumber ? "border-red-500/50" : ""}`}
          />
        </Field>
        <Field label="Имэйл" htmlFor="email" error={fe.email} className={FIELD_MW}>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={initial.email}
            className={`auth-input ${fe.email ? "border-red-500/50" : ""}`}
          />
        </Field>
        <Field label="Утас 1" htmlFor="phone1" error={fe.phone1} className={FIELD_MW}>
          <input
            id="phone1"
            name="phone1"
            type="tel"
            inputMode="numeric"
            maxLength={8}
            pattern="[0-9]{8}"
            required
            defaultValue={initial.phone1}
            className={`auth-input font-plex-mono ${fe.phone1 ? "border-red-500/50" : ""}`}
          />
        </Field>
        <Field
          label="Утас 2"
          htmlFor="phone2"
          hint="заавал биш"
          error={fe.phone2}
          className={FIELD_MW}
        >
          <input
            id="phone2"
            name="phone2"
            type="tel"
            inputMode="numeric"
            maxLength={8}
            pattern="[0-9]{8}"
            defaultValue={initial.phone2 ?? ""}
            className="auth-input font-plex-mono"
          />
        </Field>
      </div>

      <label className="flex items-start gap-3 p-3.5 rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel2)] cursor-pointer hover:border-[var(--oc-line2)] max-w-md">
        <input
          type="checkbox"
          name="acceptsOnlineBooking"
          defaultChecked={initial.acceptsOnlineBooking}
          className="mt-0.5 h-4 w-4 accent-[var(--oc-accent)]"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-[var(--oc-ink2)]">
            Онлайн цаг захиалга хүлээн авах
          </span>
          <span className="text-xs text-[var(--oc-muted3)]">
            Идэвхжүүлбэл байгууллага хэрэглэгчийн вэб дэх каталог
            (/discover)-т харагдаж, үйлчлүүлэгчид онлайнаар цаг захиална.
          </span>
        </span>
      </label>

      <div className="flex pt-2">
        <Btn type="submit" disabled={pending}>
          {pending ? "..." : "Хадгалах"}
        </Btn>
      </div>
    </form>
  );
}
