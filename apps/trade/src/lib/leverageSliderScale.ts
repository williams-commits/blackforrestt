export function snapSliderValueToAnchors(
  value: number,
  anchors: readonly number[],
  threshold: number,
): number {
  let closestAnchor: number | null = null;
  let closestDistance = Infinity;

  for (const anchor of anchors) {
    const distance = Math.abs(value - anchor);
    if (distance <= threshold && distance < closestDistance) {
      closestAnchor = anchor;
      closestDistance = distance;
    }
  }

  return closestAnchor ?? value;
}
