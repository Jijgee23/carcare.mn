"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  createTemplateAction,
  type TemplateActionState,
  updateTemplateAction,
} from "@/app/_actions/diagnostic-templates";
import { Field, FormError } from "@/app/_components/auth-shell";
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

type Initial = {
  id?: string;
  name: string;
  description: string | null;
  type: DiagnosticType;
  isActive: boolean;
  schema: TemplateSchema;
  price: string | null;
  durationMin: number | null;
};

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

export function TemplateEditor({ initial }: { initial?: Initial }) {
  const isEdit = Boolean(initial?.id);
  const action = isEdit
    ? updateTemplateAction.bind(null, initial!.id!)
    : createTemplateAction;
  const [state, formAction, pending] = useActionState<
    TemplateActionState,
    FormData
  >(action, null);

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<DiagnosticType>(initial?.type ?? "INTAKE");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [schema, setSchema] = useState<TemplateSchema>(
    initial?.schema ?? defaultSchema(),
  );

  const fe = state?.fieldErrors ?? {};
  const schemaJson = useMemo(() => JSON.stringify(schema), [schema]);

  function updateSection(idx: number, patch: Partial<TemplateSection>) {
    setSchema((s) => ({
      sections: s.sections.map((sec, i) =>
        i === idx ? { ...sec, ...patch } : sec,
      ),
    }));
  }
  function addSection() {
    setSchema((s) => ({
      sections: [
        ...s.sections,
        { id: newId("sec"), title: "Шинэ хэсэг", items: [] },
      ],
    }));
  }
  function removeSection(idx: number) {
    setSchema((s) => ({
      sections: s.sections.filter((_, i) => i !== idx),
    }));
  }
  function moveSection(idx: number, dir: -1 | 1) {
    setSchema((s) => {
      const arr = [...s.sections];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return s;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { sections: arr };
    });
  }

  function addItem(sIdx: number) {
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
    setSchema((s) => ({
      sections: s.sections.map((sec, i) =>
        i === sIdx
          ? { ...sec, items: sec.items.filter((_, j) => j !== iIdx) }
          : sec,
      ),
    }));
  }
  function moveItem(sIdx: number, iIdx: number, dir: -1 | 1) {
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
    <form action={formAction} className="flex flex-col gap-6">
      <FormError message={state?.message} />
      {fe.schema ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
          {fe.schema}
        </div>
      ) : null}

      <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08] flex flex-col gap-4">
        <h2 className="font-semibold text-sm">Үндсэн мэдээлэл</h2>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Field label="Хуудасны нэр" htmlFor="name" error={fe.name} className="max-w-xs">
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`compact-input ${fe.name ? "border-red-500/50" : ""}`}
              placeholder="Жишээ: Машин хүлээж авах ерөнхий үзлэг"
            />
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
              className={`compact-input ${fe.price ? "border-red-500/50" : ""}`}
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
              className={`compact-input ${fe.durationMin ? "border-red-500/50" : ""}`}
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
            className="compact-input resize-none"
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
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="type"
                    value={tp}
                    checked={type === tp}
                    onChange={() => setType(tp)}
                    className="accent-violet-500"
                  />
                  <span className="text-sm font-medium text-white/90">
                    {DIAGNOSTIC_TYPE_LABEL[tp]}
                  </span>
                </div>
                <span className="text-xs text-white/40 pl-6">
                  {DIAGNOSTIC_TYPE_DESCRIPTION[tp]}
                </span>
              </label>
            ))}
          </div>
        </Field>

        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            name="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-violet-500"
          />
          Идэвхтэй (захиалга дээр сонгох боломжтой)
        </label>
      </section>

      <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Хуудасны бүтэц</h2>
          <button
            type="button"
            onClick={addSection}
            className="text-xs bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-3 py-1.5 rounded-lg transition-colors"
          >
            + Хэсэг нэмэх
          </button>
        </div>

        {schema.sections.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-6">
            Хэсэг алга. &laquo;Хэсэг нэмэх&raquo; товчоор эхлээрэй.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {schema.sections.map((sec, sIdx) => (
              <div
                key={sec.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={sec.title}
                    onChange={(e) =>
                      updateSection(sIdx, { title: e.target.value })
                    }
                    className="flex-1 bg-transparent border-b border-white/[0.06] focus:border-violet-500/50 outline-none text-sm font-medium text-white/90 pb-1"
                    placeholder="Хэсгийн нэр"
                  />
                  <div className="flex items-center gap-0.5 text-white/40">
                    <button
                      type="button"
                      onClick={() => moveSection(sIdx, -1)}
                      disabled={sIdx === 0}
                      className="p-1 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Дээш"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(sIdx, 1)}
                      disabled={sIdx === schema.sections.length - 1}
                      className="p-1 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Доош"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection(sIdx)}
                      className="p-1 hover:text-red-300"
                      title="Хэсгийг устгах"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pl-3 border-l-2 border-white/[0.04]">
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
                  <button
                    type="button"
                    onClick={() => addItem(sIdx)}
                    className="self-start text-xs text-violet-300 hover:text-violet-200 px-2 py-1 rounded-md hover:bg-violet-500/10"
                  >
                    + Асуулт нэмэх
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <input type="hidden" name="schema" value={schemaJson} />

      <div className="flex gap-2 pt-2">
        <Link
          href="/dashboard/services/diagnostics"
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
    <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={item.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="flex-1 bg-transparent border-b border-white/[0.04] focus:border-violet-500/50 outline-none text-sm text-white/80 pb-1"
          placeholder="Асуултын нэр"
        />
        <select
          value={item.type}
          onChange={(e) => onChange({ type: e.target.value as ItemType })}
          className="text-xs bg-white/[0.06] border border-white/[0.08] rounded-md px-2 py-1 text-white/70"
        >
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t} className="bg-[#0d0d14]">
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
          className="text-xs bg-white/[0.06] border border-white/[0.08] rounded-md px-2 py-1 text-white/70"
        >
          <option value="" className="bg-[#0d0d14]">
            Байрлалгүй
          </option>
          {POSITION_SET_KEYS.map((k) => (
            <option key={k} value={k} className="bg-[#0d0d14]">
              {POSITION_SETS[k].label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-white/50">
          <input
            type="checkbox"
            checked={item.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            className="accent-violet-500"
          />
          Заавал
        </label>
        <div className="flex items-center gap-0.5 text-white/40">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={first}
            className="p-1 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={last}
            className="p-1 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 hover:text-red-300 text-xs"
          >
            ✕
          </button>
        </div>
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
          placeholder="Сонголтуудыг таслалаар тусгаарлана уу (жишээ: OK, Анхаарах, Засах)"
        />
      ) : null}

      {/* Conditional хамаарал — өмнөх check item байгаа үед л харуулна */}
      {priorCheckItems.length > 0 ? (
        <div className="rounded-md border border-white/[0.04] bg-white/[0.02] p-2 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            <span>Хамаарал:</span>
            <select
              value={item.showWhen?.itemId ?? ""}
              onChange={(e) => setShowWhenItem(e.target.value)}
              className="text-xs bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-white/70"
            >
              <option value="" className="bg-[#0d0d14]">
                — Хамаарал байхгүй —
              </option>
              {priorCheckItems.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0d0d14]">
                  {p.label}
                </option>
              ))}
            </select>
            {dependency ? (
              <span className="text-white/40">→ хариу нь:</span>
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
                        ? "bg-violet-500/15 border-violet-500/40 text-violet-200"
                        : "bg-white/[0.02] border-white/[0.06] text-white/55 hover:bg-white/[0.05]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        toggleShowWhenValue(opt, e.target.checked)
                      }
                      className="accent-violet-500 w-3 h-3"
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          ) : null}

          {showWhenInvalid ? (
            <p className="text-[11px] text-amber-400">
              Хамаарал тогтоосон асуулт алга болсон байна — дахин сонгоно уу.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
