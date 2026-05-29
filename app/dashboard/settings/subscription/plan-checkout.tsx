"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  type PaymentActionState,
  cancelSubscriptionPaymentAction,
  checkSubscriptionPaymentAction,
  createSubscriptionPaymentAction,
} from "@/app/_actions/subscription-payments";
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
      <p className="text-sm text-white/40">
        Үнийн жагсаалт хоосон байна. carcare.mn-тэй холбоо барина уу.
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
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col gap-3"
          >
            <input type="hidden" name="planPriceId" value={p.id} />
            <div>
              <div className="text-xs text-white/40 uppercase tracking-wider">
                {BILLING_PERIOD_LABEL[p.period]}
              </div>
              <div className="mt-1 text-lg font-semibold text-white">
                {PLAN_LABEL[p.plan]}
              </div>
            </div>
            <div className="text-2xl font-bold gradient-text">
              {Number.parseFloat(p.amount).toLocaleString("mn-MN")}{" "}
              <span className="text-sm text-white/40">{p.currency}</span>
            </div>
            {p.notes ? (
              <p className="text-xs text-white/50 line-clamp-3">{p.notes}</p>
            ) : null}
            {p.features.length > 0 ? (
              <ul className="flex flex-col gap-1.5 text-xs">
                {p.features.map((f, i) => (
                  <li
                    key={`${f.label}-${i}`}
                    className={`flex items-start gap-2 ${
                      f.highlighted ? "text-violet-200" : "text-white/70"
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
                      className="mt-0.5 shrink-0 text-emerald-400"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>
                      <span className="text-white/85">{f.label}</span>
                      <span className="text-white/40">: {f.value}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="submit"
              disabled={formPending}
              className="mt-auto bg-violet-600 hover:bg-violet-500 disabled:opacity-60 transition-colors py-2.5 rounded-xl text-sm font-medium"
            >
              {formPending ? "Үүсгэж..." : "Багц авах"}
            </button>
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
    <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.05] p-6 flex flex-col items-center gap-4">
      <div className="text-center">
        <div className="text-xs text-white/40 uppercase tracking-wider">
          {BILLING_PERIOD_LABEL[pending.period]} · {PLAN_LABEL[pending.plan]}
        </div>
        <div className="mt-2 text-3xl font-bold gradient-text">
          {Number.parseFloat(pending.amount).toLocaleString("mn-MN")}{" "}
          <span className="text-sm text-white/40">{pending.currency}</span>
        </div>
      </div>

      {paid ? (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 rounded-xl px-4 py-3 text-sm">
          Төлбөр амжилттай — багц идэвхжиж байна...
        </div>
      ) : pending.qrImage ? (
        <div className="bg-white p-3 rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${pending.qrImage}`}
            alt="QPay QR"
            className="w-56 h-56 object-contain"
          />
        </div>
      ) : (
        <div className="text-sm text-white/50">QR үүсэхэд хүлээнэ үү...</div>
      )}

      {pending.qrText ? (
        <a
          href={pending.qrText}
          className="text-xs text-violet-300 hover:text-violet-200"
        >
          Банкны апп руу шилжих →
        </a>
      ) : null}

      <p className="text-xs text-white/40 text-center max-w-xs">
        Утсаараа банкны апп нээж QR-ыг уншуулна уу. Төлбөр төлөгдмөгц багц
        автоматаар идэвхжинэ.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={checkNow}
          disabled={checking || paid}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 transition-colors px-4 py-2 rounded-xl text-sm font-medium"
        >
          {checking ? "Шалгаж байна..." : "Төлбөр шалгах"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-white/50 hover:text-white/80 underline underline-offset-2"
        >
          Цуцлах
        </button>
      </div>
    </div>
  );
}
