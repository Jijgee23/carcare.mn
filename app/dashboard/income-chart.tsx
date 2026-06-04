"use client";

import { useEffect, useRef, useState } from "react";
import { formatTugrik } from "@/lib/orders";

export type IncomePoint = { label: string; value: number };

const H = 160;
const PAD = { top: 12, right: 10, bottom: 22, left: 48 };

// Short axis labels: 1.2сая / 350мян / 120
function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000)
    return `${(v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}сая`;
  if (a >= 1_000) return `${Math.round(v / 1_000)}мян`;
  return String(Math.round(v));
}

// Smooth S-curve through inner-space points + a closed area path.
function buildPaths(pts: { x: number; y: number }[], baseY: number) {
  if (pts.length === 0) return { line: "", area: "" };
  if (pts.length === 1) return { line: `M ${pts[0].x} ${pts[0].y}`, area: "" };
  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cx = (p0.x + p1.x) / 2;
    line += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  const last = pts[pts.length - 1];
  const area = `${line} L ${last.x} ${baseY} L ${pts[0].x} ${baseY} Z`;
  return { line, area };
}

export function IncomeChart({
  points,
  up,
}: {
  points: IncomePoint[];
  up: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [animated, setAnimated] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;

  const values = points.map((p) => p.value);
  const maxVal = Math.max(...values, 1);

  const toX = (i: number) =>
    points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2;
  const toY = (v: number) => innerH - (v / maxVal) * innerH;

  const coords = points.map((p, i) => ({ x: toX(i), y: toY(p.value) }));
  const { line, area } = buildPaths(coords, innerH);

  const stroke = up ? "#34d399" : "#f87171"; // emerald-400 / red-400
  const fillId = up ? "incUp" : "incDown";
  const ticks = [0, 1, 2, 3].map((i) => (maxVal / 3) * i);
  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = width / rect.width || 1;
    const xInChart = (e.clientX - rect.left) * scale - PAD.left;
    const pct = innerW > 0 ? xInChart / innerW : 0;
    const idx = Math.round(pct * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, idx)));
  }

  const hv = hover != null ? points[hover] : null;
  const hx = hover != null ? coords[hover].x + PAD.left : 0;
  const hy = hover != null ? coords[hover].y + PAD.top : 0;

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* hover tooltip */}
      {hv ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-[#14141f]/95 px-2.5 py-1.5 backdrop-blur-sm"
          style={{
            left: Math.max(54, Math.min(width - 54, hx)),
            top: Math.max(28, hy - 8),
          }}
        >
          <div className="text-[11px] font-semibold text-white tabular-nums">
            {formatTugrik(hv.value)}
          </div>
          <div className="text-[10px] text-white/40">{hv.label}</div>
        </div>
      ) : null}

      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        className="block"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Орлогын график"
      >
        <defs>
          <linearGradient id="incUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#34d399" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="incDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#f87171" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
          </linearGradient>
          <clipPath id="incClip">
            <rect
              x={0}
              y={-PAD.top}
              width={animated ? innerW + 2 : 0}
              height={H}
              style={{
                transition: animated
                  ? "width 1.1s cubic-bezier(0.4,0,0.2,1)"
                  : "none",
              }}
            />
          </clipPath>
          <filter id="incGlow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${PAD.left}, ${PAD.top})`}>
          {/* Y grid + labels */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={0}
                y1={toY(t)}
                x2={innerW}
                y2={toY(t)}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={-8}
                y={toY(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="rgba(255,255,255,0.35)"
                fontSize={10}
              >
                {compact(t)}
              </text>
            </g>
          ))}

          {/* line + area (draw-in) */}
          <g clipPath="url(#incClip)">
            {area ? <path d={area} fill={`url(#${fillId})`} /> : null}
            {line ? (
              <path
                d={line}
                fill="none"
                stroke={stroke}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#incGlow)"
              />
            ) : null}
          </g>

          {/* hover crosshair + marker */}
          {hover != null ? (
            <>
              <line
                x1={coords[hover].x}
                y1={0}
                x2={coords[hover].x}
                y2={innerH}
                stroke="rgba(255,255,255,0.18)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={coords[hover].x}
                cy={coords[hover].y}
                r={4.5}
                fill={stroke}
                stroke="#14141f"
                strokeWidth={2}
                filter="url(#incGlow)"
              />
            </>
          ) : null}

          {/* X labels */}
          {points.map((p, i) =>
            i % labelStep === 0 || i === points.length - 1 ? (
              <text
                key={i}
                x={coords[i].x}
                y={innerH + 16}
                fill="rgba(255,255,255,0.35)"
                fontSize={10}
                textAnchor={
                  i === 0
                    ? "start"
                    : i === points.length - 1
                      ? "end"
                      : "middle"
                }
              >
                {p.label}
              </text>
            ) : null,
          )}
        </g>
      </svg>
    </div>
  );
}
