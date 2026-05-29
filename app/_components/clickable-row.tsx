"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

/**
 * Жагсаалтын мөрийг бүхэлд нь даран detail хуудас руу үсэргэдэг wrapper.
 * - Ердийн товшилт → router.push
 * - Ctrl/Cmd/Middle click → шинэ tab
 * - Дотор нь <a> / <button> / [data-stop-row-click] байвал тэдгээрт зориулна
 */
export function ClickableRow({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  function handleClick(e: MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, [data-stop-row-click]")) return;

    if (e.metaKey || e.ctrlKey || e.button === 1) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  }

  function handleAuxClick(e: MouseEvent<HTMLTableRowElement>) {
    if (e.button === 1) {
      e.preventDefault();
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <tr
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      className={
        className ??
        "border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors cursor-pointer"
      }
    >
      {children}
    </tr>
  );
}
