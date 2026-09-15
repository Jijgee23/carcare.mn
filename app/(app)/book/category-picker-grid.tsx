"use client";

import { useMemo, useState } from "react";

export type ServiceKey = { id: string; name: string };

/**
 * Хайлт + сонголтын тор — өмнө нь `service-key-picker.tsx`-д бүтэн хуудасны
 * агуулга байсан хэсэг, одоо `category-picker-modal.tsx` дотор дахин
 * ашиглагдана. Хайлт клиент талд, in-memory (каталогийн хэмжээнд URL-руу
 * шидэх debounce/navigation машин шаардлагагүй).
 */
export function CategoryPickerGrid({
  serviceKeys,
  selected,
  onToggle,
}: {
  serviceKeys: ServiceKey[];
  selected: string[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return serviceKeys;
    return serviceKeys.filter((k) => k.name.toLowerCase().includes(q));
  }, [serviceKeys, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oc-muted4)] pointer-events-none"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ажлын төрлөөр хайх..."
          className="auth-input !py-1.5 !pl-9 !text-sm !rounded-lg"
          autoFocus
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-8 text-center text-sm text-[var(--oc-muted3)]">
          &quot;{query}&quot; гэсэн ажлын төрөл олдсонгүй.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((k) => {
            const checked = selected.includes(k.id);
            return (
              <label
                key={k.id}
                className={`rounded-[10px] border p-4 flex items-center gap-3 cursor-pointer transition-colors select-none ${
                  checked
                    ? "border-[var(--oc-accent)] bg-[var(--oc-accent)]/10"
                    : "border-[var(--oc-line)] bg-[var(--oc-panel)] hover:bg-[var(--oc-panel2)]"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={(e) => onToggle(k.id, e.target.checked)}
                />
                <span
                  aria-hidden
                  className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${
                    checked
                      ? "border-[var(--oc-accent)] bg-[var(--oc-accent)] text-[var(--oc-panel)]"
                      : "border-[var(--oc-line)]"
                  }`}
                >
                  {checked ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 font-medium text-[var(--oc-ink)]">
                  {k.name}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
