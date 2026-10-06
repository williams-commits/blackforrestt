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

/** Common country names → ISO 3166-1 alpha-2. ISO codes pass through. */
const COUNTRY_CODES: Record<string, string> = {
  "united states": "US", "usa": "US", "united kingdom": "GB", "uk": "GB", "england": "GB",
  "united arab emirates": "AE", "uae": "AE", "south korea": "KR", "korea": "KR",
  "czech republic": "CZ", "czechia": "CZ", "netherlands": "NL", "holland": "NL",
  "russia": "RU", "turkey": "TR", "vietnam": "VN", "iran": "IR", "syria": "SY",
  "moldova": "MD", "bolivia": "BO", "venezuela": "VE", "tanzania": "TZ",
  "democratic republic of the congo": "CD", "congo": "CG", "ivory coast": "CI",
  "cape verde": "CV", "hong kong": "HK", "macau": "MO", "laos": "LA", "brunei": "BN",
};

/**
 * Normalize country input to an ISO alpha-2 code where recognizable.
 * Two-letter codes uppercase; unknown values pass through trimmed — never
 * discarded (a free-text country beats a wrong code).
 */
export function normalizeCountry(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  const mapped = COUNTRY_CODES[trimmed.toLowerCase()];
  if (mapped) return mapped;
  // Try the final segment for forms like "Congo, Democratic Republic of".
  const lastWord = trimmed.split(/[\s,]+/).pop() ?? "";
  return COUNTRY_CODES[lastWord.toLowerCase()] ?? trimmed;
}
