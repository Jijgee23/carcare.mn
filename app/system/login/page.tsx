import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Brand } from "@/app/_components/brand";
import { SystemLoginForm } from "./login-form";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata = {
  title: "Системийн нэвтрэх",
};

export default function SystemLoginPage() {
  return (
    <div
      className={`${plexSans.variable} ${plexMono.variable} landing-ops relative min-h-screen flex flex-col bg-[var(--oc-carbon)] bg-oc-grid overflow-hidden`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_520px_at_50%_0%,rgba(239,68,68,0.12),transparent_70%)]" />

      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--oc-line2)]">
        <Link href="/" className="flex items-center gap-2.5">
          <Brand />
          <span className="font-plex-mono text-[11px] uppercase tracking-[0.14em] text-red-400 border-l border-[var(--oc-line)] pl-2.5">
            System
          </span>
        </Link>
        <Link
          href="/page/landing"
          className="text-[13px] text-[var(--oc-muted2)] hover:text-[var(--oc-ink)] transition-colors"
        >
          ← Нүүр
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-[var(--oc-panel)] px-3 py-1.5 font-plex-mono text-[12px] text-red-300 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Платформын админ
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-[var(--oc-ink)]">
              Системийн нэвтрэх
            </h1>
            <p className="text-[var(--oc-muted3)] text-sm mt-2">
              Зөвхөн carservice.mn-ын эзэн нэвтрэх боломжтой.
            </p>
          </div>

          <div className="rounded-[10px] border border-red-500/20 bg-[var(--oc-panel)] p-6 sm:p-8">
            <SystemLoginForm />
          </div>

          <p className="text-center text-xs text-[var(--oc-muted3)] mt-6">
            Энэ хуудас нь сервис үзүүлэгчийн ажилтанд зориулагдсан. Та сервис
            эзэн үү?{" "}
            <Link
              href="/page/login"
              className="text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
            >
              Энд нэвтэр
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
