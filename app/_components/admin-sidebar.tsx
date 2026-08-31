"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signOutAction } from "@/app/_actions/auth";
import { submitStaffFeedback } from "@/app/_actions/feedback";
import { Brand, BrandMark } from "./brand";
import { FeedbackButton } from "./feedback-button";
import { StaffNotificationBell } from "./staff-notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { useSidebarCollapse } from "./use-sidebar-collapse";

type NavLeaf = {
  href: string;
  label: string;
  icon?: React.ReactNode;
  exact?: boolean;
  // Харагдах эрх: resource key (ж: "orders"), "audit", "owner", эсвэл undefined
  // (бүгдэд харагдана). Owner үргэлж бүгдийг харна.
  view?: string;
};

// Тухайн нав item-ийг хэрэглэгч харах эрхтэй эсэх.
function canSeeView(
  view: string | undefined,
  isOwner: boolean,
  perms: string[],
): boolean {
  if (!view) return true;
  if (isOwner) return true;
  if (view === "owner") return false;
  if (view === "audit") return perms.includes("audit.view");
  return perms.includes(`${view}.view`);
}

type NavGroup = NavLeaf & {
  children: NavLeaf[];
};

type NavItem = NavLeaf | NavGroup;

function hasChildren(item: NavItem): item is NavGroup {
  return "children" in item && Array.isArray(item.children);
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Хяналтын самбар",
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
    href: "/dashboard/branches",
    view: "branches",
    label: "Салбарууд",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
        <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
      </svg>
    ),
  },
  {
    href: "/dashboard/employees",
    view: "employees",
    label: "Ажилтнууд",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    children: [
      { href: "/dashboard/employees", label: "Ажилтнууд", exact: true },
      { href: "/dashboard/employees/roles", label: "Үүргүүд", view: "owner" },
    ],
  },
  {
    href: "/dashboard/orders",
    view: "orders",
    label: "Захиалга",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    children: [
      { href: "/dashboard/orders", label: "Бүх захиалга", exact: true },
      { href: "/dashboard/orders/postpaid", label: "Дараа төлбөрт" },
    ],
  },
  {
    href: "/dashboard/appointments",
    view: "appointments",
    label: "Цаг захиалга",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="M12 14v3M10.5 15.5h3" />
      </svg>
    ),
  },
  {
    href: "/dashboard/customers",
    view: "customers",
    label: "Үйлчлүүлэгчид",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    href: "/dashboard/vehicles",
    view: "vehicles",
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
    href: "/dashboard/services",
    view: "services",
    label: "Үйлчилгээ",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21 8-9-5-9 5 9 5 9-5z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="m12 13 0 8" />
      </svg>
    ),
    children: [
      { href: "/dashboard/services/labor", label: "Ажил", exact: true },
      { href: "/dashboard/services/diagnostics", label: "Оношилгоо" },
      { href: "/dashboard/services/goods", label: "Сэлбэг / Бараа" },
      {
        href: "/dashboard/services/categories",
        label: "Ангилал",
        view: "owner",
      },
    ],
  },
];

const secondaryItems: NavItem[] = [
  {
    href: "/dashboard/notifications",
    label: "Мэдэгдэл",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    href: "/dashboard/feedback",
    label: "Санал хүсэлт",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/reports",
    label: "Тайлан",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 15l3-4 4 3 5-7" />
      </svg>
    ),
  },
  {
    href: "/dashboard/audit",
    view: "audit",
    label: "Аудит лог",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8v4l3 3" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    view: "owner",
    label: "Тохиргоо",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    children: [
      { href: "/dashboard/settings", label: "Байгууллагын", exact: true },
      { href: "/dashboard/settings/system", label: "Системийн" },
      { href: "/dashboard/settings/qpay", label: "QPay" },
      { href: "/dashboard/settings/subscription", label: "Багц" },
    ],
  },
  {
    href: "/dashboard/profile",
    label: "Профайл",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

const STORAGE_KEY = "carcare:sidebar:open";

function isLeafActive(pathname: string, item: NavLeaf): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function isGroupActive(pathname: string, group: NavGroup): boolean {
  if (pathname.startsWith(group.href)) return true;
  return group.children.some((c) => isLeafActive(pathname, c));
}

// Тенант мөр — лого + нэр + (заавал биш) мэдэгдлийн хонх. Хумигдсан үед
// зөвхөн лого (эсвэл юу ч биш) харуулна — доор header дотор бас лого байгаа
// тул давхардахгүйн тулд бүрэн нуучихна.
function SidebarTenantRow({
  tenantName,
  tenantLogoUrl,
  notificationUnread,
  showBell = true,
  collapsed = false,
}: {
  tenantName: string;
  tenantLogoUrl?: string | null;
  notificationUnread: number;
  showBell?: boolean;
  collapsed?: boolean;
}) {
  if (collapsed) return null;
  return (
    <div className="px-3 pt-3 pb-2 flex items-center gap-2 text-xs text-[var(--oc-muted3)] min-w-0">
      {tenantLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tenantLogoUrl}
          alt=""
          className="w-5 h-5 rounded object-contain bg-[var(--oc-panel2)] border border-[var(--oc-line)] shrink-0"
        />
      ) : null}
      <span className="truncate flex-1 min-w-0">{tenantName}</span>
      {showBell ? (
        <>
          <FeedbackButton
            submitAction={submitStaffFeedback}
            compact
            className="inline-flex items-center justify-center rounded-lg p-1.5 text-[var(--oc-muted3)] transition-colors hover:bg-white/[0.06] hover:text-[var(--oc-ink2)]"
          />
          <StaffNotificationBell initialUnread={notificationUnread} align="left" />
        </>
      ) : null}
    </div>
  );
}

