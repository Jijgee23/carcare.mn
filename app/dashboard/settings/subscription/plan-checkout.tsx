"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  type PaymentActionState,
  cancelSubscriptionPaymentAction,
  checkSubscriptionPaymentAction,
  createSubscriptionPaymentAction,
} from "@/app/_actions/subscription-payments";
import { Btn } from "@/app/_components/landing-ops-ui";
import { useToast } from "@/app/_components/toast";
import {
  BILLING_PERIOD_LABEL,
  PLAN_LABEL,
} from "@/lib/subscription";

export type PlanPriceOption = {
  id: string;
  plan: "FREE" | "BUSINESS" | "ENTERPRISE";
  period: "MONTH" | "QUARTER" | "YEAR";
  amount: string;
  currency: string;
  notes: string | null;
  features: {
    label: string;
    value: string;
    description: string | null;
    highlighted: boolean;
  }[];
};

export type PendingPayment = {
  id: string;
  qrImage: string | null;
  qrText: string | null;
  amount: string;
  currency: string;
  plan: "FREE" | "BUSINESS" | "ENTERPRISE";
  period: "MONTH" | "QUARTER" | "YEAR";
};

export function PlanCheckout({
  prices,
  pending,
}: {
  prices: PlanPriceOption[];
  pending: PendingPayment | null;
}) {
  if (pending) {
    return <QRPanel pending={pending} />;
  }
  return <PlanList prices={prices} />;
}

function PlanList({ prices }: { prices: PlanPriceOption[] }) {
  const toast = useToast();
  const [state, formAction, formPending] = useActionState<
    PaymentActionState,
    FormData
  >(createSubscriptionPaymentAction, null);

  useEffect(() => {
    if (state?.message && !state.ok) {
      toast.error("Төлбөр үүсгэх боломжгүй", state.message);
    }
  }, [state, toast]);

  if (prices.length === 0) {
    return (
      <p className="text-sm text-[var(--oc-muted3)]">
        Үнийн жагсаалт хоосон байна. carservice.mn-тэй холбоо барина уу.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {prices.map((p) => (
          <form
            key={p.id}
            action={formAction}
            className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel2)] p-4 flex flex-col gap-3"
          >
            <input type="hidden" name="planPriceId" value={p.id} />
            <div>
              <div className="font-plex-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--oc-muted3)]">
                {BILLING_PERIOD_LABEL[p.period]}
              </div>
              <div className="mt-1 text-lg font-semibold text-[var(--oc-ink)]">
                {PLAN_LABEL[p.plan]}
              </div>
            </div>
            <div className="font-plex-mono text-2xl font-bold text-[var(--oc-accent)]">
              {Number.parseFloat(p.amount).toLocaleString("mn-MN")}{" "}
              <span className="text-sm text-[var(--oc-muted3)]">{p.currency}</span>
            </div>
            {p.notes ? (
              <p className="text-xs text-[var(--oc-muted2)] line-clamp-3">{p.notes}</p>
            ) : null}
            {p.features.length > 0 ? (
              <ul className="flex flex-col gap-1.5 text-xs">
                {p.features.map((f, i) => (
                  <li
                    key={`${f.label}-${i}`}
                    className={`flex items-start gap-2 ${
                      f.highlighted
                        ? "text-[var(--oc-accent)]"
                        : "text-[var(--oc-muted2)]"
                    }`}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mt-0.5 shrink-0 text-[var(--oc-ok)]"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>
                      <span className="text-[var(--oc-ink2)]">{f.label}</span>
                      <span className="text-[var(--oc-muted3)]">: {f.value}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <Btn type="submit" disabled={formPending} className="mt-auto w-full">
              {formPending ? "Үүсгэж..." : "Багц авах"}
            </Btn>
          </form>
        ))}
      </div>
    </div>
  );
}

function QRPanel({ pending }: { pending: PendingPayment }) {
  const toast = useToast();
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(false);
  const stopRef = useRef(false);

  async function onCancel() {
    stopRef.current = true;
    const fd = new FormData();
    fd.append("paymentId", pending.id);
    await cancelSubscriptionPaymentAction(fd);
    window.location.reload();
  }

  async function checkNow() {
    if (stopRef.current) return;
    setChecking(true);
    try {
      const fd = new FormData();
      fd.append("paymentId", pending.id);
      const res = await checkSubscriptionPaymentAction(fd);
      if (res.paid) {
        setPaid(true);
        stopRef.current = true;
        toast.success("Төлбөр амжилттай", "Багц идэвхжиж байна...");
        setTimeout(() => window.location.reload(), 1500);
      } else if (!res.ok && res.message) {
        toast.error("Төлбөр шалгах боломжгүй", res.message);
      } else {
        toast.warning(
          "Төлбөр төлөгдөөгүй байна",
          "Банкны аппаар QR-аа уншуулсны дараа дахин шалгана уу.",
        );
      }
    } catch (e) {
      toast.error(
        "Алдаа гарлаа",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="rounded-[10px] border border-[var(--oc-accent)]/25 bg-[var(--oc-accent)]/[0.05] p-6 flex flex-col items-center gap-4">
      <div className="text-center">
        <div className="font-plex-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--oc-muted3)]">
          {BILLING_PERIOD_LABEL[pending.period]} · {PLAN_LABEL[pending.plan]}
        </div>
        <div className="mt-2 font-plex-mono text-3xl font-bold text-[var(--oc-accent)]">
          {Number.parseFloat(pending.amount).toLocaleString("mn-MN")}{" "}
          <span className="text-sm text-[var(--oc-muted3)]">{pending.currency}</span>
        </div>
      </div>

      {paid ? (
        <div className="bg-[var(--oc-ok)]/15 border border-[var(--oc-ok)]/30 text-[var(--oc-ok)] rounded-[10px] px-4 py-3 text-sm">
          Төлбөр амжилттай — багц идэвхжиж байна...
        </div>
      ) : pending.qrImage ? (
        <div className="bg-white p-3 rounded-[10px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${pending.qrImage}`}
            alt="QPay QR"
            className="w-56 h-56 object-contain"
          />
        </div>
      ) : (
        <div className="text-sm text-[var(--oc-muted2)]">QR үүсэхэд хүлээнэ үү...</div>
      )}

      {pending.qrText ? (
        <a
          href={pending.qrText}
          className="text-xs text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)]"
        >
          Банкны апп руу шилжих →
        </a>
      ) : null}

      <p className="text-xs text-[var(--oc-muted3)] text-center max-w-xs">
        Утсаараа банкны апп нээж QR-ыг уншуулна уу. Төлбөр төлөгдмөгц багц
        автоматаар идэвхжинэ.
      </p>

      <div className="flex items-center gap-3">
        <Btn type="button" onClick={checkNow} disabled={checking || paid}>
          {checking ? "Шалгаж байна..." : "Төлбөр шалгах"}
        </Btn>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--oc-muted3)] hover:text-[var(--oc-ink2)] underline underline-offset-2"
        >
          Цуцлах
        </button>
      </div>
    </div>
  );
}
