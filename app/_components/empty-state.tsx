import type { ReactNode } from "react";

/**
 * Жагсаалт хоосон/илэрц олдоогүй үед харуулах стандарт панель — сайтын 10+
 * газарт давхардаж бичигдэж байсан ижил markup-ыг нэгтгэсэн.
 */
export function EmptyState({
  children,
  padding = "p-10",
  dashed = false,
  className = "",
}: {
  children: ReactNode;
  padding?: string;
  dashed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-[10px] border text-center text-sm text-[var(--oc-muted3)]",
        dashed
          ? "border-dashed border-[var(--oc-line)]"
          : "border-[var(--oc-line)] bg-[var(--oc-panel)]",
        padding,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
