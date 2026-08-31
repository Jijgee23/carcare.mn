"use client";

import { useState } from "react";
import { quickCreateCustomerAction } from "@/app/_actions/quick-create";
import { Field } from "@/app/_components/auth-shell";
import { Btn } from "@/app/_components/landing-ops-ui";

export type CreatedCustomer = {
  id: string;
  fullName: string;
  phone: string;
};

export function InlineCustomerForm({
  onCreated,
  onCancel,
}: {
  onCreated: (c: CreatedCustomer) => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit() {
    setPending(true);
    setMessage(null);
    setFieldErrors({});
    try {
      const res = await quickCreateCustomerAction({
        fullName,
        phone,
        email: email || null,
        note: note || null,
      });
      if (res.ok && res.customer) {
        onCreated(res.customer);
        return;
      }
      setFieldErrors(res.fieldErrors ?? {});
      setMessage(res.message ?? null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Алдаа гарлаа.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--oc-accent)]/25 bg-[var(--oc-accent)]/[0.06] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--oc-accent)]">
          Шинэ үйлчлүүлэгч
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--oc-muted3)] hover:text-[var(--oc-ink2)] transition-colors"
        >
          ✕ Болих
        </button>
      </div>

      {message ? (
        <p className="text-xs text-red-400 light:text-red-600">{message}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Овог нэр" htmlFor="qc-fullName" hint="заавал биш" error={fieldErrors.fullName}>
          <input
            id="qc-fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={`auth-input ${fieldErrors.fullName ? "border-red-500/50" : ""}`}
            placeholder="Бат Болд"
          />
        </Field>
        <Field label="Утас" htmlFor="qc-phone" error={fieldErrors.phone}>
          <input
            id="qc-phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`auth-input ${fieldErrors.phone ? "border-red-500/50" : ""}`}
            placeholder="99887766"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Имэйл"
          htmlFor="qc-email"
          hint="заавал биш"
          error={fieldErrors.email}
        >
          <input
            id="qc-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`auth-input ${fieldErrors.email ? "border-red-500/50" : ""}`}
          />
        </Field>
        <Field label="Тэмдэглэл" htmlFor="qc-note" hint="заавал биш">
          <input
            id="qc-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="auth-input"
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <Btn type="button" disabled={pending} onClick={onSubmit}>
          {pending ? "Үүсгэж..." : "Үйлчлүүлэгч үүсгэх"}
        </Btn>
      </div>
    </div>
  );
}
