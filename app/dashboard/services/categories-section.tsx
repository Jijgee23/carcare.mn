"use client";

import { useActionState, useState } from "react";
import {
  type CategoryActionState,
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/_actions/categories";
import { Field, FormError } from "@/app/_components/auth-shell";
import { Btn, Chip, PlusIcon, TagChip } from "@/app/_components/landing-ops-ui";

export type BranchOption = { id: string; name: string };

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  servicesCount: number;
  branchIds: string[];
  durationMinutes: number | null;
};

export function CategoriesSection({
  categories,
  branches,
}: {
  categories: CategoryRow[];
  branches: BranchOption[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const branchName = (id: string) =>
    branches.find((b) => b.id === id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-5">
      {categories.length === 0 ? (
        <p className="text-xs text-[var(--oc-muted3)]">
          Одоогоор ангилал бүртгэгдээгүй байна. Доороос шинэ ангилал нэмнэ үү.
        </p>
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--oc-line)]">
                <th className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5">
                  Нэр
                </th>
                <th className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5">
                  Салбар
                </th>
                <th className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5 w-20">
                  Үйлчилгээ
                </th>
                <th className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5 w-28">
                  Хугацаа
                </th>
                <th className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5 w-28">
                  Төлөв
                </th>
                <th className="px-4 py-2.5 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--oc-line)]">
              {categories.map((c) =>
                editingId === c.id ? (
                  <EditRow
                    key={c.id}
                    category={c}
                    branches={branches}
                    onClose={() => setEditingId(null)}
                  />
                ) : (
                  <ViewRow
                    key={c.id}
                    category={c}
                    branchName={branchName}
                    onEdit={() => setEditingId(c.id)}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      <CreateForm branches={branches} />
    </div>
  );
}

function BranchPicker({
  branches,
  selected,
}: {
  branches: BranchOption[];
  selected: string[];
}) {
  if (branches.length === 0) {
    return (
      <p className="text-xs text-[var(--oc-muted4)]">
        Салбар бүртгэгдээгүй — ангилал бүх салбарт хамаарна.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-[var(--oc-muted3)]">
        Санал болгох салбар{" "}
        <span className="text-[var(--oc-muted4)]">(хоосон бол бүх салбарт)</span>
      </span>
      <div className="flex flex-wrap gap-2">
        {branches.map((b) => (
          <label
            key={b.id}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--oc-ink2)] border border-[var(--oc-line)] hover:border-[var(--oc-line2)] rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              name="branchIds"
              value={b.id}
              defaultChecked={selected.includes(b.id)}
              className="accent-[var(--oc-accent)]"
            />
            {b.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function ViewRow({
  category,
  branchName,
  onEdit,
}: {
  category: CategoryRow;
  branchName: (id: string) => string;
  onEdit: () => void;
}) {
  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3 text-[var(--oc-ink)]">
        {category.name}
        {category.description ? (
          <span className="block text-xs text-[var(--oc-muted3)] mt-0.5">
            {category.description}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-xs">
        {category.branchIds.length === 0 ? (
          <span className="text-[var(--oc-muted3)]">Бүх салбар</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {category.branchIds.map((id) => (
              <TagChip key={id}>{branchName(id)}</TagChip>
            ))}
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-plex-mono text-xs text-[var(--oc-muted2)]">
        {category.servicesCount}
      </td>
      <td className="px-4 py-3 font-plex-mono text-xs text-[var(--oc-muted2)]">
        {category.durationMinutes != null ? (
          `${category.durationMinutes} мин`
        ) : (
          <span className="text-[var(--oc-muted4)]" title="Тохируулаагүй — 30 мин">
            30 мин*
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <Chip tone={category.isActive ? "ok" : "neutral"}>
          {category.isActive ? "Идэвхтэй" : "Идэвхгүй"}
        </Chip>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[var(--oc-accent)]/10"
          >
            Засах
          </button>
          <form action={deleteCategoryAction}>
            <input type="hidden" name="id" value={category.id} />
            <button
              type="submit"
              className="text-xs text-red-400 hover:text-red-300 light:text-red-600 light:hover:text-red-700 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/10"
              title={
                category.servicesCount > 0
                  ? "Үйлчилгээнд ашиглагдсан тул архивлагдана"
                  : "Устгана"
              }
            >
              {category.servicesCount > 0 ? "Архив" : "Устгах"}
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}

function EditRow({
  category,
  branches,
  onClose,
}: {
  category: CategoryRow;
  branches: BranchOption[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    CategoryActionState,
    FormData
  >(updateCategoryAction.bind(null, category.id), null);

  if (state?.ok) {
    onClose();
  }

  const fe = state?.fieldErrors ?? {};

  return (
    <tr className="bg-[var(--oc-panel2)]">
      <td colSpan={6} className="px-4 py-3">
        <form action={formAction} className="flex flex-col gap-3" noValidate>
          {state?.message && !state.ok ? (
            <FormError message={state.message} />
          ) : null}
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto_auto]">
            <input
              name="name"
              type="text"
              required
              defaultValue={category.name}
              placeholder="Нэр"
              className={`auth-input ${fe.name ? "border-red-500/50" : ""}`}
            />
            <input
              name="description"
              type="text"
              defaultValue={category.description ?? ""}
              placeholder="Тайлбар"
              className={`auth-input ${fe.description ? "border-red-500/50" : ""}`}
            />
            <input
              name="durationMinutes"
              type="number"
              min={5}
              max={600}
              step={5}
              defaultValue={category.durationMinutes ?? ""}
              placeholder="Хугацаа (мин)"
              title="Онлайн захиалгын үргэлжлэх хугацаа (минут). Хоосон бол 30."
              className={`auth-input ${fe.durationMinutes ? "border-red-500/50" : ""}`}
            />
            <label className="flex items-center gap-2 text-sm text-[var(--oc-ink2)] px-2">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={category.isActive}
                className="accent-[var(--oc-accent)]"
              />
              Идэвхтэй
            </label>
          </div>
          {fe.name ? <p className="text-red-400 text-xs light:text-red-600">{fe.name}</p> : null}
          {fe.description ? (
            <p className="text-red-400 text-xs light:text-red-600">{fe.description}</p>
          ) : null}
          {fe.durationMinutes ? (
            <p className="text-red-400 text-xs light:text-red-600">{fe.durationMinutes}</p>
          ) : null}
          <BranchPicker branches={branches} selected={category.branchIds} />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg text-[var(--oc-muted2)] hover:text-[var(--oc-ink2)] hover:bg-white/[0.05] transition-colors"
            >
              Болих
            </button>
            <Btn type="submit" disabled={pending} size="sm">
              {pending ? "Хадгалж..." : "Хадгалах"}
            </Btn>
          </div>
        </form>
      </td>
    </tr>
  );
}

function CreateForm({ branches }: { branches: BranchOption[] }) {
  const [state, formAction, pending] = useActionState<
    CategoryActionState,
    FormData
  >(createCategoryAction, null);

  const fe = state?.fieldErrors ?? {};
  const formKey = state?.ok ? `created-${state.message ?? ""}` : "create";

  return (
    <form
      key={formKey}
      action={formAction}
      className="flex flex-col gap-3 rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel2)] p-4"
      noValidate
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--oc-ink2)]">Шинэ ангилал</h3>
        {state?.ok && state.message ? (
          <span className="text-xs text-[var(--oc-ok)]">{state.message}</span>
        ) : null}
      </div>

      {state?.message && !state.ok ? (
        <FormError message={state.message} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto_auto]">
        <Field label="Нэр" htmlFor="cat-name" error={fe.name}>
          <input
            id="cat-name"
            name="name"
            type="text"
            required
            placeholder="Хөдөлгүүр, Угаалга, Тоормос..."
            className={`auth-input ${fe.name ? "border-red-500/50" : ""}`}
          />
        </Field>
        <Field
          label="Тайлбар"
          htmlFor="cat-description"
          hint="заавал биш"
          error={fe.description}
        >
          <input
            id="cat-description"
            name="description"
            type="text"
            placeholder="Энэ ангилалд хамаарах үйлчилгээний тайлбар"
            className={`auth-input ${fe.description ? "border-red-500/50" : ""}`}
          />
        </Field>
        <Field
          label="Хугацаа"
          htmlFor="cat-duration"
          hint="мин, заавал биш"
          error={fe.durationMinutes}
        >
          <input
            id="cat-duration"
            name="durationMinutes"
            type="number"
            min={5}
            max={600}
            step={5}
            placeholder="30"
            title="Онлайн захиалгын үргэлжлэх хугацаа (минут). Хоосон бол 30."
            className={`auth-input ${fe.durationMinutes ? "border-red-500/50" : ""}`}
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
            <PlusIcon />
            {pending ? "Нэмж..." : "Нэмэх"}
          </Btn>
        </div>
      </div>

      <BranchPicker branches={branches} selected={[]} />
    </form>
  );
}
