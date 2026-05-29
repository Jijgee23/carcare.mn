"use client";

import { useActionState, useState } from "react";
import {
  type QPaySettingsActionState,
  saveQPaySettingsAction,
} from "@/app/_actions/system-qpay";
import {
  Field,
  FormError,
  SubmitButton,
} from "@/app/_components/auth-shell";

type Initial = {
  username: string;
  password: string;
  invoiceCode: string;
  callbackUrl: string;
  tokenExpiresAt: string | null;
};

export function QPaySettingsForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState<
    QPaySettingsActionState,
    FormData
  >(saveQPaySettingsAction, null);
  const fe = state?.fieldErrors ?? {};
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state?.ok && state.message ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-sm text-emerald-300">
          {state.message}
        </div>
      ) : null}
      <FormError
        message={state?.message && !state.ok ? state.message : undefined}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Username" htmlFor="username" error={fe.username}>
          <input
            id="username"
            name="username"
            type="text"
            required
            defaultValue={initial.username}
            className={`auth-input ${fe.username ? "border-red-500/50" : ""}`}
            placeholder="MERCHANT_USER"
          />
        </Field>
        <Field label="Password" htmlFor="password" error={fe.password}>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              defaultValue={initial.password}
              className={`auth-input pr-14 ${fe.password ? "border-red-500/50" : ""}`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs"
            >
              {showPassword ? "Нуух" : "Харах"}
            </button>
          </div>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Invoice code"
          htmlFor="invoiceCode"
          error={fe.invoiceCode}
          hint="QPay-аас өгсөн invoice_code"
        >
          <input
            id="invoiceCode"
            name="invoiceCode"
            type="text"
            required
            defaultValue={initial.invoiceCode}
            className={`auth-input ${fe.invoiceCode ? "border-red-500/50" : ""}`}
            placeholder="MERCHANT_INVOICE"
          />
        </Field>
        <Field
          label="Callback URL"
          htmlFor="callbackUrl"
          hint="заавал биш — Webhook ашиглах бол"
        >
          <input
            id="callbackUrl"
            name="callbackUrl"
            type="url"
            defaultValue={initial.callbackUrl}
            className="auth-input"
            placeholder="https://carcare.mn/api/qpay/callback"
          />
        </Field>
      </div>

      {initial.tokenExpiresAt ? (
        <p className="text-xs text-white/40">
          Сүүлд токен дуусах:{" "}
          {new Date(initial.tokenExpiresAt).toLocaleString("mn-MN")}
        </p>
      ) : (
        <p className="text-xs text-white/40">
          Токен авагдаагүй — анхны invoice үүсэхэд автоматаар авна.
        </p>
      )}

      <SubmitButton pending={pending}>Хадгалах</SubmitButton>
    </form>
  );
}
