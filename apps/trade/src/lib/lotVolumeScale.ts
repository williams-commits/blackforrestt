export const LOT_VOLUME_MIN = 0.01;
export const LOT_VOLUME_MAX = 100;
export const LOT_VOLUME_SLIDER_MAX = 198;

export const LOT_VOLUME_SLIDER_MARKERS = [
  { volume: 0.01, position: 0, label: "0.01" },
  { volume: 0.1, position: 9, label: "0.1" },
  { volume: 9, position: 98, label: "9" },
  { volume: 10, position: 108, label: "10" },
  { volume: 100, position: LOT_VOLUME_SLIDER_MAX, label: "100" },
] as const;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) throw new RangeError("Slider values must be finite numbers.");
  return Math.min(max, Math.max(min, value));
}

export function lotVolumeToSliderPosition(volume: number): number {
  const boundedVolume = clamp(volume, LOT_VOLUME_MIN, LOT_VOLUME_MAX);
  if (boundedVolume <= 0.1) return Math.round((boundedVolume - 0.01) * 100);
  if (boundedVolume <= 9) return 9 + Math.round((boundedVolume - 0.1) * 10);
  if (boundedVolume <= 10) return 98 + Math.round((boundedVolume - 9) * 10);
  return Math.min(LOT_VOLUME_SLIDER_MAX, 108 + Math.round(boundedVolume - 10));
}

export function lotVolumeFromSliderPosition(position: number): number {
  const boundedPosition = Math.round(clamp(position, 0, LOT_VOLUME_SLIDER_MAX));
  if (boundedPosition <= 9) return Number((0.01 + boundedPosition * 0.01).toFixed(2));
  if (boundedPosition <= 98) return Number((0.1 + (boundedPosition - 9) * 0.1).toFixed(1));
  if (boundedPosition <= 108) return Number((9 + (boundedPosition - 98) * 0.1).toFixed(1));
  return 10 + boundedPosition - 108;
}

export function nextLotVolume(volume: number, direction: -1 | 1): number {
  const boundedVolume = clamp(volume, LOT_VOLUME_MIN, LOT_VOLUME_MAX);
  if (direction > 0) {
    if (boundedVolume < 0.1) {
      return Math.min(0.1, Number((Math.round(boundedVolume * 100) / 100 + 0.01).toFixed(2)));
    }
    if (boundedVolume < 10) {
      return Math.min(10, Number((Math.round(boundedVolume * 10) / 10 + 0.1).toFixed(1)));
    }
    return Math.min(LOT_VOLUME_MAX, Math.floor(boundedVolume) + 1);
  }

  if (boundedVolume <= 0.1) {
    return Math.max(LOT_VOLUME_MIN, Number((Math.round(boundedVolume * 100) / 100 - 0.01).toFixed(2)));
  }
  if (boundedVolume <= 10) {
    return Math.max(0.1, Number((Math.round(boundedVolume * 10) / 10 - 0.1).toFixed(1)));
  }
  return Math.max(10, Math.ceil(boundedVolume) - 1);
}
