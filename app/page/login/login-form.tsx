"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { signInAction, type ActionState } from "@/app/_actions/auth";
import {
  Field,
  FormError,
  SubmitButton,
} from "@/app/_components/auth-shell";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signInAction,
    null,
  );
  const fe = state?.fieldErrors ?? {};
  const [showPassword, setShowPassword] = useState(false);
  // Controlled — action submit болж state өөрчлөгдсөн ч талбарууд цэвэрлэгдэхгүй.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormError message={state?.message} />

      <Field label="Имэйл хаяг" htmlFor="email" error={fe.email}>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`auth-input ${fe.email ? "border-red-500/50" : ""}`}
          placeholder="you@gmail.com"
        />
      </Field>

      <Field label="Нууц үг" htmlFor="password" error={fe.password}>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
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

      <div className="-mt-1 text-right">
        <Link
          href="/page/forgot"
          className="text-xs text-violet-300 hover:text-violet-200"
        >
          Нууц үг мартсан уу?
        </Link>
      </div>

      <SubmitButton pending={pending}>Нэвтрэх →</SubmitButton>
    </form>
  );
}
