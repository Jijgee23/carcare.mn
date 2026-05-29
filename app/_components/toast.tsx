"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "success" | "error" | "info" | "warning";

type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  description?: string;
  durationMs: number;
};

type ToastInput = {
  message: string;
  description?: string;
  kind?: ToastKind;
  durationMs?: number;
};

type ToastContextValue = {
  show: (input: ToastInput) => string;
  success: (message: string, description?: string) => string;
  error: (message: string, description?: string) => string;
  info: (message: string, description?: string) => string;
  warning: (message: string, description?: string) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

const DEFAULT_DURATION = 4000;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((input: ToastInput): string => {
    const id = makeId();
    const t: Toast = {
      id,
      kind: input.kind ?? "info",
      message: input.message,
      description: input.description,
      durationMs: input.durationMs ?? DEFAULT_DURATION,
    };
    setToasts((prev) => [...prev, t]);
    return id;
  }, []);

  const value: ToastContextValue = {
    show,
    success: (message, description) =>
      show({ message, description, kind: "success" }),
    error: (message, description) =>
      show({ message, description, kind: "error", durationMs: 6000 }),
    info: (message, description) =>
      show({ message, description, kind: "info" }),
    warning: (message, description) =>
      show({ message, description, kind: "warning" }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

const KIND_STYLES: Record<ToastKind, string> = {
  success:
    "border-emerald-500/30 bg-emerald-500/[0.12] text-emerald-100",
  error: "border-red-500/30 bg-red-500/[0.12] text-red-100",
  info: "border-violet-500/30 bg-violet-500/[0.12] text-violet-100",
  warning: "border-amber-500/30 bg-amber-500/[0.12] text-amber-100",
};

const KIND_ICON: Record<ToastKind, ReactNode> = {
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  warning: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const t = setTimeout(onDismiss, toast.durationMs);
    return () => clearTimeout(t);
  }, [toast.durationMs, onDismiss]);

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 backdrop-blur-md shadow-lg ${KIND_STYLES[toast.kind]}`}
    >
      <span className="mt-0.5 shrink-0">{KIND_ICON[toast.kind]}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{toast.message}</div>
        {toast.description ? (
          <div className="text-xs opacity-80 mt-0.5">{toast.description}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-xs opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Хаах"
      >
        ✕
      </button>
    </div>
  );
}
