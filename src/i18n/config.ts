/**
 * Locale configuration for the platform.
 *
 * Locale strategy: COOKIE-BASED (no URL change). The active locale is stored in
 * the `NEXT_LOCALE` cookie (shared across the apex + trade.* subdomains) and
 * resolved server-side by src/i18n/request.ts. This avoids any route
 * restructure or middleware rewrite — the two-domain split and all <Link>/
 * router.push/redirect calls stay intact.
 *
 * Arabic (ar) + RTL mirroring is intentionally NOT in this phase; it is tracked
 * as a follow-up because it requires converting ~192 physical-directional
 * utilities to logical ones, swapping the chart price axis, and adding an
 * Arabic font via next/font.
 */

export const locales = ["en", "fr", "de", "es"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Cookie name (matches next-intl's conventional key). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** BCP-47 tags for metadata (`<html lang>`, `og:locale`). */
export const LOCALE_BCP47: Record<Locale, string> = {
  en: "en",
  fr: "fr",
  de: "de",
  es: "es",
};

/** OpenGraph locale codes (en_US, fr_FR, de_DE, es_ES). */
export const LOCALE_OG: Record<Locale, string> = {
  en: "en_US",
  fr: "fr_FR",
  de: "de_DE",
  es: "es_ES",
};

/** UI display metadata for the language switcher. */
export const LOCALE_DISPLAY: Record<Locale, { label: string; native: string; flag: string }> = {
  en: { label: "English", native: "English", flag: "🇬🇧" },
  fr: { label: "French", native: "Français", flag: "🇫🇷" },
  de: { label: "German", native: "Deutsch", flag: "🇩🇪" },
  es: { label: "Spanish", native: "Español", flag: "🇪🇸" },
};

/** Coerce an arbitrary string (cookie/Accept-Language token) to a supported Locale. */
export function normalizeLocale(value: string | null | undefined): Locale {
  if (!value) return defaultLocale;
  const lower = value.toLowerCase();
  // Exact match
  if ((locales as readonly string[]).includes(lower)) return lower as Locale;
  // Prefix match (e.g. "en-US" → "en", "de-AT" → "de")
  const prefix = lower.split(/[-_]/)[0];
  if ((locales as readonly string[]).includes(prefix)) return prefix as Locale;
  return defaultLocale;
}
