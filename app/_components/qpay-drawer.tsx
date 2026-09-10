"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * QPay төлбөрийн QR-ыг харуулах нэгдсэн slide-over — desktop дээр баруунаас
 * гарч ирнэ, mobile дээр (<640px) доороос sheet болж гарна. Ард нь backdrop
 * blur хийж бусад агуулгыг бүдгэрүүлнэ. Хаах товч + ESC + backdrop дарахад
 * хаагдана (харин QPay invoice-ийг өөрөө цуцлахгүй — зөвхөн UI-г нуух/дахин
 * нээх боломжтой, "Цуцлах" тусдаа тодорхой үйлдэл хэвээр).
 */
export function QPayDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 640);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Нээгдэх frame дээр шууд slide-in хийвэл transition ажиллахгүй тул
    // дараагийн frame-д "орсон" төлөвт шилжүүлнэ; хаагдахад (cleanup)
    // дараагийн удаа дахин анимацилахын тулд буцаана.
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true)),
    );
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      setEntered(false);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    // `document.body`-руу шууд portal хийдэг тул dashboard-ийн `.landing-ops`
    // wrapper-ийн гадна гарна — тэнд л тодорхойлогдсон `--oc-accent` зэрэг
    // CSS хувьсагчид энд байхгүй болж, товч/border/текстийн өнгө алдагдана.
    // Тул энд дахин тодорхойлно (className нэрийг давхардуулснаар СAS
    // хувьсагчийг дахин тооцно, layout-д нөлөөлөхгүй — доторх бүх элемент
    // `fixed` тул эцэг element-ийн хэмжээнээс үл хамаарна).
    <div className="landing-ops">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Хаах"
        onClick={onClose}
        className={`fixed inset-0 z-[100] cursor-default bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed z-[110] flex flex-col bg-[var(--oc-panel)] shadow-2xl transition-transform duration-300 ease-out ${
          isMobile
            ? `inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl border-t border-[var(--oc-line)] ${
                entered ? "translate-y-0" : "translate-y-full"
              }`
            : `inset-y-0 right-0 w-full max-w-[34rem] border-l border-[var(--oc-line)] ${
                entered ? "translate-x-0" : "translate-x-full"
              }`
        }`}
      >
        {isMobile ? (
          <div className="mx-auto mt-2 mb-1 h-1 w-10 shrink-0 rounded-full bg-[var(--oc-line2)]" />
        ) : null}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--oc-line)] shrink-0">
          <h2 className="font-semibold text-[var(--oc-ink)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Хаах"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-[var(--oc-muted3)] hover:text-[var(--oc-ink)] hover:bg-white/[0.08] transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
