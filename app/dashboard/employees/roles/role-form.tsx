"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  type RoleActionState,
  createRoleAction,
  updateRoleAction,
} from "@/app/_actions/roles";
import { Field, FormError } from "@/app/_components/auth-shell";

type ResourceRow = {
  key: string;
  label: string;
  group: string;
};

type ActionCol = {
  key: string;
  label: string;
};

type StandaloneItem = {
  code: string;
  label: string;
  description: string;
};

type Initial = {
  id?: string;
  name: string;
  description: string | null;
  permissions: string[];
  isActive: boolean;
};

export function RoleForm({
  initial,
  resources,
  actions,
  standalonePermissions,
}: {
  initial?: Initial;
  resources: ResourceRow[];
  actions: ActionCol[];
  standalonePermissions: StandaloneItem[];
}) {
  const isEdit = Boolean(initial?.id);
  const action = isEdit
    ? updateRoleAction.bind(null, initial!.id!)
    : createRoleAction;

  const [state, formAction, pending] = useActionState<RoleActionState, FormData>(
    action,
    null,
  );

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initial?.permissions ?? []),
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleResourceRow(resourceKey: string, allOn: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const a of actions) {
        const code = `${resourceKey}.${a.key}`;
        if (allOn) next.delete(code);
        else next.add(code);
      }
      return next;
    });
  }

  function toggleActionColumn(actionKey: string, allOn: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of resources) {
        const code = `${r.key}.${actionKey}`;
        if (allOn) next.delete(code);
        else next.add(code);
      }
      return next;
    });
  }

  function toggleAllCrud(allOn: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of resources) {
        for (const a of actions) {
          const code = `${r.key}.${a.key}`;
          if (allOn) next.delete(code);
          else next.add(code);
        }
      }
      return next;
    });
  }

  // Group resources by their group label (Удирдлага / Үндсэн / ...)
  const grouped = useMemo(() => {
    const map = new Map<string, ResourceRow[]>();
    for (const r of resources) {
      const arr = map.get(r.group) ?? [];
      arr.push(r);
      map.set(r.group, arr);
    }
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  }, [resources]);

  const fe = state?.fieldErrors ?? {};

  // Statistics for action-column toggle indicators
  const columnSelectedCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of actions) {
      counts[a.key] = resources.reduce(
        (acc, r) => acc + (selected.has(`${r.key}.${a.key}`) ? 1 : 0),
        0,
      );
    }
    return counts;
  }, [selected, resources, actions]);

  const totalCrud = resources.length * actions.length;
  const totalCrudSelected = useMemo(() => {
    let c = 0;
    for (const r of resources) {
      for (const a of actions) {
        if (selected.has(`${r.key}.${a.key}`)) c++;
      }
    }
    return c;
  }, [selected, resources, actions]);
  const allCrudOn = totalCrudSelected === totalCrud;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormError message={state?.message} />

      {/* Submit-ийн үед selected төлөв-ийг hidden input-аар илгээнэ */}
      {Array.from(selected).map((code) => (
        <input key={code} type="hidden" name="permissions" value={code} />
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Үүргийн нэр" htmlFor="name" error={fe.name}>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`compact-input ${fe.name ? "border-red-500/50" : ""}`}
            placeholder="ж: Менежер, Кассчин, Засварчин"
          />
        </Field>
        <Field
          label="Тайлбар"
          htmlFor="description"
          hint="Энэ үүрэг юу хийдгийг богино тайлбарлана уу."
        >
          <input
            id="description"
            name="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="compact-input"
            placeholder="Хоосон үлдэж болно"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white/90">
              Хийх боломжтой үйлдлүүд
            </h3>
            <p className="text-xs text-white/40 mt-0.5">
              Нөөц бүрд харах, үүсгэх, засах, устгах эрхийг тус тусдаа сонгоно.
            </p>
          </div>
          {fe.permissions ? (
            <p className="text-red-400 text-xs">{fe.permissions}</p>
          ) : null}
        </div>

        {/* CRUD matrix */}
        <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left text-xs text-white/40 font-medium px-4 py-2.5">
                    Нөөц
                  </th>
                  {actions.map((a) => {
                    const count = columnSelectedCount[a.key] ?? 0;
                    const allOn = count === resources.length;
                    return (
                      <th
                        key={a.key}
                        className="text-center text-xs font-medium px-3 py-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => toggleActionColumn(a.key, allOn)}
                          className={`inline-flex flex-col items-center gap-0.5 transition-colors ${
                            allOn
                              ? "text-violet-300"
                              : "text-white/40 hover:text-white/70"
                          }`}
                          title={
                            allOn
                              ? `Бүх "${a.label}" эрхийг хасах`
                              : `Бүх нөөцөд "${a.label}" эрх олгох`
                          }
                        >
                          <span>{a.label}</span>
                          <span className="text-[10px] text-white/30">
                            {count}/{resources.length}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                  <th className="text-center text-xs text-white/40 font-medium px-3 py-2.5 w-24">
                    <button
                      type="button"
                      onClick={() => toggleAllCrud(allCrudOn)}
                      className="text-violet-300 hover:text-violet-200 transition-colors"
                      title={allCrudOn ? "Бүгдийг хасах" : "Бүгдийг сонгох"}
                    >
                      {allCrudOn ? "Бүгдийг хасах" : "Бүгдийг сонгох"}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((g) => (
                  <RowGroup
                    key={g.group}
                    group={g.group}
                    resources={g.items}
                    actions={actions}
                    selected={selected}
                    onToggle={toggle}
                    onToggleRow={toggleResourceRow}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Standalone permissions */}
        {standalonePermissions.length > 0 ? (
          <div className="glass rounded-xl p-4 border border-white/[0.06]">
            <div className="text-xs uppercase tracking-wider text-white/40 font-medium mb-3">
              Тусгай эрхүүд
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {standalonePermissions.map((p) => {
                const checked = selected.has(p.code);
                return (
                  <label
                    key={p.code}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? "border-violet-500/40 bg-violet-500/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(p.code)}
                      className="mt-0.5 accent-violet-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white/90">
                        {p.label}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">
                        {p.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <label className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] max-w-md">
        <input
          type="checkbox"
          name="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          value="on"
          className="mt-0.5 accent-violet-500"
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-white/90">Идэвхтэй</div>
          <div className="text-xs text-white/40 mt-0.5">
            Идэвхгүй үүргийг шинэ ажилтанд сонгох боломжгүй.
          </div>
        </div>
      </label>
      {!isActive ? <input type="hidden" name="isActive" value="off" /> : null}

      <div className="flex gap-2 pt-3 border-t border-white/[0.05]">
        <Link
          href="/dashboard/employees/roles"
          className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all px-5 py-2 rounded-lg font-medium text-sm text-white/60 text-center"
        >
          ← Буцах
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all px-6 py-2 rounded-lg font-medium text-sm"
        >
          {pending ? "..." : isEdit ? "Хадгалах" : "Үүсгэх"}
        </button>
      </div>
    </form>
  );
}

function RowGroup({
  group,
  resources,
  actions,
  selected,
  onToggle,
  onToggleRow,
}: {
  group: string;
  resources: ResourceRow[];
  actions: ActionCol[];
  selected: Set<string>;
  onToggle: (code: string) => void;
  onToggleRow: (resourceKey: string, allOn: boolean) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={actions.length + 2}
          className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-white/30 font-medium border-t border-white/[0.04]"
        >
          {group}
        </td>
      </tr>
      {resources.map((r) => {
        const rowCount = actions.reduce(
          (acc, a) => acc + (selected.has(`${r.key}.${a.key}`) ? 1 : 0),
          0,
        );
        const allOn = rowCount === actions.length;
        return (
          <tr
            key={r.key}
            className="border-t border-white/[0.04] hover:bg-white/[0.02]"
          >
            <td className="px-4 py-2.5">
              <span className="text-sm text-white/85">{r.label}</span>
            </td>
            {actions.map((a) => {
              const code = `${r.key}.${a.key}`;
              const checked = selected.has(code);
              return (
                <td key={a.key} className="px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(code)}
                    className="accent-violet-500 w-4 h-4 cursor-pointer"
                    aria-label={`${r.label} — ${a.label}`}
                  />
                </td>
              );
            })}
            <td className="px-3 py-2.5 text-center">
              <button
                type="button"
                onClick={() => onToggleRow(r.key, allOn)}
                className={`text-xs transition-colors ${
                  allOn
                    ? "text-violet-300 hover:text-violet-200"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {allOn ? "Хасах" : "Бүгд"}
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}
