import Link from "next/link";
import { Brand } from "@/app/_components/brand";
import { SystemLoginForm } from "./login-form";

export const metadata = {
  title: "Системийн нэвтрэх",
};

export default function SystemLoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-2.5">
          <Brand />
          <span className="text-xs text-red-400 font-mono">SYSTEM</span>
        </Link>
        <Link
          href="/page/landing"
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          ← Нүүр
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 glass border border-red-500/30 rounded-full px-4 py-1.5 text-xs text-red-300 mb-4">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              Платформын админ
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Системийн нэвтрэх</h1>
            <p className="text-white/40 text-sm mt-2">
              Зөвхөн carcare.mn-ын эзэн нэвтрэх боломжтой.
            </p>
          </div>

          <div className="glass rounded-2xl p-6 sm:p-8 border border-red-500/20">
            <SystemLoginForm />
          </div>

          <p className="text-center text-xs text-white/30 mt-6">
            Энэ хуудас нь сервис үзүүлэгчийн ажилтанд зориулагдсан. Та сервис
            эзэн юу?{" "}
            <Link
              href="/page/login"
              className="text-violet-400 hover:text-violet-300"
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
