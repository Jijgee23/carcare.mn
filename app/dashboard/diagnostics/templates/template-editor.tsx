"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createTemplateAction,
  type TemplateActionState,
  updateTemplateAction,
} from "@/app/_actions/diagnostic-templates";
import { Field, FormError } from "@/app/_components/auth-shell";
import { Btn, BtnLink } from "@/app/_components/landing-ops-ui";
import {
  DEFAULT_CHECK_OPTIONS,
  DIAGNOSTIC_TYPES,
  DIAGNOSTIC_TYPE_DESCRIPTION,
  DIAGNOSTIC_TYPE_LABEL,
  ITEM_TYPES,
  ITEM_TYPE_LABEL,
  POSITION_SETS,
  POSITION_SET_KEYS,
  type DiagnosticType,
  type ItemType,
  type PositionSetKey,
  type TemplateItem,
  type TemplateSchema,
  type TemplateSection,
} from "@/lib/diagnostics";
import { TemplatePreview } from "./template-preview";

export const TEMPLATE_EDITOR_FORM_ID = "template-editor-form";

type Initial = {
  id?: string;
  name: string;
  description: string | null;
  type: DiagnosticType;
  isActive: boolean;
  schema: TemplateSchema;
  price: string | null;
  durationMin: number | null;
  categoryId: string | null;
};

export type CategoryOption = { id: string; name: string; isActive: boolean };

