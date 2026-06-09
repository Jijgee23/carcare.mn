import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./brand";

const HIGHLIGHTS = [
  "Захиалга, машины түүх — нэг дороос",
  "Онлайн цаг захиалга, SMS сануулга",
  "Бодит цагийн тайлан, нөөц хяналт",
];

function BrandPanel() {
  return (
    <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white">
      {/* Гүн, зөөлөн өнгөт дэвсгэр (нүд гялбуулахгүй) */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-800 via-indigo-900 to-[#0b0b12]" />
      <div className="absolute -top-24 -left-16 w-96 h-96 bg-violet-500/15 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/12 rounded-full blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.05),transparent_55%)]" />

      <Link href="/" className="relative flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.png"
          alt="carcare"
          className="w-9 h-9 rounded-xl object-contain bg-white/10"
        />
        <span className="font-bold text-xl tracking-tight">carcare</span>
      </Link>

      <div className="relative max-w-sm">
        <h2 className="text-3xl font-bold leading-tight">
          Сервисээ ухаалгаар удирдаарай
        </h2>
        <p className="mt-3 text-white/80 leading-relaxed">
          Авто үйлчилгээний бүх ажиллагааг нэг платформоос.
        </p>
        <ul className="mt-7 space-y-3">
          {HIGHLIGHTS.map((h) => (
            <li key={h} className="flex items-start gap-2.5 text-white/90">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs">
                ✓
              </span>
              <span className="text-sm">{h}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-sm text-white/70">
        100+ сервис төв carcare дээр ажиллаж байна.
      </p>
    </aside>
  );
}

function FormPanel({
  title,
  subtitle,
  footer,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
  wide: boolean;
}) {
  return (
    <main className="relative flex flex-col">
      {/* Зөөлөн гэрэлт дэвсгэр */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 right-0 w-80 h-80 bg-violet-600/12 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <Link href="/" className="lg:hidden">
          <Brand />
        </Link>
        <span className="hidden lg:block" />
        <Link
          href="/page/landing"
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          ← Нүүр
        </Link>
      </header>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-10 sm:py-12">
        <div className={`w-full ${wide ? "max-w-4xl" : "max-w-md"}`}>
          <div className="mb-7 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-white/50 text-sm">{subtitle}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl p-6 sm:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
            {children}
          </div>

          {footer ? (
            <p className="mt-6 text-center text-sm text-white/45">{footer}</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

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
  // Өргөн (signup) — төвлөрсөн. Бусад (login/forgot) — зүүн талд өнгөт панелтай.
  if (wide) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
        <FormPanel title={title} subtitle={subtitle} footer={footer} wide>
          {children}
        </FormPanel>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] lg:grid lg:grid-cols-2">
      <BrandPanel />
      <FormPanel title={title} subtitle={subtitle} footer={footer} wide={false}>
        {children}
      </FormPanel>
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
