"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

/**
 * Form-д зориулсан modern dropdown — native <select>-ийн оронд.
 * Hidden input-ээр form submission-д утга илгээнэ. Click-outside + ESC
 * хаагдана. Дотоод state ашиглах ч boldог (`value` prop-гүй үед) — энэ
 * тохиолдолд `defaultValue` ажиллана.
 *
 * Жагсаалтыг `document.body`-руу portal хийж `position: fixed`-ээр
 * байрлуулна (button-ийн bounding rect-ээр тооцно) — эцэг element
 * `overflow-hidden/auto` (жишээ нь modal.tsx-ийн scroll хийдэг content) байсан
 * ч жагсаалт таслагдахгүй/нуугдахгүй байхын тулд (харах: notification-bell.tsx
 * ижил зарчим).
 */
export function Select({
  name,
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder = "— Сонгох —",
  error,
  required,
  disabled,
  id,
  ariaInvalid,
}: {
  name: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  ariaInvalid?: boolean;
}) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState<string>(
    defaultValue ?? "",
  );
  const value = isControlled ? (controlledValue as string) : internalValue;

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  function updatePosition() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }

  function toggle() {
    if (disabled) return;
    if (!open) updatePosition();
    setOpen((p) => !p);
  }

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onReflow() {
      updatePosition();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  function pick(v: string) {
    setOpen(false);
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
  }

  const hasError = Boolean(error) || ariaInvalid;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Hidden field carries value to FormData */}
      <input type="hidden" name={name} value={value} />

      {/* .auth-input class-аар текст input-той яг ижил өндөр/өргөн/border-radius —
          нэг стандарт хэлбэр (харах: globals.css). Зөвхөн flex layout + сонгогдоогүй
          үеийн бүдэг өнгийг энд нэмнэ. */}
      <button
        ref={btnRef}
        type="button"
        id={id}
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={hasError || undefined}
        aria-required={required || undefined}
        className={`auth-input flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
          hasError ? "border-red-500/50" : ""
        }`}
        style={{
          color: selected ? "var(--input-fg)" : "var(--placeholder)",
          cursor: disabled ? "not-allowed" : "pointer",
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
          {selected ? selected.label : placeholder}
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
            opacity: 0.5,
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div className="landing-ops">
              <div
                ref={listRef}
                role="listbox"
                style={{
                  position: "fixed",
                  zIndex: 200,
                  top: pos.top,
                  left: pos.left,
                  width: pos.width,
                  background: "var(--popover)",
                  border: "1px solid var(--input-border)",
                  borderRadius: "0.625rem",
                  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0,0,0,0.4)",
                  overflow: "hidden",
                  padding: "0.25rem 0",
                  maxHeight: "16rem",
                  overflowY: "auto",
                }}
              >
                {!required ? (
                  <SelectOptionRow
                    label={placeholder}
                    active={value === ""}
                    onClick={() => pick("")}
                    muted
                  />
                ) : null}
                {options.map((o) => (
                  <SelectOptionRow
                    key={o.value}
                    label={o.label}
                    hint={o.hint}
                    active={o.value === value}
                    onClick={() => pick(o.value)}
                  />
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function SelectOptionRow({
  label,
  hint,
  active,
  onClick,
  muted = false,
}: {
  label: string;
  hint?: string;
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
        padding: "0.45rem 0.75rem",
        textAlign: "left",
        fontSize: "0.875rem",
        background: active
          ? "var(--select-option-active-bg, rgba(139, 107, 255, 0.18))"
          : hover
            ? "var(--hover-bg)"
            : "transparent",
        color: active
          ? "var(--accent-strong)"
          : muted
            ? "var(--placeholder)"
            : "var(--input-fg)",
        cursor: "pointer",
        border: "none",
        transition: "background 0.1s ease",
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>
        {hint ? (
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--placeholder)",
              marginTop: "0.125rem",
            }}
          >
            {hint}
          </div>
        ) : null}
      </div>
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
