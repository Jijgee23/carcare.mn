"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  type ActionState,
  type ActivateAccountState,
  type LoginEmailState,
  activateAccountAction,
  checkLoginEmailAction,
  signInAction,
} from "@/app/_actions/auth";
import { Field, FormError, SubmitButton } from "@/app/_components/auth-shell";

/**
 * Нэвтрэх — имэйлээр эхэлсэн (progressive) урсгал:
 *   1) Имэйл оруулна → checkLoginEmailAction
 *   2a) Бүртгэлтэй + идэвхжсэн → нууц үг асууна (signInAction)
 *   2b) Бүртгэлтэй ч нууц үггүй → OTP + шинэ нууц үг (activateAccountAction)
 *   2c) Бүртгэлгүй → мессеж + бүртгүүлэх холбоос
 */
export function LoginForm() {
  const [checkState, checkAction, checkPending] = useActionState<
    LoginEmailState,
    FormData
  >(checkLoginEmailAction, null);

  const status = checkState?.ok ? checkState.status : undefined;
  const email = checkState?.email ?? "";

  if (status === "password") {
    return <PasswordStep email={email} />;
  }
  if (status === "activate") {
    return (
      <ActivateStep
        email={email}
        maskedPhone={checkState?.maskedPhone ?? ""}
        notice={checkState?.message}
      />
    );
  }
  if (status === "not_registered") {
    return <NotRegistered message={checkState?.message} />;
  }
  return (
    <EmailStep state={checkState} formAction={checkAction} pending={checkPending} />
  );
}

// --- 1-р шат: имэйл ---------------------------------------------------------

function EmailStep({
  state,
  formAction,
  pending,
}: {
  state: LoginEmailState;
  formAction: (fd: FormData) => void;
  pending: boolean;
}) {
  const fe = state?.fieldErrors ?? {};
  const [email, setEmail] = useState("");
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Field label="Имэйл хаяг" htmlFor="email" error={fe.email}>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`auth-input ${fe.email ? "border-red-500/50" : ""}`}
          placeholder="you@gmail.com"
        />
      </Field>

      <SubmitButton pending={pending}>Үргэлжлүүлэх →</SubmitButton>

      <div className="text-center">
        <Link
          href="/page/forgot"
          className="text-xs text-violet-300 hover:text-violet-200"
        >
          Нууц үг мартсан уу?
        </Link>
      </div>
    </form>
  );
}

// --- 2a: нууц үгээр нэвтрэх --------------------------------------------------

function PasswordStep({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signInAction,
    null,
  );
  const fe = state?.fieldErrors ?? {};
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="email" value={email} />
      <FormError message={state?.message} />

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-white/70">
        {email}
      </div>

      <Field label="Нууц үг" htmlFor="password" error={fe.password}>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            autoFocus
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

      <SubmitButton pending={pending}>Нэвтрэх →</SubmitButton>

      <div className="flex items-center justify-between gap-3">
        <a
          href="/page/login"
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          ← Өөр имэйл
        </a>
        <Link
          href="/page/forgot"
          className="text-xs text-violet-300 hover:text-violet-200"
        >
          Нууц үг мартсан уу?
        </Link>
      </div>
    </form>
  );
}

// --- 2b: анхны нэвтрэлт — OTP + шинэ нууц үг ---------------------------------

function ActivateStep({
  email,
  maskedPhone,
  notice,
}: {
  email: string;
  maskedPhone: string;
  notice?: string;
}) {
  const [state, formAction, pending] = useActionState<
    ActivateAccountState,
    FormData
  >(activateAccountAction, null);
  const fe = state?.fieldErrors ?? {};
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="email" value={email} />

      <div className="bg-violet-500/10 border border-violet-500/25 rounded-xl px-4 py-3 text-sm text-violet-200">
        Анх удаа нэвтрэх тул нууц үгээ үүсгэнэ үү.{" "}
        {notice ?? `Утас ${maskedPhone} руу 6 оронтой код илгээлээ.`}
      </div>

      {!state?.ok && state?.message ? <FormError message={state.message} /> : null}

      <Field
        label="Баталгаажуулах код"
        htmlFor="code"
        error={fe.code}
        hint="6 оронтой тоо"
      >
        <input
          id="code"
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

      <Field label="Нууц үг" htmlFor="new-password" hint="8+ тэмдэгт" error={fe.password}>
        <div className="relative">
          <input
            id="new-password"
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
        label="Нууц үг давтан"
        htmlFor="new-password-confirm"
        error={fe.passwordConfirm}
      >
        <input
          id="new-password-confirm"
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

      <a
        href="/page/login"
        className="text-center text-xs text-white/40 hover:text-white/70 transition-colors"
      >
        ← Өөр имэйл
      </a>
    </form>
  );
}

// --- 2c: бүртгэлгүй ----------------------------------------------------------

function NotRegistered({ message }: { message?: string }) {
  return (
    <div className="flex flex-col gap-4 text-center">
      <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-sm text-amber-200">
        {message ?? "Энэ имэйл бүртгэлгүй байна."}
      </div>
      <Link
        href="/page/signup"
        className="text-sm font-medium text-violet-300 hover:text-violet-200"
      >
        Байгууллага бүртгүүлэх →
      </Link>
      <a
        href="/page/login"
        className="text-xs text-white/40 hover:text-white/70 transition-colors"
      >
        ← Өөр имэйл оруулах
      </a>
    </div>
  );
}
