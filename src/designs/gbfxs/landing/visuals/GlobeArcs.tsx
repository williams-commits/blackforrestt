/**
 * GlobeArcs — Agile's "global markets" illustration: a wire globe (meridians
 * and parallels) with glowing nodes at trading centres and accent arcs
 * connecting them. Pure inline SVG, no assets, decorative (aria-hidden) —
 * the abstract grammar of a global execution network.
 *
 * Animated: arcs carry a flowing dash and nodes pulse (see the .ag-globe-*
 * keyframes in GbfxsStyles — disabled entirely under reduced motion).
 *
 * `ink` swaps the palette to near-black strokes/nodes for yellow surfaces,
 * where the default white wireframe and yellow nodes would wash out.
 */
export function GlobeArcs({ className = "", ink = false }: { className?: string; ink?: boolean }) {
  const wireStrong = ink ? "rgba(13,13,15,0.26)" : "rgba(255,255,255,0.2)";
  const wireSoft = ink ? "rgba(13,13,15,0.12)" : "rgba(255,255,255,0.09)";
  const wireMid = ink ? "rgba(13,13,15,0.18)" : "rgba(255,255,255,0.14)";
  const node = ink ? "#0d0d0f" : "#f0b90b";
  const nodeHalo = ink ? "rgba(13,13,15,0.16)" : "rgba(240,185,11,0.14)";
  const arcColor = ink ? "13,13,15" : "240,185,11";
  const glowColor = ink ? "13,13,15" : "240,185,11";
  const ids = ink ? { glow: "ag-globe-glow-ink", arc: "ag-arc-ink" } : { glow: "ag-globe-glow", arc: "ag-arc" };
  // Nodes at CONTINENT positions on the sphere face (viewBox 260×200,
  // centre 130,100 r74) — each pulsing point marks a real landmass:
  // North America, South America, Europe, Africa, Middle East,
  // South Asia, East Asia, Australia.
  const nodes: Array<[number, number, number]> = [
    [86, 56, 2.6],   // North America
    [104, 122, 2.2], // South America
    [117, 44, 2.4],  // Europe
    [129, 86, 2.0],  // Africa
    [150, 72, 2.2],  // Middle East
    [161, 79, 2.0],  // South Asia
    [184, 54, 2.6],  // East Asia
    [176, 134, 2.2], // Australia
  ];
  const arcs: Array<[number, number, number, number]> = [
    // Trade routes between the continents above.
    [86, 56, 117, 44],    // NA ↔ Europe
    [117, 44, 129, 86],   // Europe ↔ Africa
    [117, 44, 150, 72],   // Europe ↔ Middle East
    [150, 72, 184, 54],   // ME ↔ East Asia
    [161, 79, 176, 134],  // South Asia ↔ Australia
    [86, 56, 104, 122],   // NA ↔ South America
    [129, 86, 161, 79],   // Africa ↔ South Asia
    [184, 54, 176, 134],  // East Asia ↔ Australia
  ];
  // Abstract landmass silhouettes under the nodes — soft rounded masses at
  // whisper opacity so the continental placement reads at a glance.
  const landmassFill = ink ? "rgba(13,13,15,0.10)" : "rgba(255,255,255,0.07)";
  const midX = (x1: number, x2: number) => (x1 + x2) / 2;
  const midY = (y1: number, y2: number) => (y1 + y2) / 2 - 26;

  return (
    <svg viewBox="0 0 260 200" className={`ag-globe ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={ids.glow} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor={`rgba(${glowColor},0.16)`} />
          <stop offset="100%" stopColor={`rgba(${glowColor},0)`} />
        </radialGradient>
        <linearGradient id={ids.arc} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={`rgba(${arcColor},0)`} />
          <stop offset="50%" stopColor={`rgba(${arcColor},0.78)`} />
          <stop offset="100%" stopColor={`rgba(${arcColor},0)`} />
        </linearGradient>
      </defs>

      <circle cx="130" cy="100" r="86" fill={`url(#${ids.glow})`} />
      {/* Sphere */}
      <circle cx="130" cy="100" r="74" fill="none" stroke={wireMid} strokeWidth="1" />
      {/* Parallels */}
      {[52, 74, 100, 126, 148].map((y, i) => {
        const ry = 74;
        const t = (y - 100) / 100;
        const rx = Math.sqrt(Math.max(0, 74 * 74 - (y - 100) * (y - 100)));
        return (
          <ellipse
            key={i}
            cx="130"
            cy={y}
            rx={rx}
            ry={ry * 0.16 + 3}
            fill="none"
            stroke={i === 2 ? wireStrong : wireSoft}
            strokeWidth="1"
            opacity={1 - Math.abs(t) * 0.5}
          />
        );
      })}
      {/* Meridians */}
      {[74, 52, 26].map((rx, i) => (
        <ellipse
          key={i}
          cx="130"
          cy="100"
          rx={rx}
          ry="74"
          fill="none"
          stroke={i === 0 ? wireStrong : wireSoft}
          strokeWidth="1"
        />
      ))}
      <line x1="130" y1="26" x2="130" y2="174" stroke={wireMid} strokeWidth="1" />

      {/* Continent silhouettes — abstract, decorative. */}
      <g fill={landmassFill}>
        <ellipse cx="88" cy="58" rx="21" ry="16" transform="rotate(-18 88 58)" />
        <ellipse cx="106" cy="120" rx="10" ry="17" transform="rotate(12 106 120)" />
        <ellipse cx="119" cy="46" rx="11" ry="8" />
        <ellipse cx="131" cy="88" rx="13" ry="17" />
        <ellipse cx="156" cy="73" rx="12" ry="8" transform="rotate(-24 156 73)" />
        <ellipse cx="172" cy="72" rx="17" ry="12" transform="rotate(14 172 72)" />
        <ellipse cx="177" cy="134" rx="12" ry="8" transform="rotate(18 177 134)" />
      </g>

      {/* Arcs — data flow along the network. */}
      {arcs.map(([x1, y1, x2, y2], i) => (
        <path
          key={i}
          className="ag-globe-arc"
          style={{ animationDelay: `${(i % 4) * 0.8}s` }}
          d={`M${x1} ${y1} Q ${midX(x1, x2)} ${midY(y1, y2)} ${x2} ${y2}`}
          fill="none"
          stroke={`url(#${ids.arc})`}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      ))}

      {/* Nodes — pulsing trading centres. */}
      {nodes.map(([x, y, r], i) => (
        <g key={i} className="ag-globe-node" style={{ animationDelay: `${i * 0.3}s` }}>
          <circle cx={x} cy={y} r={r * 2.4} fill={nodeHalo} />
          <circle cx={x} cy={y} r={r} fill={node} />
        </g>
      ))}
    </svg>
  );
}