function SectionPanel({
  index,
  total,
  title,
  children,
}: {
  index: number;
  total: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-[var(--oc-ink)]">{title}</h2>
        <span className="font-plex-mono text-[11px] text-[var(--oc-muted3)]">
          {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>
      {children}
    </section>
  );
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultSchema(): TemplateSchema {
  return {
    sections: [
      {
        id: newId("sec"),
        title: "Үндсэн үзлэг",
        items: [
          {
            id: newId("item"),
            label: "Кузовын байдал",
            type: "check",
            required: true,
            options: DEFAULT_CHECK_OPTIONS.slice(),
          },
        ],
      },
    ],
  };
}

export function TemplateEditor({
  initial,
  categories = [],
}: {
  initial?: Initial;
  categories?: CategoryOption[];
}) {
  const isEdit = Boolean(initial?.id);
  const action = isEdit
    ? updateTemplateAction.bind(null, initial!.id!)
    : createTemplateAction;
  const [state, formAction, pending] = useActionState<
    TemplateActionState,
    FormData
  >(action, null);

  const [dirty, setDirty] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<DiagnosticType>(initial?.type ?? "INTAKE");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  // Идэвхтэй ангилал + одоо сонгогдсон (идэвхгүй болсон ч хадгалагдсаныг харуулна).
  const visibleCategories = categories.filter(
    (c) => c.isActive || c.id === initial?.categoryId,
  );
  const [schema, setSchema] = useState<TemplateSchema>(
    initial?.schema ?? defaultSchema(),
  );
  const [showPreview, setShowPreview] = useState(false);

  const fe = state?.fieldErrors ?? {};
  const schemaJson = useMemo(() => JSON.stringify(schema), [schema]);

  function updateSection(idx: number, patch: Partial<TemplateSection>) {
    setDirty(true);
    setSchema((s) => ({
      sections: s.sections.map((sec, i) =>
        i === idx ? { ...sec, ...patch } : sec,
      ),
    }));
  }
  function addSection() {
    setDirty(true);
    setSchema((s) => ({
      sections: [
        ...s.sections,
        { id: newId("sec"), title: "Шинэ хэсэг", items: [] },
      ],
    }));
  }
  function removeSection(idx: number) {
    setDirty(true);
    setSchema((s) => ({
      sections: s.sections.filter((_, i) => i !== idx),
    }));
  }
  function moveSection(idx: number, dir: -1 | 1) {
    setDirty(true);
    setSchema((s) => {
      const arr = [...s.sections];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return s;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { sections: arr };
    });
  }

  function addItem(sIdx: number) {
    setDirty(true);
    setSchema((s) => ({
      sections: s.sections.map((sec, i) =>
        i === sIdx
          ? {
              ...sec,
              items: [
                ...sec.items,
                {
                  id: newId("item"),
                  label: "Шинэ асуулт",
                  type: "check" as ItemType,
                  required: false,
                  options: DEFAULT_CHECK_OPTIONS.slice(),
                },
              ],
            }
          : sec,
      ),
    }));
  }
  function updateItem(
    sIdx: number,
    iIdx: number,
    patch: Partial<TemplateItem>,
  ) {
    setDirty(true);
    setSchema((s) => ({
      sections: s.sections.map((sec, i) =>
        i === sIdx
          ? {
              ...sec,
              items: sec.items.map((it, j) => {
                if (j !== iIdx) return it;
                const merged = { ...it, ...patch };
                if (
                  patch.type &&
                  patch.type !== "check" &&
                  merged.options !== undefined
                ) {
                  delete merged.options;
                }
                if (patch.type === "check" && !merged.options) {
                  merged.options = DEFAULT_CHECK_OPTIONS.slice();
                }
                return merged;
              }),
            }
          : sec,
      ),
    }));
  }
  function removeItem(sIdx: number, iIdx: number) {
    setDirty(true);
    setSchema((s) => ({
      sections: s.sections.map((sec, i) =>
        i === sIdx
          ? { ...sec, items: sec.items.filter((_, j) => j !== iIdx) }
          : sec,
      ),
    }));
  }
  function moveItem(sIdx: number, iIdx: number, dir: -1 | 1) {
    setDirty(true);
    setSchema((s) => ({
      sections: s.sections.map((sec, i) => {
        if (i !== sIdx) return sec;
        const arr = [...sec.items];
        const j = iIdx + dir;
        if (j < 0 || j >= arr.length) return sec;
        [arr[iIdx], arr[j]] = [arr[j], arr[iIdx]];
        return { ...sec, items: arr };
      }),
    }));
  }

  return (
    <form
      id={TEMPLATE_EDITOR_FORM_ID}
      action={formAction}
      onChange={() => setDirty(true)}
      className="flex flex-col gap-6"
      noValidate
    >
      <FormError message={state?.message} />
      {fe.schema ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[10px] px-4 py-3 text-sm text-red-400 light:text-red-600">
          {fe.schema}
        </div>
      ) : null}

      <SectionPanel index={1} total={3} title="Үндсэн мэдээлэл">
        <div className="flex flex-col gap-4">
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Field label="Хуудасны нэр" htmlFor="name" error={fe.name} className="max-w-xs">
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`auth-input ${fe.name ? "border-red-500/50" : ""}`}
              placeholder="Жишээ: Машин хүлээж авах ерөнхий үзлэг"
            />
          </Field>
          <Field
            label="Ангилал"
            htmlFor="categoryId"
            error={fe.categoryId}
            hint={
              visibleCategories.length > 0
                ? undefined
                : "Үйлчилгээ → Ангилалд эхлээд бүртгээрэй."
            }
            className="max-w-xs"
          >
            <select
              id="categoryId"
              name="categoryId"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`auth-input ${fe.categoryId ? "border-red-500/50" : ""}`}
            >
              <option value="" className="bg-[var(--surface)]">
                — Ангилал —
              </option>
              {visibleCategories.map((c) => (
                <option key={c.id} value={c.id} className="bg-[var(--surface)]">
                  {c.name}
                  {c.isActive ? "" : " (идэвхгүй)"}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Үнэ (₮)"
            htmlFor="price"
            hint="захиалгад автоматаар буух"
            error={fe.price}
            className="max-w-xs"
          >
            <input
              id="price"
              name="price"
              type="text"
              inputMode="decimal"
              defaultValue={initial?.price ?? ""}
              className={`auth-input ${fe.price ? "border-red-500/50" : ""}`}
              placeholder="25000"
            />
          </Field>
          <Field
            label="Дундаж хугацаа (минут)"
            htmlFor="durationMin"
            hint="захиалгын тооцоо"
            error={fe.durationMin}
            className="max-w-xs"
          >
            <input
              id="durationMin"
              name="durationMin"
              type="number"
              min={0}
              defaultValue={initial?.durationMin ?? ""}
              className={`auth-input ${fe.durationMin ? "border-red-500/50" : ""}`}
              placeholder="30"
            />
          </Field>
        </div>

        <Field label="Тайлбар" htmlFor="description" className="max-w-2xl">
          <textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="auth-input resize-none"
            placeholder="Энэ загварыг хэзээ хэрэглэх вэ?"
          />
        </Field>

        <Field label="Төрөл" htmlFor="type" error={fe.type}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 max-w-4xl">
            {DIAGNOSTIC_TYPES.map((tp) => (
              <label
                key={tp}
                className={`flex flex-col gap-1 p-3 rounded-lg border cursor-pointer transition-colors ${
                  type === tp
                    ? "border-[var(--oc-accent)]/40 bg-[var(--oc-accent)]/10"
                    : "border-[var(--oc-line)] bg-[var(--oc-panel2)] hover:border-[var(--oc-line2)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="type"
                    value={tp}
                    checked={type === tp}
                    onChange={() => setType(tp)}
                    className="accent-[var(--oc-accent)]"
                  />
                  <span className="text-sm font-medium text-[var(--oc-ink2)]">
                    {DIAGNOSTIC_TYPE_LABEL[tp]}
                  </span>
                </div>
                <span className="text-xs text-[var(--oc-muted3)] pl-6">
                  {DIAGNOSTIC_TYPE_DESCRIPTION[tp]}
                </span>
              </label>
            ))}
          </div>
        </Field>

        <label className="flex items-center gap-2 text-sm text-[var(--oc-ink2)]">
          <input
            type="checkbox"
            name="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-[var(--oc-accent)]"
          />
          Идэвхтэй (захиалга дээр сонгох боломжтой)
        </label>
        </div>
      </SectionPanel>

      <SectionPanel index={2} total={3} title="Хуудасны бүтэц">
        <div className="flex justify-end -mt-2 mb-3">
          <Btn type="button" variant="ghost" size="sm" onClick={addSection}>
            + Хэсэг нэмэх
          </Btn>
        </div>

        {schema.sections.length === 0 ? (
          <p className="text-sm text-[var(--oc-muted3)] text-center py-6">
            Хэсэг алга. &laquo;Хэсэг нэмэх&raquo; товчоор эхлээрэй.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {schema.sections.map((sec, sIdx) => (
              <div
                key={sec.id}
                className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel2)] p-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={sec.title}
                    onChange={(e) =>
                      updateSection(sIdx, { title: e.target.value })
                    }
                    className="flex-1 bg-transparent border-b border-[var(--oc-line)] focus:border-[var(--oc-accent)]/50 outline-none text-sm font-medium text-[var(--oc-ink2)] pb-1"
                    placeholder="Хэсгийн нэр"
                  />
                  <div className="flex items-center gap-0.5 text-[var(--oc-muted3)]">
                    <button
                      type="button"
                      onClick={() => moveSection(sIdx, -1)}
                      disabled={sIdx === 0}
                      className="p-1 hover:text-[var(--oc-ink2)] disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Дээш"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(sIdx, 1)}
                      disabled={sIdx === schema.sections.length - 1}
                      className="p-1 hover:text-[var(--oc-ink2)] disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Доош"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection(sIdx)}
                      className="p-1 hover:text-red-400 light:hover:text-red-600"
                      title="Хэсгийг устгах"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="pl-3 border-l-2 border-[var(--oc-line)] flex flex-col gap-2">
                  <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2 items-start">
                  {sec.items.map((item, iIdx) => {
                    // Энэ item-ийн өмнө орших, бүх хэсэгт байгаа check item-ууд
                    // (зөвхөн дээд талын check item-аас хамаарч болно)
                    const priorCheckItems: { id: string; label: string; options: string[] }[] = [];
                    for (const ps of schema.sections) {
                      for (const pi of ps.items) {
                        if (pi.id === item.id) {
                          // Энэ section-ы хувьд өөрөөсөө доорхыг хасаж зогсоно
                          break;
                        }
                        // Байрлалтай check item олон утгатай тул хамаарлын
                        // эх сурвалж болохгүй.
                        if (pi.type === "check" && pi.options && !pi.positionSet) {
                          priorCheckItems.push({
                            id: pi.id,
                            label: pi.label,
                            options: pi.options,
                          });
                        }
                      }
                      if (ps.id === sec.id) break;
                    }
                    return (
                      <ItemRow
                        key={item.id}
                        item={item}
                        first={iIdx === 0}
                        last={iIdx === sec.items.length - 1}
                        priorCheckItems={priorCheckItems}
                        onChange={(patch) => updateItem(sIdx, iIdx, patch)}
                        onMove={(dir) => moveItem(sIdx, iIdx, dir)}
                        onRemove={() => removeItem(sIdx, iIdx)}
                      />
                    );
                  })}
                  </div>
                  <button
                    type="button"
                    onClick={() => addItem(sIdx)}
                    className="self-start text-xs text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] px-2 py-1 rounded-md hover:bg-[var(--oc-accent)]/10"
                  >
                    + Асуулт нэмэх
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionPanel>

      <SectionPanel index={3} total={3} title="Бөглөх урьдчилан харах">
        <div className="flex justify-end -mt-2 mb-3">
          <Btn
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? "Нуух" : "Харах"}
          </Btn>
        </div>
        {showPreview ? <TemplatePreview schema={schema} /> : null}
      </SectionPanel>

      <input type="hidden" name="schema" value={schemaJson} />

      {/* Sticky action bar — урт форм scroll хийхэд ч Хадгалах үргэлж харагдана */}
      <div className="sticky bottom-0 z-10 flex items-center gap-3 pt-3 pb-3 -mb-1 border-t border-[var(--oc-line2)] bg-[var(--oc-carbon)]/95 backdrop-blur-md">
        <span className="text-xs text-[var(--oc-muted3)] flex-1">
          {dirty ? "Хадгалагдаагүй өөрчлөлт байна" : ""}
        </span>
        <BtnLink href="/dashboard/services/diagnostics" variant="ghost">
          ← Буцах
        </BtnLink>
        <Btn type="submit" disabled={pending}>
          {pending ? "..." : isEdit ? "Хадгалах" : "Үүсгэх"}
        </Btn>
      </div>
    </form>
  );
}

function ItemRow({
  item,
  first,
  last,
  priorCheckItems,
  onChange,
  onMove,
  onRemove,
}: {
  item: TemplateItem;
  first: boolean;
  last: boolean;
  priorCheckItems: { id: string; label: string; options: string[] }[];
  onChange: (patch: Partial<TemplateItem>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [optionsText, setOptionsText] = useState(
    (item.options ?? DEFAULT_CHECK_OPTIONS).join(", "),
  );

  const dependency = item.showWhen
    ? priorCheckItems.find((p) => p.id === item.showWhen!.itemId)
    : undefined;
  // showWhen-ийг тогтоосон боловч хамаарал болох item олдохгүй (засагдсан/устгасан) бол
  // editor-т ил харагдуулна
  const showWhenInvalid = Boolean(item.showWhen) && !dependency;

  function setShowWhenItem(itemId: string) {
    if (!itemId) {
      onChange({ showWhen: undefined });
      return;
    }
    const dep = priorCheckItems.find((p) => p.id === itemId);
    if (!dep) return;
    // Шинээр сонгосон бол default нь эхний option
    onChange({
      showWhen: { itemId, values: [dep.options[0] ?? ""] },
    });
  }

  function toggleShowWhenValue(value: string, on: boolean) {
    if (!item.showWhen) return;
    const set = new Set(item.showWhen.values);
    if (on) set.add(value);
    else set.delete(value);
    onChange({
      showWhen: { itemId: item.showWhen.itemId, values: Array.from(set) },
    });
  }

  return (
    <div className="rounded-lg bg-[var(--oc-panel)] border border-[var(--oc-line)] p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={item.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="flex-1 min-w-0 bg-transparent border-b border-[var(--oc-line)] focus:border-[var(--oc-accent)]/50 outline-none text-sm text-[var(--oc-ink2)] pb-1"
          placeholder="Асуултын нэр"
        />
        <div className="flex items-center gap-0.5 text-[var(--oc-muted3)] shrink-0">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={first}
            className="p-1 hover:text-[var(--oc-ink2)] disabled:opacity-30 disabled:cursor-not-allowed text-xs"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={last}
            className="p-1 hover:text-[var(--oc-ink2)] disabled:opacity-30 disabled:cursor-not-allowed text-xs"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 hover:text-red-400 light:hover:text-red-600 text-xs"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={item.type}
          onChange={(e) => onChange({ type: e.target.value as ItemType })}
          className="text-xs bg-[var(--oc-panel2)] border border-[var(--oc-line)] rounded-md px-2 py-1 text-[var(--oc-ink2)]"
        >
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t} className="bg-[var(--surface)]">
              {ITEM_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select
          value={item.positionSet ?? ""}
          onChange={(e) =>
            onChange({
              positionSet: e.target.value
                ? (e.target.value as PositionSetKey)
                : undefined,
            })
          }
          title="Байрлал бүрээр давтах (зүүн/баруун, 4 булан г.м.)"
          className="text-xs bg-[var(--oc-panel2)] border border-[var(--oc-line)] rounded-md px-2 py-1 text-[var(--oc-ink2)]"
        >
          <option value="" className="bg-[var(--surface)]">
            Байрлалгүй
          </option>
          {POSITION_SET_KEYS.map((k) => (
            <option key={k} value={k} className="bg-[var(--surface)]">
              {POSITION_SETS[k].label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-[var(--oc-muted2)]">
          <input
            type="checkbox"
            checked={item.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            className="accent-[var(--oc-accent)]"
          />
          Заавал
        </label>
      </div>

      {item.type === "check" ? (
        <input
          type="text"
          value={optionsText}
          onChange={(e) => {
            setOptionsText(e.target.value);
            const arr = e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            onChange({ options: arr.length ? arr : DEFAULT_CHECK_OPTIONS });
          }}
          className="auth-input text-xs"
          placeholder="Сонголтуудыг таслалаар тусгаарлана уу (жишээ: Хэвийн, Анхаарах, Солих)"
        />
      ) : null}

      {/* Conditional хамаарал — өмнөх check item байгаа үед л харуулна */}
      {priorCheckItems.length > 0 ? (
        <div className="rounded-md border border-[var(--oc-line)] bg-[var(--oc-panel2)] p-2 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[11px] text-[var(--oc-muted3)]">
            <span>Хамаарал:</span>
            <select
              value={item.showWhen?.itemId ?? ""}
              onChange={(e) => setShowWhenItem(e.target.value)}
              className="text-xs bg-[var(--oc-panel)] border border-[var(--oc-line)] rounded px-2 py-0.5 text-[var(--oc-ink2)]"
            >
              <option value="" className="bg-[var(--surface)]">
                — Хамаарал байхгүй —
              </option>
              {priorCheckItems.map((p) => (
                <option key={p.id} value={p.id} className="bg-[var(--surface)]">
                  {p.label}
                </option>
              ))}
            </select>
            {dependency ? (
              <span className="text-[var(--oc-muted3)]">→ хариу нь:</span>
            ) : null}
          </div>

          {dependency ? (
            <div className="flex flex-wrap gap-1.5">
              {dependency.options.map((opt) => {
                const checked = item.showWhen?.values.includes(opt) ?? false;
                return (
                  <label
                    key={opt}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] cursor-pointer border transition-colors ${
                      checked
                        ? "bg-[var(--oc-accent)]/15 border-[var(--oc-accent)]/40 text-[var(--oc-accent)]"
                        : "bg-[var(--oc-panel)] border-[var(--oc-line)] text-[var(--oc-muted2)] hover:bg-white/[0.05]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        toggleShowWhenValue(opt, e.target.checked)
                      }
                      className="accent-[var(--oc-accent)] w-3 h-3"
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          ) : null}

          {showWhenInvalid ? (
            <p className="text-[11px] text-amber-400 light:text-amber-700">
              Хамаарал тогтоосон асуулт алга болсон байна — дахин сонгоно уу.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
