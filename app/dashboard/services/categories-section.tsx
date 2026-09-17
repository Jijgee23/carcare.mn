"use client";

import { useActionState, useEffect, useState } from "react";
import {
  type CategoryActionState,
  bulkChangeCategorySystemKeyAction,
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/_actions/categories";
import type { BulkActionState } from "@/lib/bulk-action";
import { FormError } from "@/app/_components/auth-shell";
import { ConfirmForm } from "@/app/_components/confirm-form";
import { Btn, Chip, PlusIcon, TagChip } from "@/app/_components/landing-ops-ui";
import { Modal } from "@/app/_components/modal";
import { Select } from "@/app/_components/select";
import { useToast } from "@/app/_components/toast";
import { formatDuration } from "@/lib/category-duration";
import { DurationHmInput } from "./duration-input";

export type BranchOption = { id: string; name: string };
export type ServiceKeyOption = { id: string; name: string };

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  servicesCount: number;
  branchIds: string[];
  durationMinutes: number | null;
  concurrentCapacity: number;
  systemServiceKeyId: string;
};

export function CategoriesSection({
  categories,
  branches,
  serviceKeys,
}: {
  categories: CategoryRow[];
  branches: BranchOption[];
  serviceKeys: ServiceKeyOption[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [keyPickerOpen, setKeyPickerOpen] = useState(false);
  const branchName = (id: string) =>
    branches.find((b) => b.id === id)?.name ?? "—";
  const serviceKeyName = (id: string) =>
    serviceKeys.find((k) => k.id === id)?.name ?? null;

  const allSelected =
    categories.length > 0 && categories.every((c) => selected.has(c.id));

  function toggleAll() {
    setSelected((prev) => {
      if (categories.length > 0 && categories.every((c) => prev.has(c.id))) {
        return new Set();
      }
      return new Set(categories.map((c) => c.id));
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-[var(--oc-ink)] text-sm">Ангиллууд</h2>
        <Btn
          type="button"
          size="sm"
          onClick={() => {
            setEditingId(null);
            setIsCreating(true);
          }}
        >
          <PlusIcon />
          Ангилал нэмэх
        </Btn>
      </div>

      {categories.length === 0 && !isCreating ? (
        <p className="text-xs text-[var(--oc-muted3)]">
          Одоогоор ангилал бүртгэгдээгүй байна. Дээрх товчоор шинэ ангилал нэмнэ үү.
        </p>
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden overflow-x-auto">
          {selected.size > 0 ? (
            <div
              data-stop-row-click
              className="px-4 py-2.5 border-b border-[var(--oc-line)] flex flex-wrap items-center gap-3 text-xs text-[var(--oc-muted3)]"
            >
              <span>{selected.size} ангилал сонгогдсон</span>
              <Btn
                type="button"
                size="sm"
                disabled={serviceKeys.length === 0}
                title={serviceKeys.length === 0 ? "Идэвхтэй системийн ангилал алга." : undefined}
                onClick={() => setKeyPickerOpen(true)}
              >
                Системийн түлхүүр солих
              </Btn>
              <button
                type="button"
                onClick={clearSelection}
                className="text-[var(--oc-muted3)] hover:text-[var(--oc-ink2)] underline underline-offset-2"
              >
                Сонголт цэвэрлэх
              </button>
            </div>
          ) : null}
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--oc-line)]">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Бүгдийг сонгох"
                  />
                </th>
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
                <th
                  className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5 w-20"
                  title="Нэг зэрэг хэдэн захиалга авах боломжтой"
                >
                  Багтаамж
                </th>
                <th className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5 w-28">
                  Төлөв
                </th>
                <th className="px-4 py-2.5 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--oc-line)]">
              {isCreating ? (
                <CategoryFormRow
                  category={null}
                  branches={branches}
                  serviceKeys={serviceKeys}
                  onClose={() => setIsCreating(false)}
                />
              ) : null}
              {categories.map((c) =>
                editingId === c.id ? (
                  <CategoryFormRow
                    key={c.id}
                    category={c}
                    branches={branches}
                    serviceKeys={serviceKeys}
                    onClose={() => setEditingId(null)}
                  />
                ) : (
                  <ViewRow
                    key={c.id}
                    category={c}
                    branchName={branchName}
                    serviceKeyName={serviceKeyName}
                    checked={selected.has(c.id)}
                    onToggle={() => toggleOne(c.id)}
                    onEdit={() => {
                      setIsCreating(false);
                      setEditingId(c.id);
                    }}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {keyPickerOpen ? (
        <BulkServiceKeyModal
          categoryIds={[...selected]}
          serviceKeys={serviceKeys}
          onClose={() => setKeyPickerOpen(false)}
          onDone={() => {
            setKeyPickerOpen(false);
            clearSelection();
          }}
        />
      ) : null}
    </div>
  );
}

function BulkServiceKeyModal({
  categoryIds,
  serviceKeys,
  onClose,
  onDone,
}: {
  categoryIds: string[];
  serviceKeys: ServiceKeyOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<BulkActionState, FormData>(
    bulkChangeCategorySystemKeyAction,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.failed) {
        toast.warning("Хэсэгчлэн амжилттай", state.message);
      } else {
        toast.success("Амжилттай", state.message);
      }
      onDone();
    } else if (state.message) {
      toast.error("Алдаа гарлаа", state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal open onClose={onClose} title="Системийн түлхүүр солих" widthClassName="max-w-md">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="categoryIdsJson" value={JSON.stringify(categoryIds)} />
        <p className="text-sm text-[var(--oc-muted2)]">
          {categoryIds.length} ангиллын системийн түлхүүрийг нэг зэрэг солих гэж байна.
        </p>
        <div>
          <label className="text-xs text-[var(--oc-muted3)] mb-1 block">
            Системийн түлхүүр
          </label>
          <Select
            name="systemServiceKeyId"
            required
            placeholder="— Түлхүүр сонгох —"
            options={serviceKeys.map((k) => ({ value: k.id, label: k.name }))}
          />
        </div>
        {state && !state.ok && state.errors?.length ? (
          <ul className="text-xs text-red-400 light:text-red-600 flex flex-col gap-0.5 max-h-32 overflow-auto">
            {state.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex justify-end gap-2">
          <Btn type="button" variant="ghost" onClick={onClose}>
            Болих
          </Btn>
          <Btn type="submit" disabled={pending}>
            {pending ? "Хадгалж..." : "Хадгалах"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

function ServiceKeyPicker({
  serviceKeys,
  defaultValue,
  error,
}: {
  serviceKeys: ServiceKeyOption[];
  defaultValue: string | null;
  error?: string;
}) {
  if (serviceKeys.length === 0) {
    return (
      <p className="text-xs text-[var(--oc-muted4)]">
        Системийн ангилал алга байна — системийн админтай холбогдоно уу.
      </p>
    );
  }
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-[var(--oc-muted3)]">
        Системийн ангилал{" "}
        <span className="text-[var(--oc-muted4)]">
          (байгууллага сонгохоос өмнөх нийтэд нээлттэй хайлтад ашиглана)
        </span>
      </span>
      <select
        name="systemServiceKeyId"
        required
        defaultValue={defaultValue ?? ""}
        className={`auth-input max-w-xs ${error ? "border-red-500/50" : ""}`}
      >
        <option value="" disabled>
          — Сонгох —
        </option>
        {serviceKeys.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-red-400 text-xs light:text-red-600">{error}</p>
      ) : null}
    </label>
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
  serviceKeyName,
  checked,
  onToggle,
  onEdit,
}: {
  category: CategoryRow;
  branchName: (id: string) => string;
  serviceKeyName: (id: string) => string | null;
  checked: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const keyName = serviceKeyName(category.systemServiceKeyId);
  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="w-10 px-3 py-3" data-stop-row-click>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`${category.name} сонгох`}
        />
      </td>
      <td className="px-4 py-3 text-[var(--oc-ink)]">
        {category.name}
        {category.description ? (
          <span className="block text-xs text-[var(--oc-muted3)] mt-0.5">
            {category.description}
          </span>
        ) : null}
        {keyName ? (
          <span className="inline-block mt-1">
            <TagChip>{keyName}</TagChip>
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
          formatDuration(category.durationMinutes)
        ) : (
          <span className="text-[var(--oc-muted4)]" title="Тохируулаагүй — 30 мин">
            30 мин*
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-plex-mono text-xs text-[var(--oc-muted2)]">
        {category.concurrentCapacity}
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
          <ConfirmForm
            action={deleteCategoryAction}
            message={
              category.servicesCount > 0
                ? `\"${category.name}\" ангиллыг архивлах уу?`
                : `\"${category.name}\" ангиллыг устгах уу?`
            }
          >
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
          </ConfirmForm>
        </div>
      </td>
    </tr>
  );
}

// Ангилал засах БОЛОН шинээр үүсгэх хоёуланд ашиглана (`category=null`
// бол үүсгэх горим) — ижил хэлбэртэй байлгахын тулд нэг л component.
function CategoryFormRow({
  category,
  branches,
  serviceKeys,
  onClose,
}: {
  category: CategoryRow | null;
  branches: BranchOption[];
  serviceKeys: ServiceKeyOption[];
  onClose: () => void;
}) {
  const isEdit = category !== null;
  const action = isEdit
    ? updateCategoryAction.bind(null, category.id)
    : createCategoryAction;
  const [state, formAction, pending] = useActionState<
    CategoryActionState,
    FormData
  >(action, null);

  // `onClose` нь эцэг компонентийн setState дуудна — render үеэр шууд дуудвал
  // "Cannot update a component while rendering a different component" алдаа
  // өгдөг тул commit-ийн дараах effect-д хойшлуулна.
  useEffect(() => {
    if (state?.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fe = state?.fieldErrors ?? {};
  // Шинээр үүсгэхэд "Ерөнхий" түлхүүрийг анхны утга болгоно — ихэнх тенант
  // тодорхой түлхүүр байхгүй бол ч ямар нэг утга сонгосон байх ёстой.
  const defaultServiceKeyId =
    category?.systemServiceKeyId ??
    serviceKeys.find((k) => k.name === "Ерөнхий")?.id ??
    serviceKeys[0]?.id ??
    null;

  return (
    <tr className="bg-[var(--oc-panel2)]">
      <td colSpan={8} className="px-4 py-3">
        <form action={formAction} className="flex flex-col gap-3" noValidate>
          {state?.message && !state.ok ? (
            <FormError message={state.message} />
          ) : null}
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto_auto_auto]">
            <input
              name="name"
              type="text"
              required
              defaultValue={category?.name}
              placeholder="Нэр"
              className={`auth-input ${fe.name ? "border-red-500/50" : ""}`}
            />
            <input
              name="description"
              type="text"
              defaultValue={category?.description ?? ""}
              placeholder="Тайлбар"
              className={`auth-input ${fe.description ? "border-red-500/50" : ""}`}
            />
            <div
              className="flex items-center px-1"
              title="Онлайн захиалгын үргэлжлэх хугацаа. Хоосон бол 30 мин."
            >
              <DurationHmInput
                defaultMinutes={category?.durationMinutes ?? null}
                invalid={!!fe.durationMinutes}
                compact
              />
            </div>
            <input
              name="concurrentCapacity"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              required
              defaultValue={category?.concurrentCapacity ?? 1}
              title="Энэ ажлыг нэг зэрэг хэдэн захиалга авах боломжтой"
              className={`auth-input !w-20 ${fe.concurrentCapacity ? "border-red-500/50" : ""}`}
            />
            <label className="flex items-center gap-2 text-sm text-[var(--oc-ink2)] px-2">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={category?.isActive ?? true}
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
          {fe.concurrentCapacity ? (
            <p className="text-red-400 text-xs light:text-red-600">{fe.concurrentCapacity}</p>
          ) : null}
          <BranchPicker branches={branches} selected={category?.branchIds ?? []} />
          <ServiceKeyPicker
            serviceKeys={serviceKeys}
            defaultValue={defaultServiceKeyId}
            error={fe.systemServiceKeyId}
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg text-[var(--oc-muted2)] hover:text-[var(--oc-ink2)] hover:bg-white/[0.05] transition-colors"
            >
              Болих
            </button>
            <Btn type="submit" disabled={pending} size="sm">
              {pending ? "Хадгалж..." : isEdit ? "Хадгалах" : "Нэмэх"}
            </Btn>
          </div>
        </form>
      </td>
    </tr>
  );
}
