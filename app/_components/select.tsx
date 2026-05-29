"use client";

import { useEffect, useRef, useState } from "react";

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

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
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
  }

  const hasError = Boolean(error) || ariaInvalid;
  const borderColor = hasError
    ? "rgba(239, 68, 68, 0.5)"
    : "rgba(255, 255, 255, 0.1)";

  return (
    <div
      ref={wrapperRef}
      style={{ position: "relative", width: "100%" }}
    >
      {/* Hidden field carries value to FormData */}
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        id={id}
        onClick={() => !disabled && setOpen((p) => !p)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={hasError || undefined}
        aria-required={required || undefined}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          padding: "0.5rem 0.75rem",
          borderRadius: "0.5rem",
          border: `1px solid ${borderColor}`,
          background: "rgba(255, 255, 255, 0.04)",
          color: selected ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.4)",
          fontSize: "0.875rem",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          textAlign: "left",
          transition: "border-color 0.15s ease",
          outline: "none",
        }}
        onFocus={(e) => {
          if (!hasError) e.currentTarget.style.borderColor = "rgba(139, 107, 255, 0.5)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = borderColor;
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

      {open ? (
        <div
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 50,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "0.25rem",
            background: "#15151f",
            border: "1px solid rgba(255, 255, 255, 0.12)",
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
      ) : null}
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
          ? "rgba(139, 107, 255, 0.18)"
          : hover
            ? "rgba(255, 255, 255, 0.06)"
            : "transparent",
        color: active
          ? "#e2dafe"
          : muted
            ? "rgba(255, 255, 255, 0.55)"
            : "rgba(255, 255, 255, 0.92)",
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
              color: "rgba(255, 255, 255, 0.4)",
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
