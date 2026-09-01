"use client";

import { useActionState, useState } from "react";
import {
  type AccountAuthState,
  accountLoginAction,
} from "@/app/_actions/account-auth";
import { Field, FormError, SubmitButton } from "@/app/_components/landing-ops-ui";

export function AccountLoginForm() {
  const [state, formAction, pending] = useActionState<AccountAuthState, FormData>(
    accountLoginAction,
    null,
  );
  const awaiting = Boolean(state?.awaitingOtp);
  const fe = state?.fieldErrors ?? {};

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");

  const lockedPhone = state?.phone ?? phone;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {awaiting && state?.message ? (
        <div className="bg-[var(--oc-accent)]/10 border border-[var(--oc-accent)]/25 rounded-[10px] px-4 py-3 text-sm text-[var(--oc-ink2)]">
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
          <SubmitButton pending={pending}>Код авах →</SubmitButton>
        </>
      ) : (
        <>
          <input type="hidden" name="phone" value={lockedPhone} />
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
            className="text-center text-xs text-[var(--oc-muted3)] hover:text-[var(--oc-accent-hi)] transition-colors"
          >
            ← Өөр дугаар оруулах
          </a>
        </>
      )}
    </form>
  );
}
