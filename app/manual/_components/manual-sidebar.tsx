"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ManualSection } from "@/lib/manual/types";

export function ManualSidebar({
  sections,
  basePath,
  title,
}: {
  sections: ManualSection[];
  basePath: string;
  title: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-72 shrink-0 hidden lg:flex flex-col h-screen sticky top-0 border-r border-[var(--oc-line2)] bg-[var(--oc-panel)]">
      <div className="h-14 shrink-0 flex items-center px-5 border-b border-[var(--oc-line2)] font-plex-mono text-[10px] uppercase tracking-[0.1em] text-[var(--oc-muted3)]">
        {title}
      </div>
      <nav className="sidebar-scroll flex-1 overflow-y-auto py-3 px-3 space-y-4">
        {sections.map((section) => {
          const sectionHref = `${basePath}/${section.slug}`;
          return (
            <div key={section.slug}>
              <Link
                href={sectionHref}
                className={`block px-2 py-1 font-plex-mono text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                  pathname === sectionHref
                    ? "text-[var(--oc-accent)]"
                    : "text-[var(--oc-muted3)] hover:text-[var(--oc-ink)]"
                }`}
              >
                {section.title}
              </Link>
              {section.articles.length > 0 ? (
                <div className="mt-1 space-y-0.5">
                  {section.articles.map((article) => {
                    const href = `${basePath}/${section.slug}/${article.slug}`;
                    const active = pathname === href;
                    return (
                      <Link
                        key={article.slug}
                        href={href}
                        className={`block px-2 py-1.5 rounded-lg text-[13px] transition-colors ${
                          active
                            ? "bg-[var(--oc-accent)] text-[var(--oc-on-accent)]"
                            : "text-[var(--oc-muted)] hover:bg-white/[0.04] hover:text-[var(--oc-ink)]"
                        }`}
                      >
                        {article.title}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
