/**
 * Catmull-Rom → cubic Bézier smoothing for the landing's decorative chart
 * motifs. Turns the hand-plotted polylines into continuous, edge-free lines
 * (tension 1 = standard Catmull-Rom; lower = tighter). Module-level use is
 * fine — results are computed once per import.
 */
export function smoothPath(points: Array<[number, number]>, tension = 1): string {
  if (points.length < 2) return "";
  const path: string[] = [`M ${points[0][0]} ${points[0][1]}`];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    path.push(`C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${p2[0]} ${p2[1]}`);
  }
  return path.join(" ");
}

/** Smooth line closed down to a baseline — the chart's area fill. */
export function areaPath(points: Array<[number, number]>, baseline: number, tension = 1): string {
  if (points.length < 2) return "";
  const last = points[points.length - 1]!;
  const first = points[0]!;
  return `${smoothPath(points, tension)} L ${last[0]} ${baseline} L ${first[0]} ${baseline} Z`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
