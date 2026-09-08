"use client";

import { useState } from "react";

// Хуваарийн мөрийн "Удирдах" хэсгийг эхэндээ хумигдсан байлгана — өдрийн
// жагсаалт олон мөртэй (болзошгүй олон захиалга/цаг захиалга) үед бүх мөрийн
// үйлдлийн товчнууд байнга дэлгэгдвэл харах боломжгүй болно.
export function RowExpand({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-plex-mono text-[10px] px-2 py-1 rounded-full border border-[var(--oc-line)] bg-[var(--oc-panel2)] text-[var(--oc-muted3)] hover:border-[var(--oc-line2)] hover:bg-white/[0.05] transition-colors shrink-0"
      >
        {open ? "Хаах ▴" : "Удирдах ▾"}
      </button>
      {open ? (
        <div className="basis-full pt-2 flex flex-wrap items-center gap-2">
          {children}
        </div>
      ) : null}
    </>
  );
}
