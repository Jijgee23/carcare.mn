"use client";

import { useState } from "react";
import { upsertPlanPriceAction } from "@/app/_actions/system-plan-prices";
import { BILLING_PERIOD_LABEL, PLAN_LABEL } from "@/lib/subscription";

const PLANS = ["BUSINESS", "ENTERPRISE"] as const;
const PERIODS = ["MONTH", "QUARTER", "YEAR"] as const;
const CURRENCY = "MNT";

type Plan = (typeof PLANS)[number];
type Period = (typeof PERIODS)[number];

export type PlanPriceMatrixRow = {
  id: string;
  plan: "FREE" | "BUSINESS" | "ENTERPRISE";
  period: "MONTH" | "QUARTER" | "YEAR";
  amount: string;
  currency: string;
  isActive: boolean;
  notes: string | null;
};

export function PlanPriceMatrix({ prices }: { prices: PlanPriceMatrixRow[] }) {
  const map = new Map<string, PlanPriceMatrixRow>();
  for (const p of prices) {
    if (p.currency === CURRENCY) {
      map.set(`${p.plan}:${p.period}`, p);
    }
  }

  return (
    <div className="glass rounded-xl border border-white/[0.08] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <h2 className="font-semibold text-sm">Үнэ ({CURRENCY})</h2>
        <p className="text-xs text-white/40 mt-0.5">
          Багц × хугацаа. Утга оруулаад фокусаас гарах үед автоматаар хадгална.
          <span className="text-white/30">
            {" "}
            FREE багц нь зөвхөн бүртгүүлэх үед 14 хоногийн туршилт — үнэ
            оруулдаггүй.
          </span>
        </p>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="text-left text-xs text-white/40 font-medium px-4 py-2.5">
                Багц
              </th>
              {PERIODS.map((p) => (
                <th
                  key={p}
                  className="text-left text-xs text-white/40 font-medium px-4 py-2.5"
                >
                  {BILLING_PERIOD_LABEL[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLANS.map((plan) => (
              <tr
                key={plan}
                className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3 text-white/90 font-medium align-top">
                  {PLAN_LABEL[plan]}
                </td>
                {PERIODS.map((period) => {
                  const row = map.get(`${plan}:${period}`);
                  return (
                    <td key={period} className="px-4 py-3 align-top">
                      <PriceCell plan={plan} period={period} row={row ?? null} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriceCell({
  plan,
  period,
  row,
}: {
  plan: Plan;
  period: Period;
  row: PlanPriceMatrixRow | null;
}) {
  const [amount, setAmount] = useState<string>(row?.amount ?? "");
  const [isActive, setIsActive] = useState<boolean>(row?.isActive ?? true);
  const [notes, setNotes] = useState<string>(row?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!amount.trim()) return; // хоосон утга — хадгалахгүй
    setPending(true);
    setError(null);
    setSavedAt(null);
    try {
      const fd = new FormData();
      fd.set("plan", plan);
      fd.set("period", period);
      fd.set("currency", CURRENCY);
      fd.set("amount", amount);
      if (isActive) fd.set("isActive", "on");
      if (notes) fd.set("notes", notes);
      const res = await upsertPlanPriceAction(null, fd);
      if (res && !res.ok) {
        setError(res.message ?? "Алдаа");
        return;
      }
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2000);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={save}
        placeholder="0"
        className="compact-input !py-1 !text-sm w-full max-w-[8rem]"
      />
      <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-white/60">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => {
            setIsActive(e.target.checked);
          }}
          onBlur={save}
          className="accent-violet-500"
        />
        Идэвхтэй
      </label>
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={save}
        placeholder="Тэмдэглэл (заавал биш)"
        className="compact-input !py-1 !text-[11px] w-full max-w-[14rem]"
      />
      <div className="text-[10px] h-3">
        {pending ? (
          <span className="text-violet-300">Хадгалж...</span>
        ) : error ? (
          <span className="text-red-400">{error}</span>
        ) : savedAt ? (
          <span className="text-emerald-400">✓ Хадгалав</span>
        ) : null}
      </div>
    </div>
  );
}
