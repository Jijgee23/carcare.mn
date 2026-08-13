"use client";

import { useMemo, useState } from "react";
import {
  CHECK_TONE_ACTIVE,
  checkOptionTone,
  itemPositions,
  positionedKey,
  type PositionDef,
  type ReportData,
  type ReportEntry,
  type TemplateItem,
  type TemplateSchema,
} from "@/lib/diagnostics";

/**
 * Тайлангийн хариултуудыг хэсэг хэсгээр нь харуулна. Check хариултын
 * утгуудаас filter chip үүсгэж, сонгоход зөвхөн тухайн хариултай асуултуудыг
 * (байрлалтай бол зөвхөн таарсан байрлалыг) үлдээнэ.
 */
export function ReportAnswers({
  schema,
  data,
}: {
  schema: TemplateSchema;
  data: ReportData;
}) {
  const [filter, setFilter] = useState<string | null>(null);

  // Тайлан дахь check хариултуудын давтагдашгүй утгууд + тоо
  // (template-ийн options дарааллаар).
  const filterOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const section of schema.sections) {
      for (const item of section.items) {
        if (item.type !== "check") continue;
        for (const fieldId of entryKeys(item)) {
          const v = data[fieldId]?.value;
          if (typeof v === "string" && v !== "") {
            counts.set(v, (counts.get(v) ?? 0) + 1);
          }
        }
      }
    }
    // Дарааллыг options тодорхойлолтоор нь тогтооно
    const ordered: { value: string; count: number }[] = [];
    const seen = new Set<string>();
    for (const section of schema.sections) {
      for (const item of section.items) {
        for (const opt of item.options ?? []) {
          if (counts.has(opt) && !seen.has(opt)) {
            seen.add(opt);
            ordered.push({ value: opt, count: counts.get(opt)! });
          }
        }
      }
    }
    // options-д байхгүй ч data-д байгаа (хуучин хувилбарын) утгууд
    for (const [value, count] of counts) {
      if (!seen.has(value)) ordered.push({ value, count });
    }
    return ordered;
  }, [schema, data]);

  return (
    <div className="flex flex-col gap-5">
      {filterOptions.length > 1 ? (
        <div className="no-print flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-white/40 mr-1">Хариултаар:</span>
          <FilterChip
            label="Бүгд"
            active={filter === null}
            onClick={() => setFilter(null)}
          />
          {filterOptions.map((o) => (
            <FilterChip
              key={o.value}
              label={`${o.value} (${o.count})`}
              tone={CHECK_TONE_ACTIVE[checkOptionTone(o.value)]}
              active={filter === o.value}
              onClick={() => setFilter(filter === o.value ? null : o.value)}
            />
          ))}
        </div>
      ) : null}

      {schema.sections.map((section) => {
        const items = section.items
          .map((item) => visibleFields(item, data, filter))
          .filter((v): v is VisibleItem => v !== null);
        if (items.length === 0) return null;
        return (
          <section
            key={section.id}
            className="glass rounded-2xl border border-white/[0.08] overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-white/[0.06]">
              <h2 className="font-semibold text-sm">{section.title}</h2>
            </div>
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2 items-start">
              {items.map(({ item, positions }) => (
                <div
                  key={item.id}
                  className={`rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2.5 flex flex-col gap-1.5 ${
                    positions ? "md:col-span-2 2xl:col-span-3" : ""
                  }`}
                >
                  <div className="text-xs text-white/40">{item.label}</div>
                  {positions ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {positions.map((pos) => (
                        <div
                          key={pos.code}
                          className="flex flex-col gap-1 rounded-md border border-white/[0.04] bg-white/[0.02] p-2"
                        >
                          <div className="text-[11px] text-white/50">
                            {pos.label}
                          </div>
                          <EntryView
                            item={item}
                            entry={data[positionedKey(item.id, pos.code)] ?? {}}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EntryView item={item} entry={data[item.id] ?? {}} />
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {filter !== null &&
      schema.sections.every((s) =>
        s.items.every((it) => visibleFields(it, data, filter) === null),
      ) ? (
        <div className="glass rounded-2xl p-8 border border-white/[0.08] text-center text-sm text-white/40">
          &laquo;{filter}&raquo; хариултай асуулт алга.
        </div>
      ) : null}
    </div>
  );
}

type VisibleItem = { item: TemplateItem; positions: PositionDef[] | null };

/** Item-ийн бүх талбарын түлхүүрүүд (байрлалтай бол байрлал бүрд). */
function entryKeys(item: TemplateItem): string[] {
  const positions = itemPositions(item);
  return positions
    ? positions.map((p) => positionedKey(item.id, p.code))
    : [item.id];
}

/**
 * Filter-ийн дагуу item харагдах эсэх. Байрлалтай item-д зөвхөн таарсан
 * байрлалуудыг үлдээнэ. Таараагүй бол null.
 */
function visibleFields(
  item: TemplateItem,
  data: ReportData,
  filter: string | null,
): VisibleItem | null {
  const positions = itemPositions(item);
  if (filter === null) return { item, positions };
  if (item.type !== "check") return null;
  if (positions) {
    const matched = positions.filter(
      (p) => data[positionedKey(item.id, p.code)]?.value === filter,
    );
    return matched.length > 0 ? { item, positions: matched } : null;
  }
  return data[item.id]?.value === filter ? { item, positions: null } : null;
}

function FilterChip({
  label,
  tone,
  active,
  onClick,
}: {
  label: string;
  tone?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${
        active
          ? (tone ??
            "bg-violet-500/15 border-violet-500/40 text-violet-200 light:text-violet-700")
          : "bg-white/[0.03] border-white/[0.06] text-white/55 hover:bg-white/[0.07]"
      }`}
    >
      {label}
    </button>
  );
}

// Нэг талбарын (item эсвэл байрлалын) утга/зураг/гарын үсэг/тэмдэглэлийг харуулна.
function EntryView({
  item,
  entry,
}: {
  item: TemplateItem;
  entry: ReportEntry;
}) {
  return (
    <>
      <div className="text-sm text-white/90">
        {renderValue(item.type, entry.value)}
      </div>
      {entry.photos && entry.photos.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-1">
          {entry.photos.map((p, idx) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={idx}
              src={p}
              alt=""
              className="w-24 h-24 object-cover rounded-lg border border-white/[0.06]"
            />
          ))}
        </div>
      ) : null}
      {item.type === "signature" && typeof entry.value === "string" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.value}
          alt="Гарын үсэг"
          className="w-48 h-24 object-contain rounded-lg border border-white/[0.06] bg-white/[0.04]"
        />
      ) : null}
      {entry.note ? (
        <div className="text-xs text-white/50 italic">
          Тэмдэглэл: {entry.note}
        </div>
      ) : null}
    </>
  );
}

function renderValue(
  type: string,
  value: string | number | boolean | undefined,
): React.ReactNode {
  if (value === undefined || value === "" || value === null)
    return <span className="text-white/30">—</span>;
  if (type === "signature") return null;
  if (typeof value === "boolean") return value ? "Тийм" : "Үгүй";
  if (type === "check" && typeof value === "string") {
    return (
      <span
        className={`inline-block px-2 py-0.5 rounded-md border text-xs ${CHECK_TONE_ACTIVE[checkOptionTone(value)]}`}
      >
        {value}
      </span>
    );
  }
  return String(value);
}
