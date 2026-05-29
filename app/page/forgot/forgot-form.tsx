"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  type ForgotPasswordState,
  requestPasswordResetAction,
  resetPasswordAction,
} from "@/app/_actions/auth";
import {
  Field,
  FormError,
  SubmitButton,
} from "@/app/_components/auth-shell";

export function ForgotPasswordForm() {
  const [requestState, requestAction, requestPending] = useActionState<
    ForgotPasswordState,
    FormData
  >(requestPasswordResetAction, null);
  const [resetState, resetAction, resetPending] = useActionState<
    ForgotPasswordState,
    FormData
  >(resetPasswordAction, null);

  // OTP илгээгдсэний дараа verify state-руу шилжинэ. resetState.ok үед — амжилтын мессеж + login руу зурвас.
  const onVerifyStep =
    Boolean(requestState?.ok) && requestState?.step === "verify";
  const finished = Boolean(resetState?.ok && resetState.step === "verify");
  const email = resetState?.email ?? requestState?.email ?? "";
  const maskedPhone = requestState?.maskedPhone ?? "";

  if (finished) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-300">
          {resetState?.message ?? "Нууц үг шинэчлэгдлээ."}
        </div>
        <Link
          href="/page/login"
          className="text-sm font-medium text-violet-300 hover:text-violet-200"
        >
          Нэвтрэх хуудас руу буцах →
        </Link>
      </div>
    );
  }

  return onVerifyStep ? (
    <VerifyStep
      email={email}
      maskedPhone={maskedPhone}
      state={resetState}
      formAction={resetAction}
      pending={resetPending}
      requestSuccessMessage={requestState?.message}
    />
  ) : (
    <RequestStep
      state={requestState}
      formAction={requestAction}
      pending={requestPending}
    />
  );
}

function RequestStep({
  state,
  formAction,
  pending,
}: {
  state: ForgotPasswordState;
  formAction: (fd: FormData) => void;
  pending: boolean;
}) {
  const fe = state?.fieldErrors ?? {};
  const [email, setEmail] = useState(state?.email ?? "");
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormError message={!state?.ok ? state?.message : undefined} />

      <Field label="Имэйл" htmlFor="forgot-email" error={fe.email}>
        <input
          id="forgot-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`auth-input ${fe.email ? "border-red-500/50" : ""}`}
          placeholder="you@example.com"
        />
      </Field>

      <SubmitButton pending={pending}>Код илгээх</SubmitButton>
    </form>
  );
}

function VerifyStep({
  email,
  maskedPhone,
  state,
  formAction,
  pending,
  requestSuccessMessage,
}: {
  email: string;
  maskedPhone: string;
  state: ForgotPasswordState;
  formAction: (fd: FormData) => void;
  pending: boolean;
  requestSuccessMessage?: string;
}) {
  const fe = state?.fieldErrors ?? {};
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="email" value={email} />

      <div className="bg-violet-500/10 border border-violet-500/25 rounded-xl px-4 py-3 text-sm text-violet-200">
        {requestSuccessMessage ??
          `Утас ${maskedPhone} руу 6 оронтой код илгээлээ.`}
      </div>

      {!state?.ok && state?.message ? (
        <FormError message={state.message} />
      ) : null}

      <Field
        label="Баталгаажуулах код"
        htmlFor="forgot-code"
        error={fe.code}
        hint="6 оронтой тоо"
      >
        <input
          id="forgot-code"
          name="code"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D+/g, ""))}
          className={`auth-input tracking-[0.5em] text-center font-mono ${fe.code ? "border-red-500/50" : ""}`}
          placeholder="••••••"
        />
      </Field>

      <Field
        label="Шинэ нууц үг"
        htmlFor="forgot-password"
        hint="8+ тэмдэгт"
        error={fe.password}
      >
        <div className="relative">
          <input
            id="forgot-password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`auth-input pr-14 ${fe.password ? "border-red-500/50" : ""}`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs"
          >
            {showPassword ? "Нуух" : "Харах"}
          </button>
        </div>
      </Field>

      <Field
        label="Шинэ нууц үг давтан"
        htmlFor="forgot-password-confirm"
        error={fe.passwordConfirm}
      >
        <input
          id="forgot-password-confirm"
          name="passwordConfirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          className={`auth-input ${fe.passwordConfirm ? "border-red-500/50" : ""}`}
          placeholder="••••••••"
        />
      </Field>

      <SubmitButton pending={pending}>Нууц үг шинэчлэх</SubmitButton>
    </form>
  );
}
