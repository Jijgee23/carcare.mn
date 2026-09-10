"use client";

// Багцын хэрэглээ vs хязгаарыг харуулах animated radial progress ring.
// Өнгө: ok (emerald) < 70% < warn (--oc-warn) < 90% < bad (red) — тоон утга
// (төв дэх фракц) хэвээр харагдана тул өнгө ганцаараа мэдээлэл дамжуулахгүй.

import Link from "next/link";
import { useEffect, useState } from "react";

const SIZE = 92;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

type Tone = "ok" | "warn" | "bad";

function resolveTone(pct: number | null): Tone {
  if (pct == null) return "ok";
  if (pct >= 90) return "bad";
  if (pct >= 70) return "warn";
  return "ok";
}

const TONE_COLOR: Record<Tone, string> = {
  ok: "#34d399", // emerald-400
  warn: "var(--oc-warn)",
  bad: "#f87171", // red-400
};

export function PlanUsageRing({
  label,
  current,
  limit,
  href,
}: {
  label: string;
  current: number;
  limit: number | null;
  href?: string;
}) {
  const pct =
    limit == null ? 0 : limit <= 0 ? 100 : Math.min(100, (current / limit) * 100);
  const tone = resolveTone(limit == null ? null : pct);
  const color = TONE_COLOR[tone];

  // Ring-ийг 0-оос эхлүүлж бодит хувь хүртэл "ургуулна" — animated эффект.
  const [drawnPct, setDrawnPct] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawnPct(pct));
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  const offset = CIRC - (drawnPct / 100) * CIRC;

  const inner = (
    <div className="group flex flex-col items-center gap-2">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-white/[0.07] light:stroke-black/[0.07]"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{
              transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-plex-mono text-[13px] font-semibold tabular-nums text-[var(--oc-ink)]">
            {limit == null ? current.toLocaleString("mn-MN") : `${current}/${limit}`}
          </span>
          <span className="font-plex-mono text-[10px] text-[var(--oc-muted3)]">
            {limit == null ? "хязгааргүй" : `${Math.round(pct)}%`}
          </span>
        </div>
      </div>
      <span className="font-plex-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--oc-muted3)] text-center group-hover:text-[var(--oc-ink2)] transition-colors">
        {label}
      </span>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
