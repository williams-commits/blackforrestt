import type { Metadata } from "next";

/**
 * Per-page SEO helpers.
 *
 * The root layout's generateMetadata sets `alternates.canonical: "/"`, which
 * every page without its own canonical would inherit — telling search engines
 * that all pages are duplicates of the homepage. Every content page MUST
 * override the canonical via contentMetadata() below.
 *
 * Descriptions are English-only by design: the site resolves language from a
 * cookie on a single URL, so crawlers only ever see the default-language page.
 * If the site moves to URL-based locales, move these into the message files.
 */

/** Default-language descriptions for public marketing pages. */
const PAGE_DESCRIPTIONS: Record<string, string> = {
  "/about": "Learn about Black Forest Digital — our mission, values, and the team behind a fast, transparent multi-asset trading platform.",
  "/contact": "Contact the Black Forest Digital support team. Get help with your account, deposits, withdrawals, and trading questions.",
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
  "/legal/terms": "Terms and conditions governing the use of the Black Forest Digital trading platform and services.",
  "/legal/privacy": "Privacy policy: how Black Forest Digital collects, uses, and protects your personal data.",
  "/legal/kyc": "Know Your Customer (KYC) policy: identity verification requirements for opening and operating a trading account.",
  "/legal/aml": "Anti-Money Laundering (AML) policy and compliance framework for trading account operations.",
};

/**
 * Metadata for content pages: translated title, page-specific canonical, and
 * an English description (see the note above).
 */
export function contentMetadata(path: string, title: string): Metadata {
  return {
    title,
    ...(PAGE_DESCRIPTIONS[path] ? { description: PAGE_DESCRIPTIONS[path] } : {}),
    alternates: { canonical: path },
  };
}
