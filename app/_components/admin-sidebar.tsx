"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/_actions/auth";
import { Brand } from "./brand";
import { StaffNotificationBell } from "./staff-notification-bell";

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
      { href: "/dashboard/services/labor", label: "Ажил" },
      { href: "/dashboard/services/diagnostics", label: "Оношилгоо" },
      { href: "/dashboard/services/goods", label: "Сэлбэг / Бараа" },
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

// Тенант мөр — лого + нэр + (заавал биш) мэдэгдлийн хонх.
function SidebarTenantRow({
  tenantName,
  tenantLogoUrl,
  notificationUnread,
  showBell = true,
}: {
  tenantName: string;
  tenantLogoUrl?: string | null;
  notificationUnread: number;
  showBell?: boolean;
}) {
  return (
    <div className="px-3 pt-3 pb-2 flex items-center gap-2 text-xs text-white/40 min-w-0">
      {tenantLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tenantLogoUrl}
          alt=""
          className="w-5 h-5 rounded object-contain bg-white/[0.04] border border-white/[0.06] shrink-0"
        />
      ) : null}
      <span className="truncate flex-1 min-w-0">{tenantName}</span>
      {showBell ? (
        <StaffNotificationBell initialUnread={notificationUnread} align="left" />
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
}: {
  isOwner: boolean;
  permissions: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visibleNav = navItems.filter((it) =>
    canSeeView(it.view, isOwner, permissions),
  );
  const visibleSecondary = secondaryItems.filter((it) =>
    canSeeView(it.view, isOwner, permissions),
  );

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
    <nav className="flex-1 overflow-y-auto pb-4 px-3 space-y-0.5">
      {visibleNav.map((item) =>
        hasChildren(item) ? (
          <NavGroupItem
            key={item.href}
            item={item}
            pathname={pathname}
            open={isOpen(item.href)}
            onToggle={() => toggleGroup(item.href)}
            onNavigate={onNavigate}
          />
        ) : (
          <NavLeafLink
            key={item.href}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ),
      )}

      {visibleSecondary.length > 0 ? (
        <div className="pt-4 pb-2 px-3 text-[10px] text-white/30 uppercase tracking-wider">
          Бусад
        </div>
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
          />
        ) : (
          <NavLeafLink
            key={item.href}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ),
      )}
    </nav>
  );
}

// Хэрэглэгчийн footer — нэр, и-мэйл, гарах товч.
function SidebarUserFooter({
  initials,
  userName,
  userEmail,
}: {
  initials: string;
  userName: string;
  userEmail: string;
}) {
  return (
    <div className="p-3 border-t border-white/[0.06] space-y-2">
      <div className="flex items-center gap-3 p-2.5 rounded-xl">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xs font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white/80 truncate">
            {userName}
          </div>
          <div className="text-xs text-white/30 truncate">{userEmail}</div>
        </div>
      </div>
      <form action={signOutAction}>
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
  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-[#0d0d14] border-r border-white/[0.06] flex-col z-40 hidden lg:flex">
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 px-5 h-16 border-b border-white/[0.06]"
      >
        <Brand />
        <div className="text-[10px] text-white/30 leading-none">Админ</div>
      </Link>

      <SidebarTenantRow
        tenantName={tenantName}
        tenantLogoUrl={tenantLogoUrl}
        notificationUnread={notificationUnread}
      />

      <SidebarNavList isOwner={isOwner} permissions={permissions} />

      <SidebarUserFooter
        initials={initials}
        userName={userName}
        userEmail={userEmail}
      />
    </aside>
  );
}

function NavLeafLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavLeaf;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isLeafActive(pathname, item);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
        active
          ? "is-active bg-violet-600/20 text-violet-300 border border-violet-500/25"
          : "text-white/50 hover:text-white"
      }`}
    >
      {item.icon ? (
        <span className={`nav-icon ${active ? "text-violet-400" : "text-white/40"}`}>
          {item.icon}
        </span>
      ) : null}
      {item.label}
    </Link>
  );
}

function NavGroupItem({
  item,
  pathname,
  open,
  onToggle,
  onNavigate,
}: {
  item: NavGroup;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const parentActive = isGroupActive(pathname, item);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
          parentActive
            ? "is-active bg-violet-600/20 text-violet-300 border border-violet-500/25"
            : "text-white/50 hover:text-white"
        }`}
        aria-expanded={open}
      >
        {item.icon ? (
          <span className={`nav-icon ${parentActive ? "text-violet-400" : "text-white/40"}`}>
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
          } ${parentActive ? "text-violet-400/80" : "text-white/30"}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {open ? (
        <div className="mt-0.5 ml-3 pl-3 border-l border-white/[0.06] space-y-0.5">
          {item.children.map((child) => {
            const childActive = isLeafActive(pathname, child);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={`nav-item flex items-center px-3 py-1.5 rounded-lg text-sm ${
                  childActive
                    ? "is-active bg-violet-500/10 text-violet-200"
                    : "text-white/45 hover:text-white"
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
                className="w-5 h-5 rounded object-contain bg-white/[0.04] border border-white/[0.06] shrink-0"
              />
            ) : null}
            <div className="text-xs text-white/40 leading-tight truncate max-w-[35vw]">
              {tenantName}
            </div>
            <StaffNotificationBell initialUnread={notificationUnread} />
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xs font-bold shrink-0">
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
          className={`absolute top-0 left-0 h-full w-72 max-w-[85vw] bg-[#0d0d14] border-r border-white/[0.06] flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-5 h-16 border-b border-white/[0.06]">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5"
            >
              <Brand />
              <div className="text-[10px] text-white/30 leading-none">Админ</div>
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
