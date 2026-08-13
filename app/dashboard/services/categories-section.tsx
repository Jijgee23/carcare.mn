"use client";

import { useActionState, useState } from "react";
import {
  type CategoryActionState,
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/_actions/categories";
import { Field, FormError } from "@/app/_components/auth-shell";

export type BranchOption = { id: string; name: string };

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  servicesCount: number;
  branchIds: string[];
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
        <p className="text-xs text-white/40">
          Одоогоор ангилал бүртгэгдээгүй байна. Доороос шинэ ангилал нэмнэ үү.
        </p>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left text-xs text-white/40 font-medium px-4 py-2.5">
                  Нэр
                </th>
                <th className="text-left text-xs text-white/40 font-medium px-4 py-2.5">
                  Салбар
                </th>
                <th className="text-left text-xs text-white/40 font-medium px-4 py-2.5 w-20">
                  Үйлчилгээ
                </th>
                <th className="text-left text-xs text-white/40 font-medium px-4 py-2.5 w-28">
                  Төлөв
                </th>
                <th className="px-4 py-2.5 w-40" />
              </tr>
            </thead>
            <tbody>
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
      <p className="text-xs text-white/30">
        Салбар бүртгэгдээгүй — ангилал бүх салбарт хамаарна.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-white/45">
        Санал болгох салбар{" "}
        <span className="text-white/25">(хоосон бол бүх салбарт)</span>
      </span>
      <div className="flex flex-wrap gap-2">
        {branches.map((b) => (
          <label
            key={b.id}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 border border-white/[0.08] hover:border-white/[0.15] rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              name="branchIds"
              value={b.id}
              defaultChecked={selected.includes(b.id)}
              className="accent-violet-500"
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
    <tr className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3 text-white/85">
        {category.name}
        {category.description ? (
          <span className="block text-xs text-white/40 mt-0.5">
            {category.description}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-white/60 text-xs">
        {category.branchIds.length === 0 ? (
          <span className="text-white/40">Бүх салбар</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {category.branchIds.map((id) => (
              <span
                key={id}
                className="px-1.5 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08]"
              >
                {branchName(id)}
              </span>
            ))}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-white/60 text-xs">
        {category.servicesCount}
      </td>
      <td className="px-4 py-3">
        {category.isActive ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 light:text-emerald-700">
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
            className="text-xs text-violet-400 hover:text-violet-300 light:text-violet-600 light:hover:text-violet-700 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-violet-500/10"
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
    <tr className="border-b border-white/[0.04] last:border-0 bg-white/[0.02]">
      <td colSpan={5} className="px-4 py-3">
        <form action={formAction} className="flex flex-col gap-3" noValidate>
          {state?.message && !state.ok ? (
            <FormError message={state.message} />
          ) : null}
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <input
              name="name"
              type="text"
              required
              defaultValue={category.name}
              placeholder="Нэр"
              className={`compact-input ${fe.name ? "border-red-500/50" : ""}`}
            />
            <input
              name="description"
              type="text"
              defaultValue={category.description ?? ""}
              placeholder="Тайлбар"
              className={`compact-input ${fe.description ? "border-red-500/50" : ""}`}
            />
            <label className="flex items-center gap-2 text-sm text-white/70 px-2">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={category.isActive}
                className="accent-violet-500"
              />
              Идэвхтэй
            </label>
          </div>
          {fe.name ? <p className="text-red-400 text-xs light:text-red-600">{fe.name}</p> : null}
          {fe.description ? (
            <p className="text-red-400 text-xs light:text-red-600">{fe.description}</p>
          ) : null}
          <BranchPicker branches={branches} selected={category.branchIds} />
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
      className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
      noValidate
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/80">Шинэ ангилал</h3>
        {state?.ok && state.message ? (
          <span className="text-xs text-emerald-300 light:text-emerald-700">{state.message}</span>
        ) : null}
      </div>

      {state?.message && !state.ok ? (
        <FormError message={state.message} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto]">
        <Field label="Нэр" htmlFor="cat-name" error={fe.name}>
          <input
            id="cat-name"
            name="name"
            type="text"
            required
            placeholder="Хөдөлгүүр, Угаалга, Тоормос..."
            className={`compact-input ${fe.name ? "border-red-500/50" : ""}`}
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
            className={`compact-input ${fe.description ? "border-red-500/50" : ""}`}
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

      <BranchPicker branches={branches} selected={[]} />
    </form>
  );
}
