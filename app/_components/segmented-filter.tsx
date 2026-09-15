"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * Query-string дээр суурилсан сегмент (segmented control) хэлбэрийн шүүлтүүр.
 * Mobile аппын `SegmentedButton`-той ижил үүрэгтэй: цөөн тооны харилцан
 * үл нийцэх сонголтыг нэг мөрөнд харуулна. Утга нь `null` (=«Бүгд») эсвэл
 * сонголтуудын нэг нь байна.
 *
 * Жагсаалтын бусад шүүлтүүртэй (`SearchBox`, `FilterSelect`) ижил зарчмаар
 * URL-руу бичнэ — server component `searchParams`-аас уншиж Prisma where
 * болгоно.
 */
export function SegmentedFilter({
  paramName,
  options,
  allLabel = "Бүгд",
  ariaLabel,
}: {
  paramName: string;
  options: { value: string; label: string; activeClassName?: string }[];
  allLabel?: string;
  ariaLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const current = searchParams.get(paramName) ?? "";

  function pick(value: string) {
    if (value === current) return;
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(paramName, value);
    else next.delete(paramName);
    next.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  const items = [{ value: "", label: allLabel }, ...options];

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-0.5 gap-0.5"
    >
      {items.map((o) => {
        const active = current === o.value;
        return (
          <button
            key={o.value || "__all"}
            type="button"
            aria-pressed={active}
            onClick={() => pick(o.value)}
            className={`px-3 h-8 rounded-lg text-xs font-medium transition-colors border ${
              active
                ? (("activeClassName" in o && o.activeClassName) ||
                  "bg-[var(--oc-accent)]/15 border-[var(--oc-accent)]/40 text-[var(--oc-accent)]")
                : "border-transparent text-[var(--oc-muted3)] hover:text-[var(--oc-ink2)] hover:bg-[var(--oc-panel2)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Он сонгох чипүүд (mobile-ийн `FilterChip` мөртэй ижил) — зөвхөн өгөгдөлд
 * БОДИТООР байгаа онууд дамжина, ингэснээр хоосон он санал болгохгүй.
 */
export function YearChips({
  paramName = "year",
  years,
  allLabel = "Бүгд",
}: {
  paramName?: string;
  years: number[];
  allLabel?: string;
}) {
  if (years.length === 0) return null;
  return (
    <SegmentedFilter
      paramName={paramName}
      allLabel={allLabel}
      ariaLabel="Он"
      options={years.map((y) => ({ value: String(y), label: String(y) }))}
    />
  );
}
