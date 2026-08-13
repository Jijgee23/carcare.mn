"use client";

import { useState } from "react";
import {
  CHECK_TONE_ACTIVE,
  checkOptionTone,
  isItemVisible,
  itemPositions,
  positionedKey,
  type CheckTone,
  type TemplateItem,
  type TemplateSchema,
} from "@/lib/diagnostics";

const TONE_DOT: Record<CheckTone, string> = {
  good: "border-emerald-400 bg-emerald-500",
  warn: "border-amber-400 bg-amber-500",
  bad: "border-red-400 bg-red-500",
};

/**
 * Загварыг техникч бөглөх үеийн харагдацаар (DiagnosticForm-той ижил бүтэцтэй)
 * урьдчилан харуулна. Check сонголтууд дарагдах тул showWhen хамаарлыг шууд
 * турших боломжтой. Editor-ийн form дотор байрлах тул input-уудад name өгөхгүй —
 * submit-д орохгүй.
 */
export function TemplatePreview({ schema }: { schema: TemplateSchema }) {
  // Check item-уудын сонгосон утга — showWhen-ийг үнэлэхэд хэрэглэнэ.
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const hasAnswers = Object.keys(answers).length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-white/40">
          Техникч бөглөх үед ингэж харагдана. Сонголт дарж хамаарлыг туршиж
          болно — хадгалагдахгүй.
        </p>
        {hasAnswers ? (
          <button
            type="button"
            onClick={() => setAnswers({})}
            className="text-xs text-white/40 hover:text-white/70 shrink-0 px-2 py-1 rounded-md hover:bg-white/[0.05]"
          >
            Цэвэрлэх
          </button>
        ) : null}
      </div>

      {schema.sections.map((section) => {
        const visibleItems = section.items.filter((it) =>
          isItemVisible(it, answers),
        );
        if (visibleItems.length === 0) return null;
        return (
          <section
            key={section.id}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col gap-3"
          >
            <h3 className="font-semibold text-sm">{section.title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 items-start">
              {visibleItems.map((item) => {
                const positioned = Boolean(itemPositions(item));
                return (
                  <div
                    key={item.id}
                    className={positioned ? "md:col-span-2 2xl:col-span-3" : ""}
                  >
                    <PreviewItem
                      item={item}
                      answers={answers}
                      onCheck={(v) =>
                        setAnswers((prev) => ({ ...prev, [item.id]: v }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PreviewItem({
  item,
  answers,
  onCheck,
}: {
  item: TemplateItem;
  answers: Record<string, string>;
  onCheck: (value: string) => void;
}) {
  const positions = itemPositions(item);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-medium text-white/80">
        <span>{item.label}</span>
        {item.required ? (
          <span className="text-red-400 text-xs light:text-red-600">*</span>
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
              <PreviewInputs
                item={item}
                fieldId={positionedKey(item.id, pos.code)}
                answers={answers}
              />
            </div>
          ))}
        </div>
      ) : (
        <PreviewInputs
          item={item}
          fieldId={item.id}
          answers={answers}
          onCheck={onCheck}
        />
      )}
    </div>
  );
}

function PreviewInputs({
  item,
  fieldId,
  answers,
  onCheck,
}: {
  item: TemplateItem;
  fieldId: string;
  answers: Record<string, string>;
  onCheck?: (value: string) => void;
}) {
  // Байрлалтай талбарын сонголт нь showWhen-д нөлөөлөхгүй тул зөвхөн
  // харагдацын түвшинд локал state ашиглана.
  const [localValue, setLocalValue] = useState("");
  const selected = onCheck ? (answers[item.id] ?? "") : localValue;

  return (
    <>
      {item.type === "check" ? (
        <div className="flex flex-wrap gap-2">
          {(item.options ?? []).map((opt) => {
            const active = selected === opt;
            const tone = checkOptionTone(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() =>
                  onCheck ? onCheck(opt) : setLocalValue(opt)
                }
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  active
                    ? CHECK_TONE_ACTIVE[tone]
                    : "bg-white/[0.04] border-white/[0.06] text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                <span
                  className={`w-3 h-3 rounded-full border ${
                    active ? TONE_DOT[tone] : "border-white/30"
                  }`}
                />
                {opt}
              </button>
            );
          })}
        </div>
      ) : null}

      {item.type === "text" ? (
        <textarea
          rows={2}
          className="auth-input resize-none"
          placeholder="Текст бичих..."
        />
      ) : null}

      {item.type === "number" ? (
        <input type="number" step="any" className="auth-input" placeholder="0" />
      ) : null}

      {item.type === "photo" ? (
        <div className="rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] px-3 py-2.5 text-sm text-white/40">
          📷 Зураг оруулах талбар
        </div>
      ) : null}

      {item.type === "signature" ? (
        <div className="rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] px-3 py-2.5 text-sm text-white/40">
          ✍️ Гарын үсгийн талбар
        </div>
      ) : null}

      <input
        type="text"
        className="auth-input text-xs"
        placeholder="Нэмэлт тэмдэглэл (заавал биш)..."
      />
    </>
  );
}
