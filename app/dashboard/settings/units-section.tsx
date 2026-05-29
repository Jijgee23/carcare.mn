"use client";

import { useActionState, useState } from "react";
import {
  type UnitActionState,
  createUnitAction,
  deleteUnitAction,
  updateUnitAction,
} from "@/app/_actions/units";
import { Field, FormError } from "@/app/_components/auth-shell";
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
        <p className="text-xs text-white/40">
          Одоогоор нэгж бүртгэгдээгүй байна. Доороос шинэ нэгж нэмнэ үү.
        </p>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left text-xs text-white/40 font-medium px-4 py-2.5">
                  Нэр
                </th>
                <th className="text-left text-xs text-white/40 font-medium px-4 py-2.5 w-32">
                  Богино
                </th>
                <th className="text-left text-xs text-white/40 font-medium px-4 py-2.5 w-28">
                  Төлөв
                </th>
                <th className="px-4 py-2.5 w-40" />
              </tr>
            </thead>
            <tbody>
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
    <tr className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3 text-white/85">
        <div className="flex items-center gap-2">
          <span>{unit.name}</span>
          {system ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25">
              Систем
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 text-white/50 font-mono text-xs">
        {unit.code ?? "—"}
      </td>
      <td className="px-4 py-3">
        {unit.isActive ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Идэвхтэй
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.08]">
            Идэвхгүй
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-violet-500/10"
          >
            Засах
          </button>
          {system ? (
            <span
              className="text-xs text-white/25 px-2.5 py-1.5"
              title="Системийн default — устгаж болохгүй"
            >
              —
            </span>
          ) : (
            <form action={deleteUnitAction}>
              <input type="hidden" name="id" value={unit.id} />
              <button
                type="submit"
                className="text-xs text-red-400 hover:text-red-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/10"
              >
                Устгах
              </button>
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
    <tr className="border-b border-white/[0.04] last:border-0 bg-white/[0.02]">
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
              className={`compact-input ${fe.code ? "border-red-500/50" : ""}`}
            />
            <label
              className={`flex items-center gap-2 text-sm px-2 ${system ? "text-white/40" : "text-white/70"}`}
              title={system ? "Системийн нэгжийг идэвхгүй болгож болохгүй" : undefined}
            >
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={unit.isActive}
                disabled={system}
                className="accent-violet-500"
              />
              Идэвхтэй
            </label>
          </div>
          {fe.name ? <p className="text-red-400 text-xs">{fe.name}</p> : null}
          {fe.code ? <p className="text-red-400 text-xs">{fe.code}</p> : null}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg text-white/60 hover:text-white/90 hover:bg-white/[0.05] transition-colors"
            >
              Болих
            </button>
            <button
              type="submit"
              disabled={pending}
              className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 transition-colors font-medium"
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
      className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
      noValidate
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/80">Шинэ нэгж нэмэх</h3>
        {state?.ok && state.message ? (
          <span className="text-xs text-emerald-300">{state.message}</span>
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
            className={`compact-input ${fe.name ? "border-red-500/50" : ""}`}
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
            className={`compact-input ${fe.code ? "border-red-500/50" : ""}`}
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
        <div className="flex items-end pb-0.5">
          <button
            type="submit"
            disabled={pending}
            className="w-full sm:w-auto bg-violet-600 hover:bg-violet-500 disabled:opacity-60 transition-colors px-4 py-2 rounded-lg text-sm font-medium"
          >
            {pending ? "Нэмж..." : "Нэмэх"}
          </button>
        </div>
      </div>
    </form>
  );
}
