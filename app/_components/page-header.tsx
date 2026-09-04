import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  leading,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Гарчгийн зүүн талд гарах элемент (жишээ нь avatar). */
  leading?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div className="flex items-center gap-3">
        {leading}
        <div>
          <h1 className="text-2xl font-bold text-[var(--oc-ink)]">{title}</h1>
          {description ? (
            <p className="text-[var(--oc-muted3)] text-sm mt-1">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const PRIMARY_LINK_VARIANT = {
  accent:
    "bg-[var(--oc-accent)] hover:bg-[var(--oc-accent-hi)] text-[var(--oc-on-accent)]",
  danger: "bg-red-600 hover:bg-red-500 text-white",
} as const;

export function PrimaryLinkButton({
  href,
  children,
  icon,
  variant = "accent",
}: {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  variant?: keyof typeof PRIMARY_LINK_VARIANT;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 transition-colors px-4 py-2.5 rounded-xl text-sm font-medium ${PRIMARY_LINK_VARIANT[variant]}`}
    >
      {icon ?? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
      {children}
    </Link>
  );
}

export function EmptyState({
  title,
  description,
  cta,
}: {
  title: string;
  description: string;
  cta?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--oc-line)] bg-[var(--oc-panel)] p-12 text-center">
      <div className="text-4xl mb-3">📭</div>
      <h3 className="font-semibold text-[var(--oc-ink)]">{title}</h3>
      <p className="text-[var(--oc-muted3)] text-sm mt-1 mb-4 max-w-sm mx-auto">
        {description}
      </p>
      {cta}
    </div>
  );
}
