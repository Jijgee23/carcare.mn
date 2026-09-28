"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import {
  type DeletionState,
  accountDeletionAction,
} from "@/app/_actions/account-deletion";
import { Field, FormError, SubmitButton, TabButton } from "@/app/_components/landing-ops-ui";
import { ResendOtpButton } from "@/app/_components/resend-otp-button";

export function DeletionForm() {
  const [state, formAction, pending] = useActionState(accountDeletionAction, null as DeletionState);
  const [kind, setKind] = useState<"customer" | "staff">(state?.kind ?? "customer");
  const [identifier, setIdentifier] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const step = state?.step ?? "identify";
  const fe = state?.fieldErrors ?? {};
  const lockedIdentifier = state?.identifier ?? identifier;

  if (step === "done") {
    return (
      <div className="bg-[var(--oc-accent)]/10 border border-[var(--oc-accent)]/25 rounded-[10px] px-4 py-3 text-sm text-[var(--oc-ink2)] space-y-3">
        <p>{state?.message}</p>
        <Link
          href="/"
          className="text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
        >
          ← Нүүр хуудас руу буцах
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="kind" value={kind} />

      {step === "identify" ? (
        <div className="flex gap-2">
          <TabButton active={kind === "customer"} onClick={() => setKind("customer")}>
            Хэрэглэгч
          </TabButton>
          <TabButton active={kind === "staff"} onClick={() => setKind("staff")}>
            Байгууллагын ажилтан
          </TabButton>
        </div>
      ) : null}

      {step === "identify" ? (
        <FormError message={state?.message && !state.ok ? state.message : undefined} />
      ) : null}

      {step === "confirm" && state?.message ? (
        <div className="bg-[var(--oc-accent)]/10 border border-[var(--oc-accent)]/25 rounded-[10px] px-4 py-3 text-sm text-[var(--oc-ink2)]">
          {state.message}
        </div>
      ) : null}

      {step === "identify" ? (
        <>
          <Field
            label={kind === "customer" ? "Утасны дугаар" : "Имэйл эсвэл утас"}
            htmlFor="identifier"
            error={fe.identifier}
          >
            <input
              id="identifier"
              name="identifier"
              type="text"
              inputMode={kind === "customer" ? "numeric" : "text"}
              autoComplete={kind === "customer" ? "tel" : "username"}
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={`auth-input ${fe.identifier ? "border-red-500/50" : ""}`}
              placeholder={kind === "customer" ? "99112233" : "99112233 эсвэл email@example.com"}
            />
          </Field>
          <SubmitButton pending={pending}>Код авах</SubmitButton>
        </>
      ) : (
        <>
          <input type="hidden" name="identifier" value={lockedIdentifier} />
          <Field label="Баталгаажуулах код" htmlFor="otpCode" error={fe.otpCode}>
            <input
              id="otpCode"
              name="otpCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              className={`auth-input text-center text-lg tracking-[0.4em] ${fe.otpCode ? "border-red-500/50" : ""}`}
              placeholder="000000"
            />
          </Field>

          <label className="flex items-start gap-2.5 text-sm text-[var(--oc-ink2)]">
            <input type="checkbox" name="confirm" className="mt-1" />
            Би ойлголоо, энэ үйлдлийг буцаах боломжгүй
          </label>
          {fe.confirm ? <p className="text-red-400 text-xs light:text-red-600">{fe.confirm}</p> : null}

          <SubmitButton pending={pending} tone="danger">
            Бүртгэл устгах
          </SubmitButton>

          <ResendOtpButton
            pending={pending}
            onResend={() => {
              setOtpCode("");
              const fd = new FormData();
              fd.set("kind", kind);
              fd.set("identifier", lockedIdentifier);
              startTransition(() => formAction(fd));
            }}
          />
        </>
      )}
    </form>
  );
}
