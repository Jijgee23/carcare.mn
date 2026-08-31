"use client";

import { useActionState, useState } from "react";
import {
  type UnitActionState,
  createUnitAction,
  deleteUnitAction,
  updateUnitAction,
} from "@/app/_actions/units";
import { Field, FormError } from "@/app/_components/auth-shell";
import { Btn, Chip, TagChip } from "@/app/_components/landing-ops-ui";
import { SYSTEM_UNIT_NAMES } from "@/lib/units";

export type UnitRow = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

function isSystemUnit(name: string): boolean {
  return SYSTEM_UNIT_NAMES.has(name);
}

export function UnitsSection({ units }: { units: UnitRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      {units.length === 0 ? (
        <p className="text-xs text-[var(--oc-muted3)]">
          Одоогоор нэгж бүртгэгдээгүй байна. Доороос шинэ нэгж нэмнэ үү.
        </p>
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--oc-line)] bg-[var(--oc-panel2)]">
                <th className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5">
                  Нэр
                </th>
                <th className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5 w-32">
                  Богино
                </th>
                <th className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5 w-28">
                  Төлөв
                </th>
                <th className="px-4 py-2.5 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--oc-line)]">
              {units.map((u) =>
                editingId === u.id ? (
                  <EditRow
                    key={u.id}
                    unit={u}
                    onClose={() => setEditingId(null)}
                  />
                ) : (
                  <ViewRow
                    key={u.id}
                    unit={u}
                    onEdit={() => setEditingId(u.id)}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      <CreateForm />
    </div>
  );
}

function ViewRow({ unit, onEdit }: { unit: UnitRow; onEdit: () => void }) {
  const system = isSystemUnit(unit.name);
  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3 text-[var(--oc-ink)]">
        <div className="flex items-center gap-2">
          <span>{unit.name}</span>
          {system ? <TagChip>Систем</TagChip> : null}
        </div>
      </td>
      <td className="px-4 py-3 text-[var(--oc-muted2)] font-plex-mono text-xs">
        {unit.code ?? "—"}
      </td>
      <td className="px-4 py-3">
        <Chip tone={unit.isActive ? "ok" : "neutral"}>
          {unit.isActive ? "Идэвхтэй" : "Идэвхгүй"}
        </Chip>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Btn type="button" variant="ghost" size="sm" onClick={onEdit}>
            Засах
          </Btn>
          {system ? (
            <span
              className="text-xs text-[var(--oc-muted4)] px-2.5 py-1.5"
              title="Системийн default — устгаж болохгүй"
            >
              —
            </span>
          ) : (
            <form action={deleteUnitAction}>
              <input type="hidden" name="id" value={unit.id} />
              <Btn type="submit" variant="danger" size="sm">
                Устгах
              </Btn>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}

function EditRow({ unit, onClose }: { unit: UnitRow; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<
    UnitActionState,
    FormData
  >(updateUnitAction.bind(null, unit.id), null);

  if (state?.ok) {
    onClose();
  }

  const fe = state?.fieldErrors ?? {};
  const system = isSystemUnit(unit.name);

  return (
    <tr className="bg-white/[0.02]">
      <td colSpan={4} className="px-4 py-3">
        <form action={formAction} className="flex flex-col gap-2" noValidate>
          {state?.message && !state.ok ? (
            <FormError message={state.message} />
          ) : null}
          <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
            <input
              name="name"
              type="text"
              required
              defaultValue={unit.name}
              placeholder="Нэр"
              readOnly={system}
              className={`auth-input ${fe.name ? "border-red-500/50" : ""} ${system ? "opacity-60 cursor-not-allowed" : ""}`}
            />
            <input
              name="code"
              type="text"
              defaultValue={unit.code ?? ""}
              placeholder="Богино"
              className={`auth-input ${fe.code ? "border-red-500/50" : ""}`}
            />
            <label
              className={`flex items-center gap-2 text-sm px-2 ${system ? "text-[var(--oc-muted3)]" : "text-[var(--oc-ink2)]"}`}
              title={system ? "Системийн нэгжийг идэвхгүй болгож болохгүй" : undefined}
            >
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={unit.isActive}
                disabled={system}
                className="accent-[var(--oc-accent)]"
              />
              Идэвхтэй
            </label>
          </div>
          {fe.name ? <p className="text-red-400 text-xs light:text-red-600">{fe.name}</p> : null}
          {fe.code ? <p className="text-red-400 text-xs light:text-red-600">{fe.code}</p> : null}
          <div className="flex gap-2 justify-end">
            <Btn type="button" variant="ghost" size="sm" onClick={onClose}>
              Болих
            </Btn>
            <Btn type="submit" size="sm" disabled={pending}>
              {pending ? "Хадгалж..." : "Хадгалах"}
            </Btn>
          </div>
        </form>
      </td>
    </tr>
  );
}

function CreateForm() {
  const [state, formAction, pending] = useActionState<
    UnitActionState,
    FormData
  >(createUnitAction, null);

  const fe = state?.fieldErrors ?? {};
  // Амжилттай нэмэгдсэний дараа form-ыг тэг болгох
  const formKey = state?.ok ? `created-${state.message ?? ""}-${Math.random()}` : "create";

  return (
    <form
      key={formKey}
      action={formAction}
      className="flex flex-col gap-3 rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel2)] p-4"
      noValidate
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--oc-ink2)]">Шинэ нэгж нэмэх</h3>
        {state?.ok && state.message ? (
          <span className="text-xs text-[var(--oc-ok)]">{state.message}</span>
        ) : null}
      </div>

      {state?.message && !state.ok ? (
        <FormError message={state.message} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto_auto]">
        <Field label="Нэр" htmlFor="unit-name" error={fe.name}>
          <input
            id="unit-name"
            name="name"
            type="text"
            required
            placeholder="ширхэг, цаг, литр..."
            className={`auth-input ${fe.name ? "border-red-500/50" : ""}`}
          />
        </Field>
        <Field
          label="Богино"
          htmlFor="unit-code"
          hint="заавал биш"
          error={fe.code}
        >
          <input
            id="unit-code"
            name="code"
            type="text"
            placeholder="ш, ц, л"
            className={`auth-input ${fe.code ? "border-red-500/50" : ""}`}
          />
        </Field>
        <label className="flex items-end gap-2 text-sm text-[var(--oc-ink2)] pb-2.5">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked
            className="accent-[var(--oc-accent)]"
          />
          Идэвхтэй
        </label>
        <div className="flex items-end pb-0.5">
          <Btn type="submit" disabled={pending} size="sm" className="w-full sm:w-auto">
            {pending ? "Нэмж..." : "Нэмэх"}
          </Btn>
        </div>
      </div>
    </form>
  );
}
