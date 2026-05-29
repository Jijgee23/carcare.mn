"use client";

import { useActionState, useState } from "react";
import {
  type ServiceActionState,
  adjustServiceStockAction,
} from "@/app/_actions/services";
import { Field, FormError } from "@/app/_components/auth-shell";
import { Select } from "@/app/_components/select";

export function StockAdjustForm({
  serviceId,
  unit,
}: {
  serviceId: string;
  unit: string;
}) {
  const action = adjustServiceStockAction.bind(null, serviceId);
  const [state, formAction, pending] = useActionState<
    ServiceActionState,
    FormData
  >(action, null);
  const [direction, setDirection] = useState<string>("in");

  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-3.5" noValidate>
      {state?.ok && state.message ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-emerald-300">
          {state.message}
        </div>
      ) : null}
      <FormError
        message={state?.message && !state.ok ? state.message : undefined}
      />

      <Field label="Чиглэл" htmlFor="direction" error={fe.direction}>
        <Select
          id="direction"
          name="direction"
          required
          value={direction}
          onChange={setDirection}
          error={fe.direction}
          options={[
            { value: "in", label: "+ Орлого (нийлүүлэлт)" },
            { value: "out", label: "− Зарлага (гар тохируулга)" },
          ]}
        />
      </Field>

      <Field label={`Хэмжээ (${unit})`} htmlFor="amount" error={fe.amount}>
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          required
          className={`compact-input ${fe.amount ? "border-red-500/50" : ""}`}
          placeholder="10"
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 transition-colors py-2 rounded-lg text-sm font-medium"
      >
        {pending ? "Бүртгэж байна..." : "Үлдэгдэл өөрчлөх"}
      </button>
    </form>
  );
}
