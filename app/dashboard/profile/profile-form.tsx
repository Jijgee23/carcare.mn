"use client";

import { useActionState } from "react";
import {
  type ProfileActionState,
  updateProfileAction,
} from "@/app/_actions/profile";
import { Field, FormError } from "@/app/_components/auth-shell";

type Initial = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

const FIELD_MW = "max-w-xs";

export function ProfileForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState<
    ProfileActionState,
    FormData
  >(updateProfileAction, null);

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
        <Field label="Овог" htmlFor="lastName" error={fe.lastName} className={FIELD_MW}>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            defaultValue={initial.lastName}
            className={`compact-input ${fe.lastName ? "border-red-500/50" : ""}`}
          />
        </Field>
        <Field label="Нэр" htmlFor="firstName" error={fe.firstName} className={FIELD_MW}>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            defaultValue={initial.firstName}
            className={`compact-input ${fe.firstName ? "border-red-500/50" : ""}`}
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
        <Field label="Утас" htmlFor="phone" error={fe.phone} className={FIELD_MW}>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            maxLength={8}
            pattern="[0-9]{8}"
            required
            defaultValue={initial.phone}
            className={`compact-input ${fe.phone ? "border-red-500/50" : ""}`}
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
