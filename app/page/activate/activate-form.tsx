"use client";

import { startTransition, useActionState, useState } from "react";
import {
  type ActivateAccountState,
  activateAccountAction,
  requestActivationAction,
} from "@/app/_actions/auth";
import {
  Field,
  FormError,
  SubmitButton,
} from "@/app/_components/landing-ops-ui";
import { ResendOtpButton } from "@/app/_components/resend-otp-button";

export function ActivateAccountForm() {
  const [requestState, requestAction, requestPending] = useActionState<
    ActivateAccountState,
    FormData
  >(requestActivationAction, null);
  const [activateState, activateAction, activatePending] = useActionState<
    ActivateAccountState,
    FormData
  >(activateAccountAction, null);

  // OTP илгээгдсэний дараа verify state-руу шилжинэ. Амжилттай идэвхжвэл
  // server action /dashboard руу redirect хийдэг тул "finished" state хэрэггүй.
  const onVerifyStep =
    Boolean(requestState?.ok) && requestState?.step === "verify";
  const identifier = activateState?.identifier ?? requestState?.identifier ?? "";
  const maskedPhone = requestState?.maskedPhone ?? "";

  return onVerifyStep ? (
    <VerifyStep
      identifier={identifier}
      maskedPhone={maskedPhone}
      state={activateState}
      formAction={activateAction}
      pending={activatePending}
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
  state: ActivateAccountState;
  formAction: (fd: FormData) => void;
  pending: boolean;
}) {
  const fe = state?.fieldErrors ?? {};
  const [identifier, setIdentifier] = useState(state?.identifier ?? "");
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormError message={!state?.ok ? state?.message : undefined} />

      <Field
        label="Имэйл эсвэл утасны дугаар"
        htmlFor="activate-email"
        error={fe.identifier}
      >
        <input
          id="activate-email"
          name="identifier"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className={`auth-input ${fe.identifier ? "border-red-500/50" : ""}`}
          placeholder="you@example.com эсвэл 99112233"
        />
      </Field>

      <SubmitButton pending={pending}>Код илгээх</SubmitButton>
    </form>
  );
}

function VerifyStep({
  identifier,
  maskedPhone,
  state,
  formAction,
  pending,
  requestSuccessMessage,
  resendAction,
  resendPending,
}: {
  identifier: string;
  maskedPhone: string;
  state: ActivateAccountState;
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
      <input type="hidden" name="identifier" value={identifier} />

      <div className="bg-[var(--oc-accent)]/10 border border-[var(--oc-accent)]/25 rounded-[10px] px-4 py-3 text-sm text-[var(--oc-ink2)]">
        {requestSuccessMessage ??
          `Утас ${maskedPhone} руу 6 оронтой код илгээлээ.`}
      </div>

      {!state?.ok && state?.message ? (
        <FormError message={state.message} />
      ) : null}

      <Field
        label="Баталгаажуулах код"
        htmlFor="activate-code"
        error={fe.code}
        hint="6 оронтой тоо"
      >
        <input
          id="activate-code"
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
          fd.set("identifier", identifier);
          startTransition(() => resendAction(fd));
        }}
      />

      <Field
        label="Нууц үг"
        htmlFor="activate-password"
        hint="8+ тэмдэгт"
        error={fe.password}
      >
        <div className="relative">
          <input
            id="activate-password"
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
        label="Нууц үг давтан"
        htmlFor="activate-password-confirm"
        error={fe.passwordConfirm}
      >
        <input
          id="activate-password-confirm"
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

      <SubmitButton pending={pending}>Нууц үг үүсгэж нэвтрэх</SubmitButton>
    </form>
  );
}
