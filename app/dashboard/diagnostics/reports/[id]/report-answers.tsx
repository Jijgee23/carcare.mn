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
          <span className="text-xs text-[var(--oc-muted3)] mr-1">Хариултаар:</span>
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
            className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-[var(--oc-line)]">
              <h2 className="font-semibold text-[var(--oc-ink)] text-sm">{section.title}</h2>
            </div>
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2 items-start">
              {items.map(({ item, positions }) => (
                <div
                  key={item.id}
                  className={`rounded-lg bg-[var(--oc-panel2)] border border-[var(--oc-line)] px-3 py-2.5 flex flex-col gap-1.5 ${
                    positions ? "md:col-span-2 2xl:col-span-3" : ""
                  }`}
                >
                  <div className="text-xs text-[var(--oc-muted3)]">{item.label}</div>
                  {positions ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {positions.map((pos) => (
                        <div
                          key={pos.code}
                          className="flex flex-col gap-1 rounded-md border border-[var(--oc-line)] bg-[var(--oc-panel)] p-2"
                        >
                          <div className="text-[11px] text-[var(--oc-muted3)]">
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
        <div className="rounded-[10px] bg-[var(--oc-panel)] p-8 border border-[var(--oc-line)] text-center text-sm text-[var(--oc-muted3)]">
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
            "bg-[var(--oc-accent)]/15 border-[var(--oc-accent)]/40 text-[var(--oc-accent)]")
          : "bg-[var(--oc-panel2)] border-[var(--oc-line)] text-[var(--oc-muted2)] hover:bg-white/[0.06]"
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
      <div className="text-sm text-[var(--oc-ink)]">
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
              className="w-24 h-24 object-cover rounded-lg border border-[var(--oc-line)]"
            />
          ))}
        </div>
      ) : null}
      {item.type === "signature" && typeof entry.value === "string" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.value}
          alt="Гарын үсэг"
          className="w-48 h-24 object-contain rounded-lg border border-[var(--oc-line)] bg-[var(--oc-panel2)]"
        />
      ) : null}
      {entry.note ? (
        <div className="text-xs text-[var(--oc-muted3)] italic">
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
    return <span className="text-[var(--oc-muted4)]">—</span>;
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
