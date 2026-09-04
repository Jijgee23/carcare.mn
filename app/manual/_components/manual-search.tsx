"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ManualArticle, ManualSection } from "@/lib/manual/types";

export function ManualSearch({
  articles,
  basePath,
}: {
  articles: Array<{ section: ManualSection; article: ManualArticle }>;
  basePath: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return articles
      .filter(({ article }) => article.title.toLowerCase().includes(query))
      .slice(0, 8);
  }, [articles, q]);

  return (
    <div className="relative w-full max-w-xs">
      <input
        type="text"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Хайх... (гарчиг)"
        className="compact-input"
      />
      {open && results.length > 0 ? (
        <div className="absolute left-0 right-0 mt-1 rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel2)] shadow-xl overflow-hidden z-50">
          {results.map(({ section, article }) => (
            <Link
              key={article.slug}
              href={`${basePath}/${section.slug}/${article.slug}`}
              className="block px-3 py-2 text-sm text-[var(--oc-ink2)] hover:bg-white/[0.06] transition-colors"
            >
              {article.title}
              <span className="block text-xs text-[var(--oc-muted3)]">{section.title}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
