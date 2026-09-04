"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutSystemAction } from "@/app/_actions/system-auth";
import { Brand, BrandMark } from "./brand";
import { useSidebarCollapse } from "./use-sidebar-collapse";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
};

const navItems: NavItem[] = [
  {
    href: "/system",
    label: "Тойм",
    exact: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: "/system/tenants",
    label: "Байгууллагууд",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
      </svg>
    ),
  },
  {
    href: "/system/users",
    label: "Хэрэглэгчид",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/system/customers",
    label: "Үйлчлүүлэгчид",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    href: "/system/vehicles",
    label: "Машинууд",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 16V11l2-5h10l2 5v5" />
        <path d="M3 16h18v3a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3z" />
        <circle cx="7" cy="17" r="1.2" />
        <circle cx="17" cy="17" r="1.2" />
      </svg>
    ),
  },
  {
    href: "/system/plan-prices",
    label: "Багц / Үнэ",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1v22" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    href: "/system/qpay",
    label: "QPay",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <path d="M14 14h7v7" />
      </svg>
    ),
  },
  {
    href: "/system/booking-revenue",
    label: "Цаг захиалгын орлого",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M9 9.5c0-1.4 1.3-2.5 3-2.5s3 .9 3 2.2-1.3 1.9-3 2.3-3 .9-3 2.3 1.3 2.2 3 2.2 3-1.1 3-2.5" />
      </svg>
    ),
  },
  {
    href: "/system/sessions",
    label: "Нэвтрэлт",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    href: "/system/feedback",
    label: "Санал хүсэлт",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/system/announcements",
    label: "Мэдэгдэл илгээх",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    href: "/system/settings",
    label: "Тохиргоо",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    href: "/system/otp",
    label: "OTP",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7.5" cy="15.5" r="4.5" />
        <path d="m10.5 12.5 7-7" />
        <path d="m17 7 2 2" />
        <path d="m14 8 2 2" />
      </svg>
    ),
  },
];

const activePillClasses =
  "bg-red-500/90 text-white shadow-[0_10px_28px_-12px_rgba(239,68,68,0.7)]";
const inactivePillClasses =
  "text-[var(--oc-muted)] hover:bg-white/[0.04] hover:text-[var(--oc-ink)]";

function NavTooltip({ label }: { label: string }) {
  return (
    <span className="sidebar-tooltip pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 whitespace-nowrap rounded-lg bg-[var(--oc-panel2)] border border-[var(--oc-line)] px-2.5 py-1.5 text-xs font-medium text-[var(--oc-ink2)] opacity-0 scale-95 origin-left group-hover:opacity-100 group-hover:scale-100 shadow-xl z-50">
      {label}
    </span>
  );
}

export function SystemSidebar({
  adminName,
  adminEmail,
  initials,
}: {
  adminName: string;
  adminEmail: string;
  initials: string;
}) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarCollapse();
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <aside className="app-sidebar fixed top-0 left-0 h-screen bg-[var(--oc-panel)] border-r border-red-500/[0.15] flex-col z-40 hidden lg:flex">
      <div className="relative h-16 border-b border-[var(--oc-line2)] flex items-center shrink-0">
        <Link
          href="/system"
          className={`flex items-center gap-2.5 flex-1 min-w-0 overflow-hidden ${collapsed ? "justify-center px-2" : "px-5"}`}
        >
          {collapsed ? <BrandMark size="sm" /> : <Brand />}
          {!collapsed ? (
            <div className="font-plex-mono text-[10px] text-red-400 light:text-red-600 uppercase tracking-[0.1em] leading-none whitespace-nowrap">
              SYSTEM
            </div>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={toggle}
          data-collapsed={collapsed}
          aria-label={collapsed ? "Цэс дэлгэх" : "Цэс хумих"}
          className="sidebar-collapse-btn absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full border border-red-500/20 bg-[var(--oc-panel)] text-[var(--oc-muted)] hover:text-[var(--oc-ink)] flex items-center justify-center shadow-md z-10"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {!collapsed ? (
        <div className="px-4 pt-4 pb-2 font-plex-mono text-[10px] text-red-400/70 light:text-red-600/80 uppercase tracking-[0.1em]">
          Платформын админ
        </div>
      ) : null}

      <nav className={`sidebar-scroll flex-1 overflow-y-auto pb-4 space-y-0.5 ${collapsed ? "px-2 pt-3" : "px-3"}`}>
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <div key={item.href} className="relative group">
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex h-11 items-center gap-3 rounded-xl text-[13px] font-medium transition-colors ${
                  collapsed ? "justify-center px-0" : "px-3"
                } ${active ? activePillClasses : inactivePillClasses}`}
              >
                <span className={`nav-icon shrink-0 ${active ? "" : "text-[var(--oc-muted3)]"}`}>
                  {item.icon}
                </span>
                {!collapsed ? item.label : null}
              </Link>
              {collapsed ? <NavTooltip label={item.label} /> : null}
            </div>
          );
        })}
      </nav>

      {collapsed ? (
        <div className="p-3 border-t border-[var(--oc-line2)] flex flex-col items-center gap-2">
          <div
            title={adminName}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-xs font-bold text-white shrink-0"
          >
            {initials}
          </div>
          <form action={signOutSystemAction}>
            <button
              type="submit"
              title="Гарах"
              className="p-2 rounded-lg text-[var(--oc-muted)] hover:text-[var(--oc-ink)] hover:bg-white/[0.06] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </form>
        </div>
      ) : (
        <div className="p-3 border-t border-[var(--oc-line2)] space-y-2">
          <div className="flex items-center gap-3 p-2.5 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--oc-ink2)] truncate">
                {adminName}
              </div>
              <div className="text-xs text-[var(--oc-muted3)] truncate">{adminEmail}</div>
            </div>
          </div>
          <form action={signOutSystemAction}>
            <button
              type="submit"
              className="w-full text-sm text-[var(--oc-muted)] hover:text-[var(--oc-ink)] transition-colors px-3 py-2 rounded-xl hover:bg-white/[0.04] text-left"
            >
              Гарах
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}

export function SystemMobileTopbar({
  adminName: _adminName,
  initials,
}: {
  adminName: string;
  initials: string;
}) {
  const pathname = usePathname();

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-[var(--oc-panel)]/95 backdrop-blur border-b border-red-500/[0.15]">
      <div className="px-4 py-3 flex items-center justify-between">
        <Link href="/system" className="flex items-center gap-2">
          <Brand size="sm" />
          <span className="font-plex-mono text-[10px] text-red-400 light:text-red-600">SYSTEM</span>
        </Link>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-xs font-bold text-white">
          {initials}
        </div>
      </div>

      <nav className="px-2 pb-2 flex gap-1 overflow-x-auto">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? "bg-red-500/15 text-red-200 border border-red-500/25 light:bg-red-100 light:text-red-700 light:border-red-300"
                  : "text-[var(--oc-muted)] border border-[var(--oc-line2)]"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
