"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * URL-н query string-аар жагсаалт шүүх — server component-ууд `searchParams`-аас
 * уншиж Prisma where-руу буулгана.
 */

type Option = { value: string; label: string };

function updateParam(
  params: URLSearchParams,
  key: string,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  if (value) next.set(key, value);
  else next.delete(key);
  // Хайлт солих үед хуудасны pagination-ыг тэгшилнэ
  next.delete("page");
  return next;
}

export function SearchBox({
  placeholder = "Хайх...",
  paramName = "q",
  debounceMs = 300,
  className,
}: {
  placeholder?: string;
  paramName?: string;
  debounceMs?: number;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(paramName) ?? "");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setValue(searchParams.get(paramName) ?? "");
  }, [searchParams, paramName]);

  useEffect(() => {
    const t = setTimeout(() => {
      const current = searchParams.get(paramName) ?? "";
      if (current === value) return;
      const next = updateParam(searchParams, paramName, value);
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      });
    }, debounceMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounceMs]);

  return (
    <div className={`relative ${className ?? "flex-1 min-w-[10rem] sm:flex-none sm:w-56"}`}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="auth-input !py-1.5 !pl-9 !text-sm !rounded-lg"
      />
    </div>
  );
}

/**
 * Modern custom dropdown — native <select>-ийн оронд click-outside хаагдах,
 * сонгосон утга highlight-тай, dark theme-д тохирсон.
 */
export function FilterSelect({
  paramName,
  options,
  placeholder = "Бүгд",
  className,
}: {
  paramName: string;
  options: Option[];
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(paramName) ?? "";
  const [, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label;
  const triggerText = selectedLabel || placeholder;

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(v: string) {
    setOpen(false);
    if (v === value) return;
    const next = updateParam(searchParams, paramName, v);
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  const hasValue = Boolean(value);

  return (
    <div
      ref={wrapperRef}
      className={`relative shrink-0 ${className ?? ""}`}
      style={{ minWidth: "9rem" }}
    >
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          padding: "0.375rem 0.75rem",
          borderRadius: "0.5rem",
          border: `1px solid ${hasValue ? "rgba(139, 107, 255, 0.45)" : "rgba(255, 255, 255, 0.12)"}`,
          background: hasValue
            ? "rgba(108, 71, 255, 0.18)"
            : "rgba(255, 255, 255, 0.04)",
          color: hasValue ? "#e2dafe" : "rgba(255, 255, 255, 0.9)",
          fontSize: "0.875rem",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: "left",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {triggerText}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 50,
            marginTop: "0.25rem",
            width: "max-content",
            minWidth: "100%",
            maxWidth: "20rem",
            background: "#15151f",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "0.75rem",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0,0,0,0.4)",
            overflow: "hidden",
            padding: "0.25rem 0",
          }}
        >
          <DropdownOption
            label={placeholder}
            active={value === ""}
            onClick={() => pick("")}
            muted
          />
          {options.length > 0 ? (
            <div
              style={{
                height: "1px",
                background: "rgba(255, 255, 255, 0.06)",
                margin: "0.125rem 0.5rem",
              }}
            />
          ) : null}
          <div style={{ maxHeight: "18rem", overflowY: "auto" }}>
            {options.map((o) => (
              <DropdownOption
                key={o.value}
                label={o.label}
                active={o.value === value}
                onClick={() => pick(o.value)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DropdownOption({
  label,
  active,
  onClick,
  muted = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  muted?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.5rem",
        padding: "0.4rem 0.75rem",
        textAlign: "left",
        fontSize: "0.875rem",
        background: active
          ? "rgba(139, 107, 255, 0.18)"
          : hover
            ? "rgba(255, 255, 255, 0.06)"
            : "transparent",
        color: active
          ? "#e2dafe"
          : muted
            ? "rgba(255, 255, 255, 0.7)"
            : "rgba(255, 255, 255, 0.92)",
        cursor: "pointer",
        border: "none",
        transition: "background 0.1s ease",
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
      {active ? (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : null}
    </button>
  );
}

export function ResetFilters({
  paramNames,
}: {
  paramNames: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = paramNames.some((k) => searchParams.get(k));
  if (!active) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const next = new URLSearchParams(searchParams.toString());
        for (const k of paramNames) next.delete(k);
        next.delete("page");
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      }}
      className="shrink-0 text-xs text-white/40 hover:text-white/80 underline underline-offset-2 whitespace-nowrap"
    >
      Цэвэрлэх
    </button>
  );
}
