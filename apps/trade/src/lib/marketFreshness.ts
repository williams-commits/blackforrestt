import type { Quote } from "./types";

export const MAX_EXECUTABLE_QUOTE_AGE_MS = 15_000;

export function quoteAgeMs(quote: Quote | null, now = Date.now()): number | null {
  return quote ? Math.max(0, now - quote.time) : null;
}

export function isExecutableQuote(
  quote: Quote | null,
  symbol: string,
  now = Date.now(),
  maxAgeMs = MAX_EXECUTABLE_QUOTE_AGE_MS,
): boolean {
  return Boolean(quote && quote.symbol === symbol && quoteAgeMs(quote, now)! <= maxAgeMs);
}
