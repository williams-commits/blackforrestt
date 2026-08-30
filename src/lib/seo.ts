import type { Metadata } from "next";
import { defaultLocale, locales } from "@/i18n/config";

/**
 * Per-page SEO helpers.
 *
 * The root layout's generateMetadata sets `alternates.canonical: "/"`, which
 * every page without its own canonical would inherit — telling search engines
 * that all pages are duplicates of the homepage. Every content page MUST
 * override the canonical via contentMetadata() below.
 *
 * Descriptions are English-only: they match the default-language page that
 * crawlers see at the unprefixed URL (the canonical). Translated variants are
 * served at /<locale> URLs via the middleware locale routing.
 */

/** Locale-prefixed variant of a path: "/about" → "/fr/about" (default: bare). */
export function localePath(path: string, locale: string): string {
  if (locale === defaultLocale) return path;
  return `/${locale}${path === "/" ? "" : path}`;
}

/** hreflang alternates for a page across all supported locales. */
import { currentBrandProfile } from "./branding";

export function languageAlternates(path: string): Record<string, string> {
  return Object.fromEntries(locales.map((locale) => [locale, localePath(path, locale)]));
}

/** Default-language descriptions for public marketing pages. */
const PAGE_DESCRIPTIONS: Record<string, string> = {
  "/about": "Learn about {brand} — our mission, values, and the team behind a fast, transparent multi-asset trading platform.",
  "/contact": "Contact the {brand} support team. Get help with your account, deposits, withdrawals, and trading questions.",
  "/analytics/news": "Latest financial market news and macroeconomic headlines moving forex, commodities, indices, and crypto markets.",
  "/analytics/technical": "Technical analysis across forex, commodities, indices, and crypto — levels, trends, and momentum for every major market.",
  "/analytics/fundamental": "Fundamental analysis: interest rates, inflation, employment data, and the economic drivers behind market moves.",
  "/analytics/trend": "Market trend analysis and sentiment across forex, commodities, indices, and cryptocurrency instruments.",
  "/tools/informers": "Live market informers — real-time quotes, currency converters, and trading widgets for every major instrument.",
  "/tools/calendars": "Economic calendar with upcoming events, forecasts, and previous releases that move global financial markets.",
  "/tools/calculators": "Trading calculators: position size, pip value, margin, swap, and profit calculators for forex and CFD traders.",
  "/tools/signals": "Trading signals with entry, take-profit, and stop levels across forex, commodities, indices, and crypto.",
  "/education/beginners": "Beginner trading courses: how forex and CFD markets work, placing your first trade, and managing risk.",
  "/education/advanced": "Advanced trading education: strategy design, price action, risk management, and trading psychology.",
  "/education/beginners-vods": "Beginner trading video courses — watch step-by-step lessons on trading forex, CFDs, and crypto.",
  "/education/advanced-vods": "Advanced trading video courses on strategy, risk management, and market analysis.",
  "/education/crypto-vods": "Cryptocurrency trading video courses — blockchain basics, crypto markets, and digital asset strategy.",
  "/legal/terms": "Terms and conditions governing the use of the {brand} trading platform and services.",
  "/legal/privacy": "Privacy policy: how {brand} collects, uses, and protects your personal data.",
  "/legal/kyc": "Know Your Customer (KYC) policy: identity verification requirements for opening and operating a {brand} trading account.",
  "/legal/aml": "Anti-Money Laundering (AML) policy and compliance framework for {brand} trading accounts.",
};

/**
 * Metadata for content pages: translated title, page-specific canonical,
 * hreflang alternates for every supported locale, and an English description
 * (see the note above).
 */
export async function contentMetadata(path: string, title: string): Promise<Metadata> {
  // {brand} placeholders resolve against the REQUESTING brand family, so
  // agilefgs.com never ships meta copy that names Black Forest.
  const brand = await currentBrandProfile();
  const rawDescription = PAGE_DESCRIPTIONS[path];
  return {
    title,
    ...(rawDescription ? { description: rawDescription.replaceAll("{brand}", brand.name) } : {}),
    alternates: { canonical: path, languages: languageAlternates(path) },
  };
}
