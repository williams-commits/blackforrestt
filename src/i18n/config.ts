/**
 * Locale configuration for the platform.
 *
 * Locale strategy: COOKIE-BASED (no URL change). The active locale is stored in
 * the `NEXT_LOCALE` cookie (shared across the apex + trade.* subdomains) and
 * resolved server-side by src/i18n/request.ts. This avoids any route
 * restructure or middleware rewrite — the two-domain split and all <Link>/
 * router.push/redirect calls stay intact.
 *
 * Arabic (ar) requires RTL — the layout auto-switches to `dir="rtl"` when ar
 * is active (handled in layout.tsx via the LOCALE_RTL map).
 */

export const locales = ["en", "fr", "de", "es", "ja", "zh", "ru", "ar", "ko"] as const;
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
  ja: "ja",
  zh: "zh-CN",
  ru: "ru",
  ar: "ar",
  ko: "ko",
};

/** OpenGraph locale codes. */
export const LOCALE_OG: Record<Locale, string> = {
  en: "en_US",
  fr: "fr_FR",
  de: "de_DE",
  es: "es_ES",
  ja: "ja_JP",
  zh: "zh_CN",
  ru: "ru_RU",
  ar: "ar_SA",
  ko: "ko_KR",
};

/** RTL locales — the layout switches to dir="rtl" for these. */
export const RTL_LOCALES: ReadonlySet<string> = new Set(["ar"]);

/** UI display metadata for the language switcher. */
export const LOCALE_DISPLAY: Record<Locale, { label: string; native: string; flag: string }> = {
  en: { label: "English", native: "English", flag: "🇬🇧" },
  fr: { label: "French", native: "Français", flag: "🇫🇷" },
  de: { label: "German", native: "Deutsch", flag: "🇩🇪" },
  es: { label: "Spanish", native: "Español", flag: "🇪🇸" },
  ja: { label: "Japanese", native: "日本語", flag: "🇯🇵" },
  zh: { label: "Chinese", native: "中文", flag: "🇨🇳" },
  ru: { label: "Russian", native: "Русский", flag: "🇷🇺" },
  ar: { label: "Arabic", native: "العربية", flag: "🇶🇦" },
  ko: { label: "Korean", native: "한국어", flag: "🇰🇷" },
};

/** Coerce an arbitrary string (cookie/Accept-Language token) to a supported Locale. */
export function normalizeLocale(value: string | null | undefined): Locale {
  if (!value) return defaultLocale;
  const lower = value.toLowerCase();
  // Exact match
  if ((locales as readonly string[]).includes(lower)) return lower as Locale;
  // Prefix match (e.g. "en-US" → "en", "de-AT" → "de", "zh-TW" → "zh")
  const prefix = lower.split(/[-_]/)[0];
  if ((locales as readonly string[]).includes(prefix)) return prefix as Locale;
  // Chinese variants: zh-CN, zh-TW, zh-HK all → zh
  if (prefix === "zh") return "zh";
  return defaultLocale;
}
