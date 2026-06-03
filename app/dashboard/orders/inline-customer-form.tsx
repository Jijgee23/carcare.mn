"use client";

import { useState } from "react";
import { quickCreateCustomerAction } from "@/app/_actions/quick-create";
import { Field } from "@/app/_components/auth-shell";

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
    <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.06] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-violet-200">
          Шинэ үйлчлүүлэгч
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          ✕ Болих
        </button>
      </div>

      {message ? (
        <p className="text-xs text-red-400">{message}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Овог нэр" htmlFor="qc-fullName" hint="заавал биш" error={fieldErrors.fullName}>
          <input
            id="qc-fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={`compact-input ${fieldErrors.fullName ? "border-red-500/50" : ""}`}
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
            className={`compact-input ${fieldErrors.phone ? "border-red-500/50" : ""}`}
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
            className={`compact-input ${fieldErrors.email ? "border-red-500/50" : ""}`}
          />
        </Field>
        <Field label="Тэмдэглэл" htmlFor="qc-note" hint="заавал биш">
          <input
            id="qc-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="compact-input"
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={onSubmit}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 transition-colors px-4 py-2 rounded-lg text-sm font-medium"
        >
          {pending ? "Үүсгэж..." : "Үйлчлүүлэгч үүсгэх"}
        </button>
      </div>
    </div>
  );
}
