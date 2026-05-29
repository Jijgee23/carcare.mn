"use client";

import { useActionState, useState } from "react";
import {
  type PlanFeatureActionState,
  createPlanFeatureAction,
  deletePlanFeatureAction,
  updatePlanFeatureAction,
} from "@/app/_actions/system-plan-features";
import { Field, FormError } from "@/app/_components/auth-shell";
import { PLAN_LABEL } from "@/lib/subscription";

const PLANS: ("FREE" | "BUSINESS" | "ENTERPRISE")[] = [
  "FREE",
  "BUSINESS",
  "ENTERPRISE",
];

export type PlanFeatureRow = {
  id: string;
  plan: "FREE" | "BUSINESS" | "ENTERPRISE";
  label: string;
  value: string;
  description: string | null;
  sortOrder: number;
  highlighted: boolean;
};

export function PlanFeaturesManager({
  features,
}: {
  features: PlanFeatureRow[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const byPlan: Record<string, PlanFeatureRow[]> = { FREE: [], BUSINESS: [], ENTERPRISE: [] };
  for (const f of features) byPlan[f.plan].push(f);

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p}
            className="glass rounded-2xl border border-white/[0.08] overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <div className="font-semibold text-white">{PLAN_LABEL[p]}</div>
              <span className="text-xs text-white/40">
                {byPlan[p].length} боломж
              </span>
            </div>
            <ul className="divide-y divide-white/[0.04]">
              {byPlan[p].length === 0 ? (
                <li className="px-4 py-6 text-xs text-white/40 text-center">
                  Бичигдээгүй.
                </li>
              ) : (
                byPlan[p].map((f) =>
                  editingId === f.id ? (
                    <EditRow
                      key={f.id}
                      feature={f}
                      onClose={() => setEditingId(null)}
                    />
                  ) : (
                    <ViewRow
                      key={f.id}
                      feature={f}
                      onEdit={() => setEditingId(f.id)}
                    />
                  ),
                )
              )}
            </ul>
          </div>
        ))}
      </section>

      <section className="glass rounded-2xl p-6 border border-white/[0.08]">
        <h2 className="font-semibold mb-1">Шинэ боломж нэмэх</h2>
        <p className="text-xs text-white/40 mb-5">
          Тенант "Багц авах" хуудаст энэ жагсаалтыг хардаг.
        </p>
        <CreateForm />
      </section>
    </div>
  );
}

