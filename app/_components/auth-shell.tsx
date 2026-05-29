import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./brand";

export function AuthShell({
  title,
  subtitle,
  footer,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-blue-600/8 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <Link href="/">
          <Brand />
        </Link>
        <Link
          href="/page/landing"
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          ← Нүүр
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className={`w-full ${wide ? "max-w-5xl" : "max-w-xl"}`}>
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">{title}</h1>
            {subtitle ? (
              <p className="text-white/40 text-sm">{subtitle}</p>
            ) : null}
          </div>

          <div className="glass rounded-2xl p-6 sm:p-8 border border-white/[0.08]">
            {children}
          </div>

          {footer ? (
            <p className="text-center text-sm text-white/40 mt-6">{footer}</p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-white/70">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-red-400 text-xs">{error}</p>
      ) : hint ? (
        <p className="text-xs text-white/30">{hint}</p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
}: {
  pending?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
    >
      {pending ? <Spinner /> : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
      <svg
        className="w-4 h-4 text-red-400 mt-0.5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="text-red-400 text-sm">{message}</p>
    </div>
  );
}

export function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8z"
      />
    </svg>
  );
}
