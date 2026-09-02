/**
 * GlobeArcs — Agile's "global markets" illustration: a wire globe (meridians
 * and parallels) with glowing nodes at trading centres and accent arcs
 * connecting them. Pure inline SVG, no assets, decorative (aria-hidden) —
 * the abstract grammar of a global execution network.
 *
 * Animated: arcs carry a flowing dash and nodes pulse (see the .ag-globe-*
 * keyframes in AgileStyles — disabled entirely under reduced motion).
 */
export function GlobeArcs({ className = "" }: { className?: string }) {
  const nodes: Array<[number, number, number]> = [
    // [x, y, r] — financial centres scattered across the sphere face.
    [73, 62, 2.6], [152, 48, 2.2], [205, 86, 2.8], [128, 118, 2.2], [52, 132, 2.4],
    [180, 152, 2.0], [96, 44, 2.0], [222, 132, 2.2],
  ];
  const arcs: Array<[number, number, number, number]> = [
    // Great-circle-ish quadratic curves between node pairs.
    [73, 62, 152, 48], [152, 48, 205, 86], [205, 86, 128, 118], [128, 118, 52, 132],
    [52, 132, 73, 62], [180, 152, 205, 86], [96, 44, 128, 118], [222, 132, 180, 152],
  ];
  const midX = (x1: number, x2: number) => (x1 + x2) / 2;
  const midY = (y1: number, y2: number) => (y1 + y2) / 2 - 26;

  return (
    <svg viewBox="0 0 260 200" className={`ag-globe ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="ag-globe-glow" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="rgba(99,232,145,0.14)" />
          <stop offset="100%" stopColor="rgba(99,232,145,0)" />
        </radialGradient>
        <linearGradient id="ag-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(99,232,145,0)" />
          <stop offset="50%" stopColor="rgba(99,232,145,0.75)" />
          <stop offset="100%" stopColor="rgba(99,232,145,0)" />
        </linearGradient>
      </defs>

      <circle cx="130" cy="100" r="86" fill="url(#ag-globe-glow)" />
      {/* Sphere */}
      <circle cx="130" cy="100" r="74" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
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
            stroke={i === 2 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.09)"}
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
          stroke={i === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.09)"}
          strokeWidth="1"
        />
      ))}
      <line x1="130" y1="26" x2="130" y2="174" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />

      {/* Arcs — data flow along the network. */}
      {arcs.map(([x1, y1, x2, y2], i) => (
        <path
          key={i}
          className="ag-globe-arc"
          style={{ animationDelay: `${(i % 4) * 0.8}s` }}
          d={`M${x1} ${y1} Q ${midX(x1, x2)} ${midY(y1, y2)} ${x2} ${y2}`}
          fill="none"
          stroke="url(#ag-arc)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      ))}

      {/* Nodes — pulsing trading centres. */}
      {nodes.map(([x, y, r], i) => (
        <g key={i} className="ag-globe-node" style={{ animationDelay: `${i * 0.3}s` }}>
          <circle cx={x} cy={y} r={r * 2.4} fill="rgba(99,232,145,0.12)" />
          <circle cx={x} cy={y} r={r} fill="#63e891" />
        </g>
      ))}
    </svg>
  );
}
