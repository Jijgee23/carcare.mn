"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Collapsed sidebar rail дотор hover flyout байрлуулах helper — admin-sidebar.tsx
// болон system-sidebar.tsx хоёул хуваалцана. `nav`-ийн эцэг элемент нь
// `overflow-y-auto` тул (CSS-ийн дүрмээр overflow-x нь мөн "auto" болж, хажуу
// тийш гарсан зүйлийг таслачихдаг) `absolute`-аар байрлуулсан tooltip/цэс
// харагдахгүй байсан — тиймээс `document.body`-руу portal хийж, trigger-ийн
// bounding rect дээр үндэслэн `position: fixed`-ээр байрлуулна (DatePicker-тэй
// ижил зарчим). Портал хийсэн ч hover тасрахгүйн тулд flyout дээр очиход ч мөн
// нээлттэй хэвээр байлгаж, бага зэрэг саатал (120ms)-тайгаар хаана.
export type FlyoutPos = { top: number; left: number };

export function useHoverFlyout() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<FlyoutPos>({ top: 0, left: 0 });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  function onEnter() {
    clearCloseTimer();
    const el = anchorRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ top: r.top, left: r.right + 12 });
    }
    setOpen(true);
  }
  function onLeave() {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }
  useEffect(() => clearCloseTimer, []);

  return { anchorRef, open, pos, onEnter, onLeave };
}

export function HoverFlyoutPortal({
  pos,
  open,
  onEnter,
  onLeave,
  center,
  children,
}: {
  pos: FlyoutPos;
  open: boolean;
  onEnter: () => void;
  onLeave: () => void;
  center?: boolean;
  children: React.ReactNode;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ position: "fixed", top: pos.top, left: pos.left }}
      className={`sidebar-tooltip z-[200] origin-left transition-all ${center ? "-translate-y-1/2" : ""
        } ${open ? "pointer-events-auto opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"}`}
    >
      {children}
    </div>,
    document.body,
  );
}