function ViewRow({
  feature,
  onEdit,
}: {
  feature: PlanFeatureRow;
  onEdit: () => void;
}) {
  return (
    <li className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/85 truncate">
            {feature.label}
          </span>
          {feature.highlighted ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25">
              Тод
            </span>
          ) : null}
        </div>
        <div className="text-xs text-white/50 mt-0.5">{feature.value}</div>
        {feature.description ? (
          <div className="text-[11px] text-white/30 mt-0.5 line-clamp-2">
            {feature.description}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-violet-400 hover:text-violet-300 px-2 py-1 rounded hover:bg-violet-500/10"
        >
          Засах
        </button>
        <form action={deletePlanFeatureAction}>
          <input type="hidden" name="id" value={feature.id} />
          <button
            type="submit"
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10"
          >
            ✕
          </button>
        </form>
      </div>
    </li>
  );
}

function EditRow({
  feature,
  onClose,
}: {
  feature: PlanFeatureRow;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    PlanFeatureActionState,
    FormData
  >(updatePlanFeatureAction.bind(null, feature.id), null);
  if (state?.ok) onClose();
  const fe = state?.fieldErrors ?? {};

  return (
    <li className="px-4 py-3 bg-white/[0.02]">
      <form action={formAction} className="flex flex-col gap-2" noValidate>
        {state?.message && !state.ok ? (
          <FormError message={state.message} />
        ) : null}
        <select
          name="plan"
          defaultValue={feature.plan}
          className="auth-input !py-1.5 !text-xs"
        >
          {PLANS.map((p) => (
            <option key={p} value={p} className="bg-[#0d0d14]">
              {PLAN_LABEL[p]}
            </option>
          ))}
        </select>
        <input
          name="label"
          defaultValue={feature.label}
          placeholder="Боломжийн нэр"
          className={`auth-input !py-1.5 !text-xs ${fe.label ? "border-red-500/50" : ""}`}
        />
        <input
          name="value"
          defaultValue={feature.value}
          placeholder="Утга — 20, Хязгааргүй, Тийм, ..."
          className={`auth-input !py-1.5 !text-xs ${fe.value ? "border-red-500/50" : ""}`}
        />
        <input
          name="description"
          defaultValue={feature.description ?? ""}
          placeholder="Тайлбар"
          className="auth-input !py-1.5 !text-xs"
        />
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1 text-white/70">
            <span>Эрэмбэ</span>
            <input
              type="number"
              name="sortOrder"
              defaultValue={feature.sortOrder}
              className="auth-input !py-1 !text-xs w-16"
            />
          </label>
          <label className="flex items-center gap-1 text-white/70">
            <input
              type="checkbox"
              name="highlighted"
              defaultChecked={feature.highlighted}
              className="accent-violet-500"
            />
            Тод
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-white/60 hover:text-white/90 px-2 py-1"
          >
            Болих
          </button>
          <button
            type="submit"
            disabled={pending}
            className="text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-60 px-3 py-1 rounded"
          >
            {pending ? "..." : "Хадгалах"}
          </button>
        </div>
      </form>
    </li>
  );
}

function CreateForm() {
  const [state, formAction, pending] = useActionState<
    PlanFeatureActionState,
    FormData
  >(createPlanFeatureAction, null);
  const fe = state?.fieldErrors ?? {};
  const formKey = state?.ok ? `created-${Math.random()}` : "create";

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-3" noValidate>
      {state?.ok && state.message ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-sm text-emerald-300">
          {state.message}
        </div>
      ) : null}
      {state?.message && !state.ok ? (
        <FormError message={state.message} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Багц" htmlFor="pf-plan" error={fe.plan}>
          <select id="pf-plan" name="plan" required className="auth-input">
            {PLANS.map((p) => (
              <option key={p} value={p} className="bg-[#0d0d14]">
                {PLAN_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Боломж" htmlFor="pf-label" error={fe.label}>
          <input
            id="pf-label"
            name="label"
            type="text"
            required
            className={`auth-input ${fe.label ? "border-red-500/50" : ""}`}
            placeholder="Хамгийн их хэрэглэгч"
          />
        </Field>
        <Field label="Утга" htmlFor="pf-value" error={fe.value}>
          <input
            id="pf-value"
            name="value"
            type="text"
            required
            className={`auth-input ${fe.value ? "border-red-500/50" : ""}`}
            placeholder="20, Хязгааргүй, Тийм, ..."
          />
        </Field>
        <Field
          label="Эрэмбэ"
          htmlFor="pf-sort"
          hint="бага → дээр"
          error={fe.sortOrder}
        >
          <input
            id="pf-sort"
            name="sortOrder"
            type="number"
            defaultValue={0}
            className="auth-input"
          />
        </Field>
      </div>

      <Field label="Тайлбар" htmlFor="pf-desc" hint="заавал биш">
        <input
          id="pf-desc"
          name="description"
          type="text"
          className="auth-input"
          placeholder="Жишээ: Олон салбартай ажиллахад тохирно"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-white/70">
        <input
          type="checkbox"
          name="highlighted"
          className="accent-violet-500"
        />
        Тод (тенант хуудаст онцлоход харагдана)
      </label>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 px-4 py-2.5 rounded-xl text-sm font-medium"
        >
          {pending ? "Нэмж..." : "Боломж нэмэх"}
        </button>
      </div>
    </form>
  );
}