// Навигацийн жагсаалт — desktop sidebar болон mobile drawer хоёулаа хуваалцана.
// Бүлгийн нээлт/хаалтыг localStorage-д хадгална. Server-ийн анхны render-тэй
// зөрөхгүйн тулд анхны утгыг {} болгож, хадгалсан сонголтыг mount-ийн дараа
// useEffect дотор уншина — hydration mismatch гарахгүй.
function SidebarNavList({
  isOwner,
  permissions,
  onNavigate,
  collapsed = false,
}: {
  isOwner: boolean;
  permissions: string[];
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  // Бүлгийн дотоод child-уудыг ч эрхээр нь шүүнэ (ж: "Ажлын ангилал" зөвхөн owner).
  const filterChildren = (it: NavItem): NavItem =>
    hasChildren(it)
      ? {
          ...it,
          children: it.children.filter((c) =>
            canSeeView(c.view, isOwner, permissions),
          ),
        }
      : it;
  const visibleNav = navItems
    .filter((it) => canSeeView(it.view, isOwner, permissions))
    .map(filterChildren);
  const visibleSecondary = secondaryItems
    .filter((it) => canSeeView(it.view, isOwner, permissions))
    .map(filterChildren);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setOpenGroups(JSON.parse(raw) as Record<string, boolean>);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch {
      // ignore
    }
  }, [openGroups]);

  // Идэвхтэй group-ийг анхдагчаар нээлттэй харуулна (хэрэглэгч хаагаагүй үед).
  // openGroups[href] нь boolean бол түүнийг ашиглана, undefined бол active-аас хамаарна.
  function isOpen(href: string): boolean {
    const explicit = openGroups[href];
    if (typeof explicit === "boolean") return explicit;
    const group = [...navItems, ...secondaryItems].find(
      (it) => it.href === href && hasChildren(it),
    );
    return group ? isGroupActive(pathname, group as NavGroup) : false;
  }

  function toggleGroup(href: string) {
    setOpenGroups((prev) => ({ ...prev, [href]: !isOpen(href) }));
  }

  return (
    <nav className={`sidebar-scroll flex-1 overflow-y-auto pb-4 space-y-0.5 ${collapsed ? "px-2" : "px-3"}`}>
      {visibleNav.map((item) =>
        hasChildren(item) ? (
          <NavGroupItem
            key={item.href}
            item={item}
            pathname={pathname}
            open={isOpen(item.href)}
            onToggle={() => toggleGroup(item.href)}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        ) : (
          <NavLeafLink
            key={item.href}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        ),
      )}

      {visibleSecondary.length > 0 && !collapsed ? (
        <div className="pt-4 pb-2 px-3 font-plex-mono text-[10px] text-[var(--oc-muted3)] uppercase tracking-[0.1em]">
          Бусад
        </div>
      ) : null}
      {visibleSecondary.length > 0 && collapsed ? (
        <div className="my-3 h-px bg-[var(--oc-line)]" />
      ) : null}

      {visibleSecondary.map((item) =>
        hasChildren(item) ? (
          <NavGroupItem
            key={item.href}
            item={item}
            pathname={pathname}
            open={isOpen(item.href)}
            onToggle={() => toggleGroup(item.href)}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        ) : (
          <NavLeafLink
            key={item.href}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        ),
      )}
    </nav>
  );
}

