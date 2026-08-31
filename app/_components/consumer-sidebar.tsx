"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { accountSignOutAction } from "@/app/_actions/account-auth";
import { submitAccountFeedback } from "@/app/_actions/feedback";
import { AccountNotificationBell } from "./account-notification-bell";
import { Brand, BrandMark } from "./brand";
import { FeedbackButton } from "./feedback-button";
import { ThemeToggle } from "./theme-toggle";
import { useSidebarCollapse } from "./use-sidebar-collapse";

type NavLeaf = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  // Зөвхөн нэвтэрсэн хэрэглэгчид харагдах эсэх.
  auth?: boolean;
};

const navItems: NavLeaf[] = [
  {
    href: "/discover",
    label: "Автосервисүүд",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    href: "/account",
    label: "Миний цаг",
    exact: true,
    auth: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    href: "/account/vehicles",
    label: "Миний машинууд",
    auth: true,
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
    href: "/account/history",
    label: "Үйлчилгээний түүх",
    auth: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v5h5" />
        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    href: "/account/notifications",
    label: "Мэдэгдэл",
    auth: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
];

function isLeafActive(pathname: string, item: NavLeaf): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

const activePillClasses =
  "bg-violet-600 text-white shadow-[0_10px_28px_-12px_rgba(124,58,237,0.75)]";
const inactivePillClasses =
  "text-white/50 hover:bg-white/[0.04] hover:text-white light:text-slate-500 light:hover:bg-black/[0.04] light:hover:text-slate-900";

function NavTooltip({ label }: { label: string }) {
  return (
    <span className="sidebar-tooltip pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 whitespace-nowrap rounded-lg bg-[var(--popover)] border border-white/10 light:border-black/10 px-2.5 py-1.5 text-xs font-medium text-white/90 light:text-slate-800 opacity-0 scale-95 origin-left group-hover:opacity-100 group-hover:scale-100 shadow-xl z-50">
      {label}
    </span>
  );
}

function ConsumerNavList({
  loggedIn,
  onNavigate,
  collapsed = false,
}: {
  loggedIn: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const visible = navItems.filter((it) => !it.auth || loggedIn);

  return (
    <nav className={`sidebar-scroll flex-1 overflow-y-auto pb-4 space-y-0.5 ${collapsed ? "px-2" : "px-3"}`}>
      {visible.map((item) => {
        const active = isLeafActive(pathname, item);
        return (
          <div key={item.href} className="relative group">
            <Link
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={`flex h-11 items-center gap-3 rounded-xl text-[13px] font-medium transition-colors ${
                collapsed ? "justify-center px-0" : "px-3"
              } ${active ? activePillClasses : inactivePillClasses}`}
            >
              <span className={`nav-icon shrink-0 ${active ? "text-white" : "text-white/40 light:text-slate-500"}`}>
                {item.icon}
              </span>
              {!collapsed ? item.label : null}
            </Link>
            {collapsed ? <NavTooltip label={item.label} /> : null}
          </div>
        );
      })}
    </nav>
  );
}

// Sidebar-ийн доод хэсэгт харагдах тусламжийн карт — image-ийн урамшууллын
// картны байршилтай адил, гэхдээ энд холбогдох контент рүү (тусламж) чиглэнэ.
function ConsumerPromoCard({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={`px-3 overflow-hidden transition-all duration-300 ease-out ${
        collapsed ? "grid grid-rows-[0fr] opacity-0" : "grid grid-rows-[1fr] opacity-100 pb-1"
      }`}
    >
      <div className="min-h-0">
        <Link
          href="/contact"
          className="card-hover group block rounded-2xl p-4 bg-gradient-to-br from-violet-600/20 via-violet-600/10 to-blue-500/10 border border-violet-400/20 light:from-violet-100 light:via-violet-50 light:to-blue-50 light:border-violet-200"
        >
          <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-900/30 light:shadow-violet-300/50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="mt-2.5 text-sm font-semibold text-white/90 light:text-slate-900">
            Тусламж хэрэгтэй юу?
          </div>
          <div className="mt-0.5 text-xs text-white/45 light:text-slate-500 leading-snug">
            Бидэнтэй холбогдоорой
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-violet-300 group-hover:text-violet-200 light:text-violet-700 light:group-hover:text-violet-800">
            Холбоо барих
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </Link>
      </div>
    </div>
  );
}

// Нэвтэрсэн үед — профайл + горим + гарах. Эсвэл — нэвтрэх товч + горим.
function ConsumerFooter({
  loggedIn,
  accountName,
  accountPhone,
  initial,
  collapsed = false,
}: {
  loggedIn: boolean;
  accountName: string;
  accountPhone: string;
  initial: string | null;
  collapsed?: boolean;
}) {
  if (!loggedIn) {
    if (collapsed) {
      return (
        <div className="p-3 border-t border-white/[0.06] flex flex-col items-center gap-2">
          <Link
            href="/login"
            title="Нэвтрэх"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </Link>
          <ThemeToggle variant="icon" />
        </div>
      );
    }
    return (
      <div className="p-3 border-t border-white/[0.06] space-y-2">
        <Link
          href="/login"
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 transition-colors px-4 py-2.5 rounded-xl text-sm font-medium"
        >
          Нэвтрэх
        </Link>
        <ThemeToggle />
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="p-3 border-t border-white/[0.06] flex flex-col items-center gap-2">
        <Link
          href="/account"
          title={accountName || "Профайл"}
          className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xs font-bold shrink-0"
        >
          {initial ?? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </Link>
        <ThemeToggle variant="icon" />
        <form action={accountSignOutAction}>
          <button
            type="submit"
            title="Гарах"
            className="p-2 rounded-lg text-white/50 hover:text-white light:text-slate-500 light:hover:text-slate-900 hover:bg-white/[0.06] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-white/[0.06] space-y-2">
      <Link
        href="/account"
        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xs font-bold shrink-0">
          {initial ?? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white/80 truncate">
            {accountName || "Профайл"}
          </div>
          <div className="text-xs text-white/30 truncate tabular-nums">
            {accountPhone}
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/25 shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
      <ThemeToggle />
      <form action={accountSignOutAction}>
        <button
          type="submit"
          className="w-full text-sm text-white/50 hover:text-white transition-colors px-3 py-2 rounded-xl hover:bg-white/[0.04] text-left"
        >
          Гарах
        </button>
      </form>
    </div>
  );
}

export function ConsumerSidebar({
  loggedIn,
  accountName,
  accountPhone,
  initial,
  notificationUnread,
}: {
  loggedIn: boolean;
  accountName: string;
  accountPhone: string;
  initial: string | null;
  notificationUnread: number;
}) {
  const { collapsed, toggle } = useSidebarCollapse();

  return (
    <aside className="app-sidebar fixed top-0 left-0 h-screen bg-[var(--shell-surface)] border-r border-white/[0.06] flex-col z-40 hidden lg:flex">
      <div className="relative h-16 border-b border-white/[0.06] flex items-center shrink-0">
        <Link
          href="/discover"
          className={`flex items-center gap-2.5 flex-1 min-w-0 overflow-hidden ${collapsed ? "justify-center px-2" : "px-5"}`}
        >
          {collapsed ? <BrandMark size="sm" /> : <Brand />}
        </Link>
        {loggedIn && !collapsed ? (
          <div className="pr-4 flex items-center gap-1">
            <FeedbackButton
              submitAction={submitAccountFeedback}
              compact
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/80"
            />
            <AccountNotificationBell initialUnread={notificationUnread} />
          </div>
        ) : null}
        <button
          type="button"
          onClick={toggle}
          data-collapsed={collapsed}
          aria-label={collapsed ? "Цэс дэлгэх" : "Цэс хумих"}
          className="sidebar-collapse-btn absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full border border-white/10 light:border-black/10 bg-[var(--shell-surface)] text-white/50 hover:text-white light:text-slate-500 light:hover:text-slate-900 flex items-center justify-center shadow-md z-10"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <ConsumerNavList loggedIn={loggedIn} collapsed={collapsed} />

      <ConsumerPromoCard collapsed={collapsed} />

      <ConsumerFooter
        loggedIn={loggedIn}
        accountName={accountName}
        accountPhone={accountPhone}
        initial={initial}
        collapsed={collapsed}
      />
    </aside>
  );
}

export function ConsumerMobileTopbar({
  loggedIn,
  accountName,
  accountPhone,
  initial,
  notificationUnread,
}: {
  loggedIn: boolean;
  accountName: string;
  accountPhone: string;
  initial: string | null;
  notificationUnread: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Маршрут солигдоход drawer-ийг хаана.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Drawer нээлттэй үед: Escape-ээр хаах + body scroll түгжих.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 glass border-b border-white/[0.06]">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Цэс нээх"
              aria-expanded={open}
              className="p-1.5 -ml-1 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <Link href="/discover" className="flex items-center gap-2.5 min-w-0">
              <Brand size="sm" />
            </Link>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {loggedIn ? (
              <>
                <FeedbackButton
                  submitAction={submitAccountFeedback}
                  compact
                  className="inline-flex items-center justify-center rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/90"
                />
                <AccountNotificationBell initialUnread={notificationUnread} />
                <Link
                  href="/account"
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xs font-bold shrink-0"
                >
                  {initial ?? ""}
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors"
              >
                Нэвтрэх
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Үндсэн цэс"
          className={`absolute top-0 left-0 h-full w-72 max-w-[85vw] bg-[var(--shell-surface)] border-r border-white/[0.06] flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-5 h-16 border-b border-white/[0.06]">
            <Link
              href="/discover"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5"
            >
              <Brand />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Цэс хаах"
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <ConsumerNavList loggedIn={loggedIn} onNavigate={() => setOpen(false)} />

          <ConsumerPromoCard collapsed={false} />

          <ConsumerFooter
            loggedIn={loggedIn}
            accountName={accountName}
            accountPhone={accountPhone}
            initial={initial}
          />
        </aside>
      </div>
    </>
  );
}
