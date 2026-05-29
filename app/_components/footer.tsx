import Link from "next/link";
import { Brand } from "./brand";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link href="/">
            <Brand size="sm" />
          </Link>

          <nav className="flex flex-wrap justify-center gap-6 text-sm text-white/40">
            <a href="#features" className="hover:text-white/70 transition-colors">
              Боломжууд
            </a>
            <a href="#pricing" className="hover:text-white/70 transition-colors">
              Үнэ
            </a>
            <a href="/terms" className="hover:text-white/70 transition-colors">
              Нөхцөл
            </a>
            <a href="/privacy" className="hover:text-white/70 transition-colors">
              Нууцлал
            </a>
            <a href="mailto:hi@carcare.mn" className="hover:text-white/70 transition-colors">
              Холбоо барих
            </a>
          </nav>

          <p className="text-xs text-white/20">
            © {new Date().getFullYear()} carcare.mn
          </p>
        </div>
      </div>
    </footer>
  );
}
