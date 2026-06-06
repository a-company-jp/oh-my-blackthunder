"use client";

// ---------------------------------------------------------------------------
// A compact SVG sparkline (line + filled area), in the spirit of RunThunder's
// SparklineView. Values are arbitrary magnitudes; we normalize to 0..1 against
// the series max. Renders nothing for <2 points.
// ---------------------------------------------------------------------------

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Stroke + fill color (defaults to thunder yellow). */
  color?: string;
}

export function Sparkline({
  values,
  width = 320,
  height = 56,
  className,
  color = "#FFD300",
}: SparklineProps) {
  if (values.length < 2) {
    return (
      <div
        className="grid h-14 place-items-center text-xs text-white/35"
        role="img"
        aria-label="データが不足しています"
      >
        データがまだありません
      </div>
    );
  }

  const max = Math.max(...values, 0.0001);
  const pad = 2;
  const w = width;
  const h = height;
  const stepX = (w - pad * 2) / (values.length - 1);

  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const norm = Math.min(1, Math.max(0, v / max));
    const y = h - pad - norm * (h - pad * 2);
    return { x, y };
  });

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${h - pad} L${points[0].x.toFixed(1)},${h - pad} Z`;

  const gradId = "bt-spark-grad";

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label="直近のAIザクザク度の推移"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Highlight the latest point. */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={3}
        fill={color}
      />
    </svg>
  );
}
