"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutSystemAction } from "@/app/_actions/system-auth";
import { Brand } from "./brand";

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
  // Зөвхөн хөгжүүлэлтэд — SMS-гүйгээр нэвтрэх OTP кодуудыг харах.
  ...(process.env.NODE_ENV !== "production"
    ? [
        {
          href: "/system/otp",
          label: "OTP (dev)",
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7.5" cy="15.5" r="4.5" />
              <path d="m10.5 12.5 7-7" />
              <path d="m17 7 2 2" />
              <path d="m14 8 2 2" />
            </svg>
          ),
        },
      ]
    : []),
];

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
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-[#0d0d14] border-r border-red-500/[0.15] flex-col z-40 hidden lg:flex">
      <Link
        href="/system"
        className="flex items-center gap-2.5 px-5 h-16 border-b border-white/[0.06]"
      >
        <Brand />
        <div className="text-[10px] text-red-400 font-mono leading-none">
          SYSTEM
        </div>
      </Link>

      <div className="px-4 pt-4 pb-2 text-[10px] text-red-400/70 uppercase tracking-wider">
        Платформын админ
      </div>

      <nav className="flex-1 overflow-y-auto pb-4 px-3 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-red-500/15 text-red-200 border border-red-500/25"
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
              }`}
            >
              <span className={active ? "text-red-400" : "text-white/40"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/[0.06] space-y-2">
        <div className="flex items-center gap-3 p-2.5 rounded-xl">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-violet-500 flex items-center justify-center text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white/80 truncate">
              {adminName}
            </div>
            <div className="text-xs text-white/30 truncate">{adminEmail}</div>
          </div>
        </div>
        <form action={signOutSystemAction}>
          <button
            type="submit"
            className="w-full text-sm text-white/50 hover:text-white transition-colors px-3 py-2 rounded-xl hover:bg-white/[0.04] text-left"
          >
            Гарах
          </button>
        </form>
      </div>
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
    <header className="lg:hidden sticky top-0 z-30 glass border-b border-red-500/[0.15]">
      <div className="px-4 py-3 flex items-center justify-between">
        <Link href="/system" className="flex items-center gap-2">
          <Brand size="sm" />
          <span className="text-[10px] text-red-400 font-mono">SYSTEM</span>
        </Link>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-violet-500 flex items-center justify-center text-xs font-bold">
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
                  ? "bg-red-500/15 text-red-200 border border-red-500/25"
                  : "text-white/50 border border-white/[0.06]"
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
