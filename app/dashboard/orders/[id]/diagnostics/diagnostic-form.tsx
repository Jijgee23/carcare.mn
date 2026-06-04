"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  createReportAction,
  type ReportActionState,
} from "@/app/_actions/diagnostic-reports";
import { Field, FormError, SubmitButton } from "@/app/_components/auth-shell";
import {
  isItemVisible,
  itemPositions,
  positionedKey,
  type TemplateItem,
  type TemplateSchema,
} from "@/lib/diagnostics";

export function DiagnosticForm({
  orderId,
  templateId,
  templateName,
  schema,
  backHref,
}: {
  orderId: string;
  templateId: string;
  templateName: string;
  schema: TemplateSchema;
  backHref: string;
}) {
  const [state, formAction, pending] = useActionState<
    ReportActionState,
    FormData
  >(createReportAction, null);

  // Check item-уудын одоогийн утгуудыг хадгалаад showWhen-ийг үнэлэхэд хэрэглэнэ.
  const [answers, setAnswers] = useState<Record<string, string>>({});

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="templateId" value={templateId} />

      <FormError message={state?.message} />

      <div className="glass rounded-2xl px-5 py-4 border border-white/[0.08]">
        <div className="text-xs text-white/40">Загвар</div>
        <div className="text-sm font-medium text-white/90">{templateName}</div>
      </div>

      {schema.sections.map((section) => {
        const visibleItems = section.items.filter((it) =>
          isItemVisible(it, answers),
        );
        if (visibleItems.length === 0) return null;
        return (
          <section
            key={section.id}
            className="glass rounded-2xl p-5 sm:p-6 border border-white/[0.08] flex flex-col gap-4"
          >
            <h2 className="font-semibold">{section.title}</h2>
            <div className="flex flex-col gap-4">
              {visibleItems.map((item) => (
                <ItemControl
                  key={item.id}
                  item={item}
                  onCheckChange={(v) => setAnswer(item.id, v)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <section className="glass rounded-2xl p-5 sm:p-6 border border-white/[0.08] flex flex-col gap-3">
        <Field label="Үйлчлүүлэгчийн гарын үсэг (зураг сонгох)" htmlFor="signature">
          <input
            id="signature"
            name="signature"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-sm text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-white/[0.08] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white/80 hover:file:bg-white/[0.12] file:cursor-pointer"
          />
        </Field>
      </section>

      <div className="flex gap-3">
        <Link
          href={backHref}
          className="flex-1 glass hover:bg-white/[0.08] transition-all py-3 rounded-xl font-semibold text-sm text-white/60 text-center"
        >
          ← Цуцлах
        </Link>
        <div className="flex-1">
          <SubmitButton pending={pending}>Тайлан хадгалах</SubmitButton>
        </div>
      </div>
    </form>
  );
}

function ItemControl({
  item,
  onCheckChange,
}: {
  item: TemplateItem;
  onCheckChange: (value: string) => void;
}) {
  const positions = itemPositions(item);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-medium text-white/80">
        <span>{item.label}</span>
        {item.required ? (
          <span className="text-red-400 text-xs">*</span>
        ) : null}
      </div>

      {positions ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {positions.map((pos) => (
            <div
              key={pos.code}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col gap-2"
            >
              <div className="text-xs font-medium text-white/55">
                {pos.label}
              </div>
              <FieldInputs item={item} fieldId={positionedKey(item.id, pos.code)} />
            </div>
          ))}
        </div>
      ) : (
        <FieldInputs
          item={item}
          fieldId={item.id}
          onCheckChange={onCheckChange}
        />
      )}
    </div>
  );
}

// Нэг талбарын (item эсвэл байрлал-түлхүүрийн) оролтуудыг гаргана.
function FieldInputs({
  item,
  fieldId,
  onCheckChange,
}: {
  item: TemplateItem;
  fieldId: string;
  onCheckChange?: (value: string) => void;
}) {
  const baseName = `data[${fieldId}]`;
  const [photoCount, setPhotoCount] = useState(0);

  return (
    <>
      {item.type === "check" ? (
        <div className="flex flex-wrap gap-2">
          {(item.options ?? []).map((opt) => (
            <label
              key={opt}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] cursor-pointer hover:bg-white/[0.08] text-sm text-white/70"
            >
              <input
                type="radio"
                name={`${baseName}[value]`}
                value={opt}
                required={item.required}
                onChange={(e) => onCheckChange?.(e.target.value)}
                className="accent-violet-500"
              />
              {opt}
            </label>
          ))}
        </div>
      ) : null}

      {item.type === "text" ? (
        <textarea
          name={`${baseName}[value]`}
          required={item.required}
          rows={2}
          className="auth-input resize-none"
          placeholder="Текст бичих..."
        />
      ) : null}

      {item.type === "number" ? (
        <input
          name={`${baseName}[value]`}
          type="number"
          step="any"
          required={item.required}
          className="auth-input"
          placeholder="0"
        />
      ) : null}

      {item.type === "photo" ? (
        <input
          name={`photos[${fieldId}]`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          required={item.required}
          onChange={(e) => setPhotoCount(e.target.files?.length ?? 0)}
          className="block w-full text-sm text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-white/[0.08] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white/80 hover:file:bg-white/[0.12] file:cursor-pointer"
        />
      ) : null}
      {item.type === "photo" && photoCount > 0 ? (
        <p className="text-xs text-white/40">{photoCount} зураг сонгогдсон</p>
      ) : null}

      {item.type === "signature" ? (
        <input
          name={`signatures[${fieldId}]`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required={item.required}
          className="block w-full text-sm text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-white/[0.08] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white/80 hover:file:bg-white/[0.12] file:cursor-pointer"
        />
      ) : null}

      <input
        name={`${baseName}[note]`}
        type="text"
        className="auth-input text-xs"
        placeholder="Нэмэлт тэмдэглэл (заавал биш)..."
      />
    </>
  );
}
