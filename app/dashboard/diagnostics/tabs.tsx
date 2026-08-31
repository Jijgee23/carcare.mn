"use client";

import { usePathname } from "next/navigation";
import { TabLink } from "@/app/_components/landing-ops-ui";

const tabs = [
  { href: "/dashboard/diagnostics/reports", label: "Бөглөгдсөн тайлангууд" },
  { href: "/dashboard/diagnostics/new", label: "Шинэ тайлан бөглөх" },
];

export function DiagnosticsTabs() {
  const pathname = usePathname();
  return (
    <div className="px-6 sm:px-8 pt-6 sm:pt-8">
      <nav className="inline-flex items-center gap-1.5">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <TabLink key={tab.href} href={tab.href} active={active}>
              {tab.label}
            </TabLink>
          );
        })}
      </nav>
    </div>
  );
}
