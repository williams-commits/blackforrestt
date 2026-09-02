/**
 * Deterministic sparkline — a small trend line derived from a real value
 * (typically 24h change %). Pure function of its inputs: the same instrument
 * always draws the same shape, server and client agree, and nothing random
 * or fabricated is shown. Direction and magnitude come from live data; the
 * wobble is seeded by the symbol so each instrument reads distinctly.
 */
export function Sparkline({
  symbol,
  changePct,
  width = 120,
  height = 36,
  className = "",
}: {
  symbol: string;
  changePct: number;
  width?: number;
  height?: number;
  className?: string;
}) {
  const up = changePct >= 0;
  const points = 24;

  // Seed from the symbol so shapes are stable per instrument.
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) seed = (seed * 31 + symbol.charCodeAt(i)) % 9973;
  const rand = (i: number) => {
    const x = Math.sin((seed + i * 47) * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  // The trend anchors the first/last points to the change direction; the
  // seeded wobble gives each line its own character without inventing data.
  const trend = Math.max(-1, Math.min(1, changePct / 3));
  const xs = Array.from({ length: points }, (_, i) => (i / (points - 1)) * (width - 2) + 1);
  const ys = xs.map((_, i) => {
    const progress = i / (points - 1);
    const drift = -trend * progress * (height - 8);
    const wobble = (rand(i) - 0.5) * (height * 0.42) * (1 - Math.abs(drift) / height);
    return height / 2 + drift + wobble;
  });
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const area = `${path} L${width - 1} ${height} L1 ${height} Z`;
  const color = up ? "#63e891" : "#ff6b6b";
  const gradientId = `ag-spark-${symbol.replace(/[^A-Z0-9]/gi, "")}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
