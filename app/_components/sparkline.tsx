/**
 * Tiny presentational sparkline (server-rendered SVG). Smooth area + line,
 * colored emerald/red by trend direction. No axes, no interactivity.
 */

const W = 120;
const H = 36;

function buildPaths(pts: { x: number; y: number }[]) {
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
  const area = `${line} L ${last.x} ${H} L ${pts[0].x} ${H} Z`;
  return { line, area };
}

export function Sparkline({
  data,
  up,
  className,
}: {
  data: number[];
  up: boolean;
  className?: string;
}) {
  const color = up ? "#34d399" : "#f87171"; // emerald-400 / red-400
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const step = data.length > 1 ? W / (data.length - 1) : 0;

  const pts = data.map((v, i) => ({
    x: data.length > 1 ? i * step : W / 2,
    y: H - 3 - ((v - min) / span) * (H - 6),
  }));
  const { line, area } = buildPaths(pts);
  const last = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`w-full ${className ?? "h-9"}`}
      aria-hidden="true"
    >
      {area ? <path d={area} fill={color} fillOpacity={0.12} /> : null}
      {line ? (
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {last ? (
        <circle cx={last.x} cy={last.y} r={2} fill={color} vectorEffect="non-scaling-stroke" />
      ) : null}
    </svg>
  );
}
