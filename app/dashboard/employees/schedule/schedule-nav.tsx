import Link from "next/link";
import type { ReactNode } from "react";

export type ScheduleViewMode = "week" | "month";

/**
 * Ажлын хувиарын навигацийн мөр (designs/Schedule Calendar): `7 хоног | Сар`
 * segmented switch, `‹ Өнөөдөр ›` бүлэг, mono хугацааны шошго, баруун талд
 * нэмэлт слот (`children` — жишээ нь хайлт). `/dashboard/employees/schedule`
 * болон `/dashboard/my-schedule` хоёул ашиглана — өмнө нь хуулбарлагдсан байсан.
 */
export function ScheduleNav({
  view,
  weekHref,
  monthHref,
  prevHref,
  todayHref,
  nextHref,
  rangeLabel,
  children,
}: {
  view: ScheduleViewMode;
  weekHref: string;
  monthHref: string;
  prevHref: string;
  todayHref: string;
  nextHref: string;
  rangeLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel2)] p-[3px]">
        <SegmentLink href={weekHref} active={view === "week"}>
          7 хоног
        </SegmentLink>
        <SegmentLink href={monthHref} active={view === "month"}>
          Сар
        </SegmentLink>
      </div>

      <div className="flex items-center gap-0.5 rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel2)] p-[3px]">
        <NavLink href={prevHref} title="Өмнөх" className="w-8 text-[15px]">
          ‹
        </NavLink>
        <NavLink href={todayHref} title="Өнөөдөр" className="px-3 text-[12.5px] font-bold">
          {view === "month" ? "Энэ сар" : "Энэ 7 хоног"}
        </NavLink>
        <NavLink href={nextHref} title="Дараах" className="w-8 text-[15px]">
          ›
        </NavLink>
      </div>

      <span className="font-plex-mono text-[13px] tracking-[-0.01em] text-[var(--oc-muted2)]">
        {rangeLabel}
      </span>

      {children ? <div className="ml-auto flex items-center gap-2.5">{children}</div> : null}
    </div>
  );
}

function SegmentLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-4 py-[7px] text-[13px] font-bold transition-colors ${
        active
          ? "bg-[var(--oc-accent)] text-[var(--oc-on-accent)]"
          : "text-[var(--oc-muted2)] hover:text-[var(--oc-ink)]"
      }`}
    >
      {children}
    </Link>
  );
}

function NavLink({
  href,
  title,
  className = "",
  children,
}: {
  href: string;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      title={title}
      className={`flex h-[30px] items-center justify-center rounded-lg text-[var(--oc-muted2)] transition-colors hover:bg-[var(--oc-line2)] hover:text-[var(--oc-ink)] ${className}`}
    >
      {children}
    </Link>
  );
}
