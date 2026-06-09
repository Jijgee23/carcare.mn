"use client";

import { useActionState, useState } from "react";
import {
  type AccountAuthState,
  accountLoginAction,
} from "@/app/_actions/account-auth";
import { Field, FormError, SubmitButton } from "@/app/_components/auth-shell";

export function AccountLoginForm() {
  const [state, formAction, pending] = useActionState<AccountAuthState, FormData>(
    accountLoginAction,
    null,
  );
  const awaiting = Boolean(state?.awaitingOtp);
  const fe = state?.fieldErrors ?? {};

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const lockedPhone = state?.phone ?? phone;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {awaiting && state?.message ? (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 text-sm text-violet-200">
          {state.message}
        </div>
      ) : (
        <FormError message={state?.message && !state.ok ? state.message : undefined} />
      )}

      {!awaiting ? (
        <>
          <Field label="Утасны дугаар" htmlFor="phone" error={fe.phone}>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`auth-input ${fe.phone ? "border-red-500/50" : ""}`}
              placeholder="99112233"
            />
          </Field>
          <Field label="Нэр" htmlFor="name" hint="Анх удаа бол — заавал биш">
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
              placeholder="Таны нэр"
            />
          </Field>
          <SubmitButton pending={pending}>Код авах →</SubmitButton>
        </>
      ) : (
        <>
          <input type="hidden" name="phone" value={lockedPhone} />
          <input type="hidden" name="name" value={state?.name ?? name} />
          <Field label="Баталгаажуулах код" htmlFor="otpCode" error={fe.otpCode}>
            <input
              id="otpCode"
              name="otpCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`auth-input text-center text-lg tracking-[0.4em] ${fe.otpCode ? "border-red-500/50" : ""}`}
              placeholder="000000"
            />
          </Field>
          <SubmitButton pending={pending}>Нэвтрэх →</SubmitButton>
          <a
            href="/login"
            className="text-center text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            ← Өөр дугаар оруулах
          </a>
        </>
      )}
    </form>
  );
}
