/**
 * Data normalization applied on EVERY write path (interactive and import
 * alike) so duplicate matching keys are stable. Never silently discard
 * data: values are trimmed/case-folded, not dropped.
 */

export function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/**
 * Phone normalization to a conservative E.164-shaped string. Accepts
 * common separators and a leading double-zero (replaced with +). Anything
 * that isn't clearly a phone number is returned trimmed rather than
 * mangled — dedup matching just needs consistency.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withPlus = trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed;
  const digitsAndPlus = withPlus.replace(/[\s()\-.]/g, "");
  return /^\+?\d{6,20}$/.test(digitsAndPlus) ? digitsAndPlus : trimmed;
}

export function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
