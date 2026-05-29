"use client";

import { useState } from "react";
import {
  resetPlanLimitsAction,
  updatePlanLimitAction,
} from "@/app/_actions/system-plan-limits";
import {
  ALL_LIMIT_CODES,
  PLAN_LIMIT_META,
  type PlanLimitCode,
} from "@/lib/plan-limits";
import { PLAN_LABEL } from "@/lib/subscription";

const PLANS = ["FREE", "BUSINESS", "ENTERPRISE"] as const;
type Plan = (typeof PLANS)[number];

export type PlanLimitRow = {
  id: string;
  plan: Plan;
  code: string;
  intValue: number | null;
  boolValue: boolean | null;
  highlighted: boolean;
};

export function PlanLimitsManager({ limits }: { limits: PlanLimitRow[] }) {
  // (plan, code) → row
  const map = new Map<string, PlanLimitRow>();
  for (const l of limits) map.set(`${l.plan}:${l.code}`, l);

  return (
    <div className="glass rounded-xl border border-white/[0.08] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-sm">Хязгаар (programmatic)</h2>
          <p className="text-xs text-white/40 mt-0.5">
            Эдгээр утгуудыг програм автоматаар шалгана. COUNT — хоосон бол
            хязгааргүй. BOOLEAN — checkbox.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {PLANS.map((p) => (
            <form key={p} action={resetPlanLimitsAction}>
              <input type="hidden" name="plan" value={p} />
              <button
                type="submit"
                className="text-[11px] text-white/40 hover:text-white/70 px-2 py-1 rounded hover:bg-white/[0.04] transition-colors"
                title={`${PLAN_LABEL[p]}-ийг default утга руу буцаах`}
              >
                ↻ {p}
              </button>
            </form>
          ))}
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="text-left text-xs text-white/40 font-medium px-4 py-2.5">
                Хязгаар
              </th>
              {PLANS.map((p) => (
                <th
                  key={p}
                  className="text-left text-xs text-white/40 font-medium px-4 py-2.5"
                >
                  {PLAN_LABEL[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(ALL_LIMIT_CODES as PlanLimitCode[]).map((code) => {
              const meta = PLAN_LIMIT_META[code];
              return (
                <tr
                  key={code}
                  className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 align-top">
                    <div className="text-white/90 font-medium">{meta.label}</div>
                    <div className="text-[11px] text-white/40 mt-0.5">
                      {meta.description}
                    </div>
                    <code className="text-[10px] text-violet-300/70 mt-0.5 inline-block">
                      {code}
                    </code>
                  </td>
                  {PLANS.map((p) => {
                    const row = map.get(`${p}:${code}`);
                    return (
                      <td key={p} className="px-4 py-3 align-top">
                        <LimitCell plan={p} code={code} row={row ?? null} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LimitCell({
  plan,
  code,
  row,
}: {
  plan: Plan;
  code: PlanLimitCode;
  row: PlanLimitRow | null;
}) {
  const meta = PLAN_LIMIT_META[code];
  const [intValue, setIntValue] = useState<string>(
    row?.intValue == null ? "" : String(row.intValue),
  );
  const [boolValue, setBoolValue] = useState<boolean>(row?.boolValue ?? false);
  const [highlighted, setHighlighted] = useState<boolean>(row?.highlighted ?? false);
  const [pending, setPending] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save() {
    setPending(true);
    setSavedAt(null);
    try {
      const fd = new FormData();
      fd.set("plan", plan);
      fd.set("code", code);
      if (meta.kind === "COUNT") fd.set("intValue", intValue);
      if (meta.kind === "BOOLEAN" && boolValue) fd.set("boolValue", "on");
      if (highlighted) fd.set("highlighted", "on");
      await updatePlanLimitAction(null, fd);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2000);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {meta.kind === "COUNT" ? (
        <input
          type="text"
          inputMode="numeric"
          value={intValue}
          onChange={(e) => setIntValue(e.target.value)}
          onBlur={save}
          placeholder="∞ хязгааргүй"
          className="compact-input !py-1 !text-sm w-full max-w-[7rem]"
        />
      ) : (
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={boolValue}
            onChange={(e) => {
              setBoolValue(e.target.checked);
            }}
            onBlur={save}
            className="accent-violet-500"
          />
          <span className="text-xs text-white/70">
            {boolValue ? "Нээлттэй" : "Хаалттай"}
          </span>
        </label>
      )}
      <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] text-white/40">
        <input
          type="checkbox"
          checked={highlighted}
          onChange={(e) => setHighlighted(e.target.checked)}
          onBlur={save}
          className="accent-violet-500 scale-75"
        />
        Тодруулах
      </label>
      <div className="text-[10px] h-3">
        {pending ? (
          <span className="text-violet-300">Хадгалж...</span>
        ) : savedAt ? (
          <span className="text-emerald-400">✓ Хадгалав</span>
        ) : null}
      </div>
    </div>
  );
}
