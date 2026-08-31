import Link from "next/link";
import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-[1240px] px-8 ${className}`}>{children}</div>;
}

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent font-mono text-[13px] font-semibold text-carbon">
        CC
      </div>
      <span className="text-[16px] font-semibold tracking-[-0.01em] text-ink2">carcare.mn</span>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[12px] uppercase tracking-[0.14em] text-accent">{children}</div>
  );
}

export function ButtonPrimary({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg bg-accent px-6 py-[15px] text-[15px] font-semibold text-carbon transition-colors hover:bg-accentHi hover:text-carbon"
    >
      {children}
    </Link>
  );
}

export function ButtonGhost({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-[#2A2D33] px-6 py-[15px] text-[15px] font-medium text-ink2 transition-colors hover:border-[#3D424A] hover:bg-[#14181D] hover:text-ink2"
    >
      {children}
    </Link>
  );
}

export function StatusPill({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-ok" />
      <span className="font-mono text-[12.5px] text-muted">{children}</span>
    </div>
  );
}
