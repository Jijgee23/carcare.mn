"use client";

import type { ServiceKey } from "./category-picker-grid";

/**
 * Сонгосон ажлын төрлүүдийг жижиг tag хэлбэрээр харуулна + нэмэх товч.
 * Tag дээрх × дарахад ШУУД (modal нээлгүйгээр) тухайн категорийг хасна —
 * олон сонголтоос нэгийг хасахад modal нээх шаардлагагүй байхын тулд.
 */
export function CategoryTagsBar({
  serviceKeys,
  selectedIds,
  onRemove,
  onOpenPicker,
}: {
  serviceKeys: ServiceKey[];
  selectedIds: string[];
  onRemove: (id: string) => void;
  onOpenPicker: () => void;
}) {
  const selected = selectedIds
    .map((id) => serviceKeys.find((k) => k.id === id))
    .filter((k): k is ServiceKey => Boolean(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selected.length === 0 ? (
        <span className="text-sm text-[var(--oc-muted3)]">
          Ажлын төрөл сонгоогүй байна — бүх салбар харагдаж байна.
        </span>
      ) : (
        selected.map((k) => (
          <span
            key={k.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--oc-accent)]/30 bg-[var(--oc-accent)]/10 pl-3 pr-1.5 py-1 text-xs font-medium text-[var(--oc-ink)]"
          >
            {k.name}
            <button
              type="button"
              onClick={() => onRemove(k.id)}
              aria-label={`${k.name}-г хасах`}
              className="w-4 h-4 shrink-0 flex items-center justify-center rounded-full text-[var(--oc-muted3)] hover:text-[var(--oc-ink)] hover:bg-white/[0.12] transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </span>
        ))
      )}
      <button
        type="button"
        onClick={onOpenPicker}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--oc-line)] px-3 py-1 text-xs font-medium text-[var(--oc-muted3)] hover:text-[var(--oc-ink)] hover:border-[var(--oc-accent)]/40 transition-colors"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Ажлын төрөл нэмэх
      </button>
    </div>
  );
}
