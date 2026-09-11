"use client";

import { useActionState } from "react";
import {
  createManualSubscriptionPaymentAction,
  type SubscriptionPaymentActionState,
} from "@/app/_actions/system-subscription-payments";
import { Btn, FormError } from "@/app/_components/landing-ops-ui";
import {
  BILLING_PERIOD_LABEL,
  BILLING_PERIODS,
  PLAN_LABEL,
  SUBSCRIPTION_PAYMENT_METHOD_LABEL,
} from "@/lib/subscription";

const PLANS = ["FREE", "BUSINESS", "ENTERPRISE"] as const;
const METHODS = ["BANK_TRANSFER", "CASH", "QPAY", "OTHER"] as const;

export function SubscriptionPaymentCreateForm({
  tenantId,
  defaultPlan,
}: {
  tenantId: string;
  defaultPlan: string;
}) {
  const [state, formAction, pending] = useActionState<
    SubscriptionPaymentActionState,
    FormData
  >(createManualSubscriptionPaymentAction, null);
  const fe = state?.fieldErrors ?? {};
  // Амжилттай бүртгэсний дараа form-ыг тэг болгох — state.message тогтмол
  // тул react-hooks/purity зөрчихгүй (Math.random() шиг impure биш).
  const formKey = state?.ok ? `created-${state.message ?? ""}` : "create";

  return (
    <form
      key={formKey}
      action={formAction}
      className="flex flex-col gap-2"
      noValidate
    >
      <input type="hidden" name="tenantId" value={tenantId} />

      {state?.ok && state.message ? (
        <div className="bg-[var(--oc-ok)]/10 border border-[var(--oc-ok)]/25 rounded-lg px-3 py-2 text-xs text-[var(--oc-ok)]">
          {state.message}
        </div>
      ) : null}
      {state?.message && !state.ok ? (
        <FormError message={state.message} />
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <select
          name="plan"
          defaultValue={defaultPlan}
          className={`auth-input !py-2 !text-sm ${fe.plan ? "border-red-500/50" : ""}`}
        >
          {PLANS.map((p) => (
            <option key={p} value={p} className="bg-[var(--surface)]">
              {PLAN_LABEL[p]}
            </option>
          ))}
        </select>
        <select
          name="period"
          defaultValue="MONTH"
          className={`auth-input !py-2 !text-sm ${fe.period ? "border-red-500/50" : ""}`}
        >
          {BILLING_PERIODS.map((p) => (
            <option key={p} value={p} className="bg-[var(--surface)]">
              {BILLING_PERIOD_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          name="amount"
          type="text"
          inputMode="decimal"
          placeholder="Дүн (₮)"
          className={`auth-input !py-2 !text-sm ${fe.amount ? "border-red-500/50" : ""}`}
        />
        <select
          name="method"
          defaultValue="BANK_TRANSFER"
          className={`auth-input !py-2 !text-sm ${fe.method ? "border-red-500/50" : ""}`}
        >
          {METHODS.map((m) => (
            <option key={m} value={m} className="bg-[var(--surface)]">
              {SUBSCRIPTION_PAYMENT_METHOD_LABEL[m]}
            </option>
          ))}
        </select>
      </div>

      <input
        name="notes"
        type="text"
        placeholder="Тэмдэглэл (заавал биш)"
        className="auth-input !py-2 !text-sm"
      />

      <label className="flex items-center gap-2 text-xs text-[var(--oc-muted)]">
        <input
          type="checkbox"
          name="markPaid"
          defaultChecked
          className="accent-[var(--oc-accent)]"
        />
        Шууд &quot;Төлөгдсөн&quot; гэж тэмдэглэж, багцыг идэвхжүүлэх
      </label>

      <div>
        <Btn type="submit" size="sm" disabled={pending}>
          {pending ? "Бүртгэж..." : "Бүртгэх"}
        </Btn>
      </div>
    </form>
  );
}
