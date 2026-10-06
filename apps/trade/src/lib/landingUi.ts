import type { InstrumentCategory, InstrumentView } from "@/lib/types";

/**
 * Client-safe constants + formatters for the landing page UI.
 *
 * This module is pure (no server imports) so it can be imported safely from
 * client components (TradingPlayground, LivePrice, SectionTicker, …) without
 * dragging the server-only engine hub — and its `node:crypto` dependency —
 * into the browser bundle.
 *
 * The server-only data accessors live in landingData.ts, which re-exports these
 * helpers for server-component convenience.
 */

export type { InstrumentView, InstrumentCategory };

/** Display order + labels for the asset classes featured on the landing page. */
export const CATEGORY_ORDER: InstrumentCategory[] = [
  "FOREX",
  "CRYPTO",
  "COMMODITY",
  "INDEX",
];

export const CATEGORY_LABEL: Record<InstrumentCategory, string> = {
  FOREX: "Forex",
  COMMODITY: "Commodities",
  INDEX: "Indices",
  CRYPTO: "Crypto",
  STOCK: "Stocks",
};

/** One-line tagline per asset class, shown in the section header. */
export const CATEGORY_TAGLINE: Record<InstrumentCategory, string> = {
  FOREX: "60+ currency pairs · tight spreads · instant execution",
  COMMODITY: "Gold, silver, oil & natural gas on competitive terms",
  INDEX: "The world's leading stock indices, around the clock",
  CRYPTO: "Bitcoin, Ethereum & major digital assets · 24/7",
  STOCK: "Blue-chip equities alongside the indices that track them",
};

/** Format a price with the instrument's digit precision. */
export function formatPrice(value: number, digits: number): string {
  return value.toFixed(digits);
}

/** Format a percentage change with a sign, e.g. "+0.12%". */
export function formatChange(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}
