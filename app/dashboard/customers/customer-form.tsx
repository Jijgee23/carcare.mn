"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  type CustomerActionState,
  createCustomerAction,
  updateCustomerAction,
} from "@/app/_actions/customers";
import { Field, FormError } from "@/app/_components/auth-shell";

type Initial = {
  id?: string;
  fullName: string;
  phone: string;
  email: string | null;
  note: string | null;
};

export function CustomerForm({ initial }: { initial?: Initial }) {
  const isEdit = Boolean(initial?.id);
  const action = isEdit
    ? updateCustomerAction.bind(null, initial!.id!)
    : createCustomerAction;

  const [state, formAction, pending] = useActionState<
    CustomerActionState,
    FormData
  >(action, null);

  // Controlled — action амжилтгүй болсон үед утгууд цэвэрлэгдэхгүй
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  const fe = state?.fieldErrors ?? {};
  const fieldMaxWidth = "max-w-xs";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormError message={state?.message} />

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Field label="Овог нэр" htmlFor="fullName" hint="заавал биш" error={fe.fullName} className={fieldMaxWidth}>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={`compact-input ${fe.fullName ? "border-red-500/50" : ""}`}
            placeholder="Жишээ: Батын Болд"
          />
        </Field>
        <Field label="Утас" htmlFor="phone" error={fe.phone} className={fieldMaxWidth}>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`compact-input ${fe.phone ? "border-red-500/50" : ""}`}
            placeholder="99000000"
          />
        </Field>
        <Field label="Имэйл" htmlFor="email" hint="заавал биш" error={fe.email} className={fieldMaxWidth}>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`compact-input ${fe.email ? "border-red-500/50" : ""}`}
            placeholder="bold@gmail.com"
          />
        </Field>
      </div>

      <Field label="Тэмдэглэл" htmlFor="note" hint="заавал биш" error={fe.note} className="max-w-2xl">
        <textarea
          id="note"
          name="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="compact-input resize-y"
          placeholder="Үйлчлүүлэгчийн талаар тэмдэглэх зүйл..."
        />
      </Field>

      <div className="flex gap-2 pt-3 border-t border-white/[0.05]">
        <Link
          href="/dashboard/customers"
          className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all px-5 py-2 rounded-lg font-medium text-sm text-white/60 text-center"
        >
          ← Буцах
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all px-6 py-2 rounded-lg font-medium text-sm"
        >
          {pending ? "..." : isEdit ? "Хадгалах" : "Үүсгэх"}
        </button>
      </div>
    </form>
  );
}
