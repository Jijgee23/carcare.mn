"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard/services/labor", label: "Ажил" },
  { href: "/dashboard/services/diagnostics", label: "Оношилгоо" },
  { href: "/dashboard/services/goods", label: "Сэлбэг / Бараа" },
];

export function ServicesTabs() {
  const pathname = usePathname();
  return (
    <div className="px-6 sm:px-8 pt-6 sm:pt-8">
      <nav className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`text-sm px-4 py-1.5 rounded-lg transition-colors ${
                active
                  ? "bg-violet-600/25 text-violet-200 border border-violet-500/30"
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
