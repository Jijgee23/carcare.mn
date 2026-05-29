"use client";

import { useActionState } from "react";
import {
  type TenantActionState,
  updateTenantAction,
} from "@/app/_actions/tenant";
import { Field, FormError } from "@/app/_components/auth-shell";

type Initial = {
  name: string;
  registerNumber: string;
  email: string;
  phone1: string;
  phone2: string | null;
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
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-emerald-300">
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
            className={`compact-input ${fe.name ? "border-red-500/50" : ""}`}
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
            className={`compact-input ${fe.registerNumber ? "border-red-500/50" : ""}`}
          />
        </Field>
        <Field label="Имэйл" htmlFor="email" error={fe.email} className={FIELD_MW}>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={initial.email}
            className={`compact-input ${fe.email ? "border-red-500/50" : ""}`}
          />
        </Field>
        <Field label="Утас 1" htmlFor="phone1" error={fe.phone1} className={FIELD_MW}>
          <input
            id="phone1"
            name="phone1"
            type="tel"
            required
            defaultValue={initial.phone1}
            className={`compact-input ${fe.phone1 ? "border-red-500/50" : ""}`}
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
            defaultValue={initial.phone2 ?? ""}
            className="compact-input"
          />
        </Field>
      </div>

      <div className="flex pt-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all px-6 py-2 rounded-lg font-medium text-sm"
        >
          {pending ? "..." : "Хадгалах"}
        </button>
      </div>
    </form>
  );
}
