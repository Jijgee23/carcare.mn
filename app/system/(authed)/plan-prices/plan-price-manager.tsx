"use client";

import { useActionState, useState } from "react";
import {
  type PlanPriceActionState,
  createPlanPriceAction,
  deletePlanPriceAction,
  updatePlanPriceAction,
} from "@/app/_actions/system-plan-prices";
import { Field, FormError } from "@/app/_components/auth-shell";
import {
  BILLING_PERIODS,
  BILLING_PERIOD_LABEL,
  PLAN_LABEL,
} from "@/lib/subscription";

const PLANS: ("FREE" | "BUSINESS" | "ENTERPRISE")[] = [
  "FREE",
  "BUSINESS",
  "ENTERPRISE",
];

export type PlanPriceRow = {
  id: string;
  plan: "FREE" | "BUSINESS" | "ENTERPRISE";
  period: "MONTH" | "QUARTER" | "YEAR";
  amount: string;
  currency: string;
  isActive: boolean;
  notes: string | null;
};

export function PlanPriceManager({ prices }: { prices: PlanPriceRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="grid gap-6">
      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold">Жагсаалт</h2>
          <p className="text-xs text-white/40 mt-0.5">
            Нийт {prices.length} мөр
          </p>
        </div>
        {prices.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-white/40">
            Үнэ бүртгэгдээгүй байна.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Багц", "Хугацаа", "Үнэ", "Валют", "Тэмдэглэл", "Төлөв", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-xs text-white/30 font-medium px-5 py-3"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {prices.map((p) =>
                  editingId === p.id ? (
                    <EditRow
                      key={p.id}
                      row={p}
                      onClose={() => setEditingId(null)}
                    />
                  ) : (
                    <ViewRow
                      key={p.id}
                      row={p}
                      onEdit={() => setEditingId(p.id)}
                    />
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass rounded-2xl p-6 border border-white/[0.08]">
        <h2 className="font-semibold mb-1">Шинэ үнэ нэмэх</h2>
        <p className="text-xs text-white/40 mb-5">
          Багц + хугацаа + валют хослол давтагдашгүй.
        </p>
        <CreateForm />
      </section>
    </div>
  );
}

function ViewRow({ row, onEdit }: { row: PlanPriceRow; onEdit: () => void }) {
  return (
    <tr className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
      <td className="px-5 py-3 text-white/85">{PLAN_LABEL[row.plan]}</td>
      <td className="px-5 py-3 text-white/70">
        {BILLING_PERIOD_LABEL[row.period]}
      </td>
      <td className="px-5 py-3 text-white/85 font-mono">
        {Number.parseFloat(row.amount).toLocaleString("mn-MN")}
      </td>
      <td className="px-5 py-3 text-white/60 font-mono text-xs">
        {row.currency}
      </td>
      <td className="px-5 py-3 text-white/50 text-xs max-w-[240px]">
        {row.notes ?? "—"}
      </td>
      <td className="px-5 py-3">
        {row.isActive ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Идэвхтэй
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.08]">
            Идэвхгүй
          </span>
        )}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-violet-400 hover:text-violet-300 px-2.5 py-1.5 rounded-lg hover:bg-violet-500/10 transition-colors"
          >
            Засах
          </button>
          <form action={deletePlanPriceAction}>
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              className="text-xs text-red-400 hover:text-red-300 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              Устгах
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}

function EditRow({
  row,
  onClose,
}: {
  row: PlanPriceRow;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    PlanPriceActionState,
    FormData
  >(updatePlanPriceAction.bind(null, row.id), null);
  if (state?.ok) onClose();
  const fe = state?.fieldErrors ?? {};

  return (
    <tr className="border-b border-white/[0.04] bg-white/[0.02]">
      <td colSpan={7} className="px-5 py-3">
        <form action={formAction} className="flex flex-col gap-2" noValidate>
          {state?.message && !state.ok ? (
            <FormError message={state.message} />
          ) : null}
          <div className="grid gap-2 sm:grid-cols-6">
            <select
              name="plan"
              defaultValue={row.plan}
              className="auth-input !py-2 !text-sm"
            >
              {PLANS.map((p) => (
                <option key={p} value={p} className="bg-[#0d0d14]">
                  {PLAN_LABEL[p]}
                </option>
              ))}
            </select>
            <select
              name="period"
              defaultValue={row.period}
              className="auth-input !py-2 !text-sm"
            >
              {BILLING_PERIODS.map((p) => (
                <option key={p} value={p} className="bg-[#0d0d14]">
                  {BILLING_PERIOD_LABEL[p]}
                </option>
              ))}
            </select>
            <input
              name="amount"
              type="text"
              inputMode="decimal"
              defaultValue={row.amount}
              placeholder="0"
              className={`auth-input !py-2 !text-sm ${fe.amount ? "border-red-500/50" : ""}`}
            />
            <input
              name="currency"
              type="text"
              defaultValue={row.currency}
              placeholder="MNT"
              maxLength={6}
              className="auth-input !py-2 !text-sm uppercase"
            />
            <input
              name="notes"
              type="text"
              defaultValue={row.notes ?? ""}
              placeholder="Тэмдэглэл"
              className="auth-input !py-2 !text-sm sm:col-span-2"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={row.isActive}
              className="accent-violet-500"
            />
            Идэвхтэй (тенант сонгох боломжтой)
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg text-white/60 hover:text-white/90 hover:bg-white/[0.05]"
            >
              Болих
            </button>
            <button
              type="submit"
              disabled={pending}
              className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 font-medium"
            >
              {pending ? "Хадгалж..." : "Хадгалах"}
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function CreateForm() {
  const [state, formAction, pending] = useActionState<
    PlanPriceActionState,
    FormData
  >(createPlanPriceAction, null);
  const fe = state?.fieldErrors ?? {};
  const formKey = state?.ok ? `created-${Math.random()}` : "create";

  return (
    <form
      key={formKey}
      action={formAction}
      className="flex flex-col gap-3"
      noValidate
    >
      {state?.ok && state.message ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-sm text-emerald-300">
          {state.message}
        </div>
      ) : null}
      {state?.message && !state.ok ? (
        <FormError message={state.message} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-5">
        <Field label="Багц" htmlFor="pp-plan" error={fe.plan}>
          <select id="pp-plan" name="plan" required className="auth-input">
            {PLANS.map((p) => (
              <option key={p} value={p} className="bg-[#0d0d14]">
                {PLAN_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Хугацаа" htmlFor="pp-period" error={fe.period}>
          <select id="pp-period" name="period" required className="auth-input">
            {BILLING_PERIODS.map((p) => (
              <option key={p} value={p} className="bg-[#0d0d14]">
                {BILLING_PERIOD_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Үнэ" htmlFor="pp-amount" error={fe.amount}>
          <input
            id="pp-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            required
            placeholder="99000"
            className={`auth-input ${fe.amount ? "border-red-500/50" : ""}`}
          />
        </Field>
        <Field label="Валют" htmlFor="pp-currency" hint="заавал биш">
          <input
            id="pp-currency"
            name="currency"
            type="text"
            defaultValue="MNT"
            maxLength={6}
            className="auth-input uppercase"
          />
        </Field>
        <label className="flex items-end gap-2 text-sm text-white/70 pb-2.5">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked
            className="accent-violet-500"
          />
          Идэвхтэй
        </label>
      </div>

      <Field label="Тэмдэглэл" htmlFor="pp-notes" hint="заавал биш">
        <input
          id="pp-notes"
          name="notes"
          type="text"
          className="auth-input"
          placeholder="Жишээ: 12 хоног үнэгүй туршилт орсон"
        />
      </Field>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 transition-colors px-4 py-2.5 rounded-xl text-sm font-medium"
        >
          {pending ? "Нэмж..." : "Үнэ нэмэх"}
        </button>
      </div>
    </form>
  );
}
