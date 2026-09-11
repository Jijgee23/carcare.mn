import type {
  BillingPeriod,
  Plan,
  SubscriptionPaymentMethod,
  SubscriptionPaymentStatus,
} from "@/app/generated/prisma/client";
import {
  markSubscriptionPaymentPaidAction,
  markSubscriptionPaymentUnpaidAction,
} from "@/app/_actions/system-subscription-payments";
import { ConfirmForm } from "@/app/_components/confirm-form";
import { formatTugrik } from "@/lib/orders";
import {
  BILLING_PERIOD_LABEL,
  PLAN_LABEL,
  SUBSCRIPTION_PAYMENT_METHOD_LABEL,
  SUBSCRIPTION_PAYMENT_STATUS_BADGE,
  SUBSCRIPTION_PAYMENT_STATUS_LABEL,
} from "@/lib/subscription";

export type SubscriptionPaymentRowData = {
  id: string;
  plan: Plan;
  period: BillingPeriod;
  amount: string;
  method: SubscriptionPaymentMethod;
  status: SubscriptionPaymentStatus;
  createdAt: Date;
  paidAt: Date | null;
};

export function SubscriptionPaymentRow({
  payment,
}: {
  payment: SubscriptionPaymentRowData;
}) {
  return (
    <tr className="border-b border-[var(--oc-line2)] last:border-0">
      <td className="px-5 py-3 text-[var(--oc-ink2)]">
        {PLAN_LABEL[payment.plan]}
      </td>
      <td className="px-5 py-3 text-[var(--oc-muted)]">
        {BILLING_PERIOD_LABEL[payment.period]}
      </td>
      <td className="px-5 py-3 font-plex-mono text-[var(--oc-ink2)] tabular-nums">
        {formatTugrik(payment.amount)}
      </td>
      <td className="px-5 py-3 text-[var(--oc-muted)]">
        {SUBSCRIPTION_PAYMENT_METHOD_LABEL[payment.method]}
      </td>
      <td className="px-5 py-3">
        <span
          className={`px-2 py-0.5 rounded-full text-xs ${SUBSCRIPTION_PAYMENT_STATUS_BADGE[payment.status]}`}
        >
          {SUBSCRIPTION_PAYMENT_STATUS_LABEL[payment.status]}
        </span>
      </td>
      <td className="px-5 py-3 text-xs text-[var(--oc-muted3)]">
        {payment.createdAt.toLocaleDateString("mn-MN")}
        {payment.paidAt ? (
          <div className="text-[var(--oc-ok)]">
            {payment.paidAt.toLocaleDateString("mn-MN")}
          </div>
        ) : null}
      </td>
      <td className="px-5 py-3 text-right">
        {payment.status === "PENDING" ? (
          <div className="flex items-center justify-end gap-1">
            <ConfirmForm
              action={markSubscriptionPaymentPaidAction}
              message="Энэ төлбөрийг 'төлөгдсөн' гэж тэмдэглэх үү? Тухайн тенантын багц шууд идэвхжинэ."
            >
              <input type="hidden" name="id" value={payment.id} />
              <button
                type="submit"
                className="text-xs text-[var(--oc-ok)] hover:opacity-80 px-2 py-1 rounded-md hover:bg-[var(--oc-ok)]/10 transition-colors"
              >
                Төлөгдсөн
              </button>
            </ConfirmForm>
            <ConfirmForm
              action={markSubscriptionPaymentUnpaidAction}
              message="Энэ төлбөрийг 'төлөгдөөгүй' гэж тэмдэглэх үү?"
            >
              <input type="hidden" name="id" value={payment.id} />
              <button
                type="submit"
                className="text-xs text-red-400 hover:text-red-300 light:text-red-600 light:hover:text-red-700 px-2 py-1 rounded-md hover:bg-red-500/10 transition-colors"
              >
                Цуцлах
              </button>
            </ConfirmForm>
          </div>
        ) : null}
      </td>
    </tr>
  );
}
