"use client";

import { useState } from "react";
import { formatTugrik } from "@/lib/orders";
import type { IncomePoint } from "./income-chart";

// Compact axis label: 1.2сая / 350мян / 120
function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000)
    return `${(v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}сая`;
  if (a >= 1_000) return `${Math.round(v / 1_000)}мян`;
  return String(Math.round(v));
}

export function IncomeBarChart({ points }: { points: IncomePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const hasData = values.some((v) => v > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 text-center h-[180px]">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--oc-muted4)]"
          aria-hidden="true"
        >
          <path d="M3 3v18h18" />
          <path d="m7 15 4-5 3 3 4-6" />
        </svg>
        <p className="text-sm text-[var(--oc-muted3)]">
          Энэ хугацаанд орлого бүртгэгдээгүй байна.
        </p>
      </div>
    );
  }

  // Сүүлийн (өнөөдрийн) багана анхдагчаар онцлогдоно — hover үед сонгосон нь.
  const highlighted = hover ?? points.length - 1;

  return (
    <div className="flex items-end gap-2 sm:gap-3 h-[180px]">
      {points.map((p, i) => {
        const pct = Math.max(2, Math.round((p.value / max) * 100));
        const active = i === highlighted;
        return (
          <div
            key={`${p.label}-${i}`}
            className="flex-1 min-w-0 flex flex-col items-center gap-2 h-full"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="flex-1 w-full flex flex-col justify-end">
              <span
                className={`block text-center font-plex-mono text-[10px] sm:text-[11px] mb-1.5 transition-colors ${
                  active ? "text-[var(--oc-ink2)]" : "text-[var(--oc-muted3)]"
                }`}
              >
                {compact(p.value)}
              </span>
              <div
                title={`${p.label}: ${formatTugrik(p.value)}`}
                className={`w-full rounded-sm transition-colors ${
                  active ? "bg-[var(--oc-accent)]" : "bg-[var(--oc-accent)]/20"
                }`}
                style={{ height: `${pct}%`, minHeight: 4 }}
              />
            </div>
            <span className="font-plex-mono text-[10px] sm:text-[11px] text-[var(--oc-muted3)] whitespace-nowrap">
              {p.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
