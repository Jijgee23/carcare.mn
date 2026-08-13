"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

/* Жагсаалтын мөрийн «⋯» үйлдлийн цэс. Аюултай үйлдлүүдийг (устгах г.м)
   мөрөн дээр ил байлгахын оронд энд нууна. Цэс нь position:fixed тул
   хүснэгтийн overflow контейнерт таслагдахгүй; scroll/resize хийвэл хаагдана. */

const CloseCtx = createContext<() => void>(() => {});

export function RowActionsMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
    }
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className="flex justify-end" data-stop-row-click>
      <button
        ref={btnRef}
        type="button"
        aria-label="Үйлдэл"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>
      {open && pos ? (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 50 }}
          className="min-w-40 rounded-xl border border-white/10 bg-[var(--surface)] shadow-2xl p-1"
        >
          <CloseCtx.Provider value={() => setOpen(false)}>
            {children}
          </CloseCtx.Provider>
        </div>
      ) : null}
    </div>
  );
}

/* Цэсний server action-той item (жишээ нь устгах). confirmMessage өгвөл
   баталгаажуулалт асууна. */
export function RowMenuFormItem({
  action,
  hidden,
  confirmMessage,
  destructive,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hidden?: Record<string, string>;
  confirmMessage?: string;
  destructive?: boolean;
  children: ReactNode;
}) {
  const close = useContext(CloseCtx);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          e.preventDefault();
          return;
        }
        close();
      }}
    >
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        role="menuitem"
        className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
          destructive
            ? "text-red-400 hover:bg-red-500/10 light:text-red-600"
            : "text-white/80 hover:bg-white/[0.06]"
        }`}
      >
        {children}
      </button>
    </form>
  );
}