// Collapsed rail дотор hover flyout байрлуулах helper. `nav`-ийн эцэг элемент
// нь `overflow-y-auto` тул (CSS-ийн дүрмээр overflow-x нь мөн "auto" болж,
// хажуу тийш гарсан зүйлийг таслачихдаг) `absolute`-аар байрлуулсан tooltip/цэс
// харагдахгүй байсан — тиймээс `document.body`-руу portal хийж, trigger-ийн
// bounding rect дээр үндэслэн `position: fixed`-ээр байрлуулна (DatePicker-тэй
// ижил зарчим). Портал хийсэн ч hover тасрахгүйн тулд flyout дээр очиход ч мөн
// нээлттэй хэвээр байлгаж, бага зэрэг саатал (120ms)-тайгаар хаана.
type FlyoutPos = { top: number; left: number };

function useHoverFlyout() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<FlyoutPos>({ top: 0, left: 0 });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  function onEnter() {
    clearCloseTimer();
    const el = anchorRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ top: r.top, left: r.right + 12 });
    }
    setOpen(true);
  }
  function onLeave() {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }
  useEffect(() => clearCloseTimer, []);

  return { anchorRef, open, pos, onEnter, onLeave };
}

function HoverFlyoutPortal({
  pos,
  open,
  onEnter,
  onLeave,
  center,
  children,
}: {
  pos: FlyoutPos;
  open: boolean;
  onEnter: () => void;
  onLeave: () => void;
  center?: boolean;
  children: React.ReactNode;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ position: "fixed", top: pos.top, left: pos.left }}
      className={`sidebar-tooltip z-[200] origin-left transition-all ${
        center ? "-translate-y-1/2" : ""
      } ${open ? "pointer-events-auto opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"}`}
    >
      {children}
    </div>,
    document.body,
  );
}

// Collapsed үед hover дээр гарч ирэх жижиг tooltip — label дэлгэрэнгүй биш
// үед харагдахгүй болсон тул орлуулна.
function NavTooltip({ label }: { label: string }) {
  return (
    <span className="whitespace-nowrap rounded-lg bg-[var(--oc-panel2)] border border-[var(--oc-line)] px-2.5 py-1.5 text-xs font-medium text-[var(--oc-ink2)] shadow-xl block">
      {label}
    </span>
  );
}

const activePillClasses =
  "bg-[var(--oc-accent)] text-[var(--oc-on-accent)] shadow-[0_10px_28px_-12px_rgba(245,165,36,0.55)]";
const inactivePillClasses =
  "text-[var(--oc-muted)] hover:bg-white/[0.04] hover:text-[var(--oc-ink)]";

// Хэрэглэгчийн footer — нэр, и-мэйл, гарах товч. Collapsed үед зөвхөн
// avatar + icon товчнууд төвд эгнэнэ.
function SidebarUserFooter({
  initials,
  userName,
  userEmail,
  collapsed = false,
}: {
  initials: string;
  userName: string;
  userEmail: string;
  collapsed?: boolean;
}) {
  if (collapsed) {
    return (
      <div className="p-3 border-t border-[var(--oc-line2)] flex flex-col items-center gap-2">
        <Link
          href="/dashboard/profile"
          title={userName}
          className="w-9 h-9 rounded-full border border-[var(--oc-line)] bg-[var(--oc-panel2)] flex items-center justify-center text-xs font-bold text-[var(--oc-ink2)] shrink-0"
        >
          {initials}
        </Link>
        <ThemeToggle variant="icon" />
        <form action={signOutAction}>
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
    );
  }

  return (
    <div className="p-3 border-t border-[var(--oc-line2)] space-y-2">
      <Link
        href="/dashboard/profile"
        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
      >
        <div className="w-9 h-9 rounded-full border border-[var(--oc-line)] bg-[var(--oc-panel2)] flex items-center justify-center text-xs font-bold text-[var(--oc-ink2)] shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--oc-ink2)] truncate">
            {userName}
          </div>
          <div className="text-xs text-[var(--oc-muted3)] truncate">{userEmail}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--oc-muted3)] shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
      <ThemeToggle />
      <form action={signOutAction}>
        <button
          type="submit"
          className="w-full text-sm text-[var(--oc-muted)] hover:text-[var(--oc-ink)] transition-colors px-3 py-2 rounded-xl hover:bg-white/[0.04] text-left"
        >
          Гарах
        </button>
      </form>
    </div>
  );
}

