"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  signInSystemAction,
  type SystemActionState,
} from "@/app/_actions/system-auth";
import {
  Field,
  FormError,
  SubmitButton,
} from "@/app/_components/auth-shell";

export function SystemLoginForm() {
  const [state, formAction, pending] = useActionState<
    SystemActionState,
    FormData
  >(signInSystemAction, null);
  const fe = state?.fieldErrors ?? {};
  const [show, setShow] = useState(false);
  // Controlled — action submit болсон ч талбарууд цэвэрлэгдэхгүй
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormError message={state?.message} />

      <Field label="Имэйл" htmlFor="email" error={fe.email}>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`auth-input ${fe.email ? "border-red-500/50" : ""}`}
          placeholder="root@carcare.mn"
        />
      </Field>

      <Field label="Нууц үг" htmlFor="password" error={fe.password}>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`auth-input pr-14 ${fe.password ? "border-red-500/50" : ""}`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs"
          >
            {show ? "Нуух" : "Харах"}
          </button>
        </div>
      </Field>

      <SubmitButton pending={pending}>Нэвтрэх →</SubmitButton>
    </form>
  );
}
