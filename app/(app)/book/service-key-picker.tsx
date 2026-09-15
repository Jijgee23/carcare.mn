"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ServiceKey = { id: string; name: string };

/**
 * Booking v2 — category-first, олон tenant дээгүүр: mobile-ийн category-first
 * urs гуравтай ижил (нэг key дээр л шилждэг хуучин /book-оос ялгаатай нь энд
 * ХЭДЭН Ч ажлын түлхүүр зэрэг сонгож болно). Сонголтоо баталгаажуулмагц
 * `/book?keys=id1,id2,...` руу шилжинэ — тэнд БҮГДийг нь санал болгодог
 * салбарууд л харагдана (`app/(app)/book/page.tsx`-ийн AND-логик).
 *
 * Хайлт нь клиент талд, in-memory (энэ каталогийн хэмжээнд URL-руу шидэх
 * `SearchBox`-ийн debounce/navigation машин шаардлагагүй). Үргэлжлүүлэх товч
 * `sticky bottom-0`-р дэлгэцийн доод хэсэгт тогтмол харагдана — урт
 * жагсаалтад доош гүйлгээд хайх шаардлагагүй, сонголтын тоо ч байнга харагдана.
 */
export function ServiceKeyPicker({ serviceKeys }: { serviceKeys: ServiceKey[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return serviceKeys;
    return serviceKeys.filter((k) => k.name.toLowerCase().includes(q));
  }, [serviceKeys, query]);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  function submit() {
    router.push(`/book?keys=${selected.map(encodeURIComponent).join(",")}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative sm:max-w-xs">
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
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-8 text-center text-sm text-[var(--oc-muted3)]">
          &quot;{query}&quot; гэсэн ажлын төрөл олдсонгүй.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  onChange={(e) => toggle(k.id, e.target.checked)}
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

      {/* Дэлгэцийн доод хэсэгт тогтмол — жагсаалт доор нь өөрөө гүйлгэнэ. */}
      <div className="sticky bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mt-2 bg-[var(--oc-carbon)] border-t border-[var(--oc-line)]">
        <button
          type="button"
          onClick={submit}
          disabled={selected.length === 0}
          className="w-full sm:w-auto bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all px-6 py-2.5 rounded-xl font-medium text-sm"
        >
          Үргэлжлүүлэх ({selected.length})
        </button>
      </div>
    </div>
  );
}