export function AdminSidebar({
  userName,
  userEmail,
  initials,
  tenantName,
  tenantLogoUrl,
  isOwner,
  permissions,
  notificationUnread,
}: {
  userName: string;
  userEmail: string;
  initials: string;
  tenantName: string;
  tenantLogoUrl?: string | null;
  isOwner: boolean;
  permissions: string[];
  notificationUnread: number;
}) {
  const { collapsed, toggle } = useSidebarCollapse();

  return (
    <aside className="app-sidebar fixed top-0 left-0 h-screen bg-[var(--oc-panel)] border-r border-[var(--oc-line2)] flex-col z-40 hidden lg:flex">
      <div className="relative h-16 border-b border-[var(--oc-line2)] flex items-center shrink-0">
        <Link
          href="/dashboard"
          className={`flex items-center gap-2.5 flex-1 min-w-0 overflow-hidden ${collapsed ? "justify-center px-2" : "px-5"}`}
        >
          {collapsed ? <BrandMark size="sm" /> : <Brand />}
          {!collapsed ? (
            <div className="font-plex-mono text-[10px] uppercase tracking-[0.1em] text-[var(--oc-muted3)] leading-none whitespace-nowrap">
              Админ
            </div>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={toggle}
          data-collapsed={collapsed}
          aria-label={collapsed ? "Цэс дэлгэх" : "Цэс хумих"}
          className="sidebar-collapse-btn absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full border border-[var(--oc-line)] bg-[var(--oc-panel)] text-[var(--oc-muted)] hover:text-[var(--oc-ink)] flex items-center justify-center shadow-md z-10"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <SidebarTenantRow
        tenantName={tenantName}
        tenantLogoUrl={tenantLogoUrl}
        notificationUnread={notificationUnread}
        collapsed={collapsed}
      />

      <SidebarNavList
        isOwner={isOwner}
        permissions={permissions}
        collapsed={collapsed}
      />

      <SidebarUserFooter
        initials={initials}
        userName={userName}
        userEmail={userEmail}
        collapsed={collapsed}
      />
    </aside>
  );
}

function NavLeafLink({
  item,
  pathname,
  onNavigate,
  collapsed = false,
}: {
  item: NavLeaf;
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const active = isLeafActive(pathname, item);
  const { anchorRef, open, pos, onEnter, onLeave } = useHoverFlyout();
  return (
    <div
      ref={anchorRef}
      className="relative"
      onMouseEnter={collapsed ? onEnter : undefined}
      onMouseLeave={collapsed ? onLeave : undefined}
    >
      <Link
        href={item.href}
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        className={`flex h-11 items-center gap-3 rounded-xl text-[13px] font-medium transition-colors ${
          collapsed ? "justify-center px-0" : "px-3"
        } ${active ? activePillClasses : inactivePillClasses}`}
      >
        {item.icon ? (
          <span className={`nav-icon shrink-0 ${active ? "" : "text-[var(--oc-muted3)]"}`}>
            {item.icon}
          </span>
        ) : null}
        {!collapsed ? item.label : null}
      </Link>
      {collapsed ? (
        <HoverFlyoutPortal pos={pos} open={open} onEnter={onEnter} onLeave={onLeave} center>
          <NavTooltip label={item.label} />
        </HoverFlyoutPortal>
      ) : null}
    </div>
  );
}

function NavGroupItem({
  item,
  pathname,
  open,
  onToggle,
  onNavigate,
  collapsed = false,
}: {
  item: NavGroup;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const parentActive = isGroupActive(pathname, item);
  const { anchorRef, open: flyoutOpen, pos, onEnter, onLeave } = useHoverFlyout();

  // Хумигдсан rail дотор дэд цэсийг мөрөнд харуулах зай байхгүй тул hover
  // дээр баруун талд нь бүх дэд холбоосыг жагсаасан flyout цэс гарна —
  // icon дээр дарахад шууд group.href рүү орно, харин hover flyout-оос
  // тодорхой дэд item-ээ сонгож болно. `nav`-ийн эцэг элемент scroll хийдэг
  // (overflow-y-auto) тул `absolute`-аар байрлуулбал хажуу тийш гарсан хэсэг
  // таслагдчихдаг — иймд document.body-руу portal хийж fixed байрлуулна.
  if (collapsed) {
    return (
      <div
        ref={anchorRef}
        className="relative"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <Link
          href={item.href}
          onClick={onNavigate}
          title={item.label}
          className={`flex h-11 items-center justify-center rounded-xl text-[13px] font-medium transition-colors ${
            parentActive ? activePillClasses : inactivePillClasses
          }`}
        >
          {item.icon ? (
            <span className={`nav-icon ${parentActive ? "" : "text-[var(--oc-muted3)]"}`}>
              {item.icon}
            </span>
          ) : null}
        </Link>

        <HoverFlyoutPortal pos={pos} open={flyoutOpen} onEnter={onEnter} onLeave={onLeave}>
          <div className="min-w-[11rem] overflow-hidden rounded-xl border border-[var(--oc-line)] bg-[var(--oc-panel2)] py-1.5 shadow-xl">
            <div className="px-3 py-1.5 font-plex-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--oc-muted3)]">
              {item.label}
            </div>
            {item.children.map((child) => {
              const childActive = isLeafActive(pathname, child);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  className={`block px-3 py-2 text-[13px] transition-colors ${
                    childActive
                      ? "bg-[var(--oc-accent)]/10 text-[var(--oc-accent)]"
                      : "text-[var(--oc-muted)] hover:bg-white/[0.06] hover:text-[var(--oc-ink)]"
                  }`}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        </HoverFlyoutPortal>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex h-11 items-center gap-3 px-3 rounded-xl text-[13px] font-medium transition-colors ${
          parentActive ? activePillClasses : inactivePillClasses
        }`}
        aria-expanded={open}
      >
        {item.icon ? (
          <span className={`nav-icon ${parentActive ? "" : "text-[var(--oc-muted3)]"}`}>
            {item.icon}
          </span>
        ) : null}
        <span className="flex-1 text-left">{item.label}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${
            open ? "rotate-90" : ""
          } ${parentActive ? "" : "text-[var(--oc-muted3)]"}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {open ? (
        <div className="mt-0.5 ml-3 pl-3 border-l border-[var(--oc-line)] space-y-0.5">
          {item.children.map((child) => {
            const childActive = isLeafActive(pathname, child);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={`flex items-center px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                  childActive
                    ? "bg-[var(--oc-accent)]/10 text-[var(--oc-accent)]"
                    : "text-[var(--oc-muted3)] hover:text-[var(--oc-ink)]"
                }`}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function MobileTopbar({
  userName,
  userEmail,
  tenantName,
  tenantLogoUrl,
  initials,
  isOwner,
  permissions,
  notificationUnread,
}: {
  userName: string;
  userEmail: string;
  tenantName: string;
  tenantLogoUrl?: string | null;
  initials: string;
  isOwner: boolean;
  permissions: string[];
  notificationUnread: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Маршрут солигдоход (нав дотор дарахад) drawer-ийг хаана.
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
      <header className="lg:hidden sticky top-0 z-30 bg-[var(--oc-panel)]/95 backdrop-blur border-b border-[var(--oc-line2)]">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Цэс нээх"
              aria-expanded={open}
              className="p-1.5 -ml-1 rounded-lg text-[var(--oc-muted)] hover:text-[var(--oc-ink)] hover:bg-white/[0.06] transition-colors shrink-0"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
              <Brand size="sm" />
            </Link>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            {tenantLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenantLogoUrl}
                alt=""
                className="w-5 h-5 rounded object-contain bg-[var(--oc-panel2)] border border-[var(--oc-line)] shrink-0"
              />
            ) : null}
            <div className="text-xs text-[var(--oc-muted3)] leading-tight truncate max-w-[35vw]">
              {tenantName}
            </div>
            <FeedbackButton
              submitAction={submitStaffFeedback}
              compact
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-[var(--oc-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--oc-ink)]"
            />
            <StaffNotificationBell initialUnread={notificationUnread} />
            <div className="w-8 h-8 rounded-full border border-[var(--oc-line)] bg-[var(--oc-panel2)] flex items-center justify-center text-xs font-bold text-[var(--oc-ink2)] shrink-0">
              {initials}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer — зүүн талаас гулсаж гарах бүрэн навигаци */}
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
          className={`absolute top-0 left-0 h-full w-72 max-w-[85vw] bg-[var(--oc-panel)] border-r border-[var(--oc-line2)] flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-5 h-16 border-b border-[var(--oc-line2)]">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5"
            >
              <Brand />
              <div className="font-plex-mono text-[10px] uppercase tracking-[0.1em] text-[var(--oc-muted3)] leading-none">Админ</div>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Цэс хаах"
              className="p-1.5 rounded-lg text-[var(--oc-muted)] hover:text-[var(--oc-ink)] hover:bg-white/[0.06] transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <SidebarTenantRow
            tenantName={tenantName}
            tenantLogoUrl={tenantLogoUrl}
            notificationUnread={notificationUnread}
            showBell={false}
          />

          <SidebarNavList
            isOwner={isOwner}
            permissions={permissions}
            onNavigate={() => setOpen(false)}
          />

          <SidebarUserFooter
            initials={initials}
            userName={userName}
            userEmail={userEmail}
          />
        </aside>
      </div>
    </>
  );
}
