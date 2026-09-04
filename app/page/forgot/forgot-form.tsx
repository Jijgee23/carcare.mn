"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import {
  type ForgotPasswordState,
  requestPasswordResetAction,
  resetPasswordAction,
} from "@/app/_actions/auth";
import {
  Field,
  FormError,
  SubmitButton,
} from "@/app/_components/landing-ops-ui";
import { ResendOtpButton } from "@/app/_components/resend-otp-button";

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
        <div className="bg-[var(--oc-ok)]/10 border border-[var(--oc-ok)]/25 rounded-[10px] px-4 py-3 text-sm text-[var(--oc-ink2)]">
          {resetState?.message ?? "Нууц үг шинэчлэгдлээ."}
        </div>
        <Link
          href="/page/login"
          className="text-sm font-medium text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
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
      resendAction={requestAction}
      resendPending={requestPending}
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
  resendAction,
  resendPending,
}: {
  email: string;
  maskedPhone: string;
  state: ForgotPasswordState;
  formAction: (fd: FormData) => void;
  pending: boolean;
  requestSuccessMessage?: string;
  resendAction: (fd: FormData) => void;
  resendPending: boolean;
}) {
  const fe = state?.fieldErrors ?? {};
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="email" value={email} />

      <div className="bg-[var(--oc-accent)]/10 border border-[var(--oc-accent)]/25 rounded-[10px] px-4 py-3 text-sm text-[var(--oc-ink2)]">
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
          className={`auth-input font-plex-mono tracking-[0.5em] text-center ${fe.code ? "border-red-500/50" : ""}`}
          placeholder="••••••"
        />
      </Field>

      <ResendOtpButton
        pending={resendPending}
        onResend={() => {
          setCode("");
          const fd = new FormData();
          fd.set("email", email);
          startTransition(() => resendAction(fd));
        }}
      />

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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--oc-muted3)] hover:text-[var(--oc-muted)] transition-colors text-xs"
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
