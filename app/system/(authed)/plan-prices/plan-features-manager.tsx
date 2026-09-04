"use client";

import { useActionState, useState } from "react";
import {
  type PlanFeatureActionState,
  createPlanFeatureAction,
  deletePlanFeatureAction,
  updatePlanFeatureAction,
} from "@/app/_actions/system-plan-features";
import { Field, FormError } from "@/app/_components/landing-ops-ui";
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
            className="rounded-2xl border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[var(--oc-line2)] flex items-center justify-between">
              <div className="font-semibold text-[var(--oc-ink)]">{PLAN_LABEL[p]}</div>
              <span className="text-xs text-[var(--oc-muted3)]">
                {byPlan[p].length} боломж
              </span>
            </div>
            <ul className="divide-y divide-[var(--oc-line2)]">
              {byPlan[p].length === 0 ? (
                <li className="px-4 py-6 text-xs text-[var(--oc-muted3)] text-center">
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

      <section className="rounded-2xl border border-[var(--oc-line)] bg-[var(--oc-panel)] p-6">
        <h2 className="font-semibold text-[var(--oc-ink)] mb-1">Шинэ боломж нэмэх</h2>
        <p className="text-xs text-[var(--oc-muted3)] mb-5">
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
          <span className="text-sm text-[var(--oc-ink2)] truncate">
            {feature.label}
          </span>
          {feature.highlighted ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/25 light:bg-red-100 light:border-red-300 light:text-red-700">
              Тод
            </span>
          ) : null}
        </div>
        <div className="text-xs text-[var(--oc-muted)] mt-0.5">{feature.value}</div>
        {feature.description ? (
          <div className="text-[11px] text-[var(--oc-muted3)] mt-0.5 line-clamp-2">
            {feature.description}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-[var(--oc-muted)] hover:text-[var(--oc-ink)] px-2 py-1 rounded hover:bg-white/[0.06]"
        >
          Засах
        </button>
        <form action={deletePlanFeatureAction}>
          <input type="hidden" name="id" value={feature.id} />
          <button
            type="submit"
            className="text-xs text-red-400 hover:text-red-300 light:text-red-600 light:hover:text-red-700 px-2 py-1 rounded hover:bg-red-500/10"
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
    <li className="px-4 py-3 bg-[var(--oc-panel2)]">
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
            <option key={p} value={p} className="bg-[var(--surface)]">
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
          <label className="flex items-center gap-1 text-[var(--oc-muted)]">
            <span>Эрэмбэ</span>
            <input
              type="number"
              name="sortOrder"
              defaultValue={feature.sortOrder}
              className="auth-input !py-1 !text-xs w-16"
            />
          </label>
          <label className="flex items-center gap-1 text-[var(--oc-muted)]">
            <input
              type="checkbox"
              name="highlighted"
              defaultChecked={feature.highlighted}
              className="accent-red-500"
            />
            Тод
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--oc-muted)] hover:text-[var(--oc-ink)] px-2 py-1"
          >
            Болих
          </button>
          <button
            type="submit"
            disabled={pending}
            className="text-xs bg-red-600 hover:bg-red-500 text-white disabled:opacity-60 px-3 py-1 rounded"
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
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-sm text-emerald-300 light:bg-emerald-100 light:border-emerald-300 light:text-emerald-700">
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
              <option key={p} value={p} className="bg-[var(--surface)]">
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

      <label className="flex items-center gap-2 text-sm text-[var(--oc-muted)]">
        <input
          type="checkbox"
          name="highlighted"
          className="accent-red-500"
        />
        Тод (тенант хуудаст онцлоход харагдана)
      </label>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="bg-red-600 hover:bg-red-500 text-white disabled:opacity-60 px-4 py-2.5 rounded-xl text-sm font-medium"
        >
          {pending ? "Нэмж..." : "Боломж нэмэх"}
        </button>
      </div>
    </form>
  );
}
