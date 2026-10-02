"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toggleSortHref, type SortDir } from "@/lib/list-sort";

export const TH_CLASS =
  "text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-5 py-3";

export function SortableTh({ label, sortKey, current, className = TH_CLASS }: { label: string; sortKey: string; current: { key: string; dir: SortDir }; className?: string }) {
  const params = useSearchParams();
  const active = current.key === sortKey;
  return (
    <th className={className} aria-sort={active ? (current.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={toggleSortHref(new URLSearchParams(params.toString()), sortKey, current)} className="inline-flex items-center gap-1 hover:text-[var(--oc-ink)]">
        {label}
        <span aria-hidden className={active ? "" : "opacity-30"}>{active && current.dir === "asc" ? "↑" : "↓"}</span>
      </Link>
    </th>
  );
}
