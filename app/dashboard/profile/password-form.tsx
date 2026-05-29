"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import {
  type ProfileActionState,
  changePasswordAction,
} from "@/app/_actions/profile";
import { Field, FormError } from "@/app/_components/auth-shell";

const FIELD_MW = "max-w-xs";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<
    ProfileActionState,
    FormData
  >(changePasswordAction, null);

  const [show, setShow] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const fe = state?.fieldErrors ?? {};

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      {state?.ok && state.message ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-emerald-300">
          {state.message}
        </div>
      ) : null}
      <FormError
        message={state?.message && !state.ok ? state.message : undefined}
      />

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Field
          label="Одоогийн нууц үг"
          htmlFor="currentPassword"
          error={fe.currentPassword}
          className={FIELD_MW}
        >
          <input
            id="currentPassword"
            name="currentPassword"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            className={`compact-input ${fe.currentPassword ? "border-red-500/50" : ""}`}
            placeholder="••••••••"
          />
        </Field>
        <Field
          label="Шинэ нууц үг"
          htmlFor="newPassword"
          hint="8+ тэмдэгт"
          error={fe.newPassword}
          className={FIELD_MW}
        >
          <input
            id="newPassword"
            name="newPassword"
            type={show ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            className={`compact-input ${fe.newPassword ? "border-red-500/50" : ""}`}
            placeholder="••••••••"
          />
        </Field>
        <Field
          label="Шинэ нууц үг давтан"
          htmlFor="confirmPassword"
          error={fe.confirmPassword}
          className={FIELD_MW}
        >
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={show ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            className={`compact-input ${fe.confirmPassword ? "border-red-500/50" : ""}`}
            placeholder="••••••••"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-white/50 hover:text-white/70 transition-colors">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
          className="w-4 h-4 rounded accent-violet-500"
        />
        Нууц үг харах
      </label>

      <div className="flex pt-1">
        <button
          type="submit"
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all px-6 py-2 rounded-lg font-medium text-sm"
        >
          {pending ? "..." : "Нууц үг солих"}
        </button>
      </div>
    </form>
  );
}
