"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "./brand";

const links = [
  { href: "#features", label: "Боломжууд" },
  { href: "#how", label: "Хэрхэн ажилладаг" },
  { href: "#pricing", label: "Үнэ" },
  { href: "#faq", label: "Асуулт хариулт" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href="/">
          <Brand />
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-white/60">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="hover:text-white transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/page/login"
            className="text-sm text-white/70 hover:text-white transition-colors px-3 py-1.5"
          >
            Нэвтрэх
          </Link>
          <Link
            href="/page/signup"
            className="text-sm font-medium bg-violet-600 hover:bg-violet-500 transition-colors px-4 py-1.5 rounded-lg"
          >
            Бүртгүүлэх
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Цэс хаах" : "Цэс нээх"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden w-10 h-10 rounded-lg glass flex items-center justify-center"
        >
          <span className="block w-5 h-0.5 bg-white relative">
            <span
              className={`absolute left-0 w-5 h-0.5 bg-white transition-transform ${
                open ? "rotate-45 top-0" : "-top-1.5"
              }`}
            />
            <span
              className={`absolute left-0 w-5 h-0.5 bg-white transition-transform ${
                open ? "-rotate-45 top-0" : "top-1.5"
              }`}
            />
          </span>
        </button>
      </div>

      {open ? (
        <div className="md:hidden border-t border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-3 py-3 rounded-xl text-base font-medium text-white/80 hover:bg-white/[0.05]"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link
                href="/page/login"
                onClick={() => setOpen(false)}
                className="h-11 inline-flex items-center justify-center rounded-xl glass text-sm font-medium"
              >
                Нэвтрэх
              </Link>
              <Link
                href="/page/signup"
                onClick={() => setOpen(false)}
                className="h-11 inline-flex items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium"
              >
                Бүртгүүлэх
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
