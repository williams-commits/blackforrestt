import type { Quote } from "./types";
import type { MarketHoursView } from "./marketHours";

export const MAX_EXECUTABLE_QUOTE_AGE_MS = 60_000;

export type StaleQuoteDecision =
  | { allowed: true; useStalePrice: boolean }
  | { allowed: false; reason: "MARKET_CLOSED" | "NO_VALID_QUOTE" | "ACK_REQUIRED" };

export function quoteAgeMs(quote: Quote | null, now = Date.now()): number | null {
  return quote ? Math.max(0, now - quote.time) : null;
}

export function formatQuoteAge(ageMs: number | null): string {
  if (ageMs == null || !Number.isFinite(ageMs)) return "unknown";
  const totalSeconds = Math.floor(Math.max(0, ageMs) / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function staleQuoteDecision(
  marketHours: Pick<MarketHoursView, "isOpen" | "canTrade">,
  quoteTimestamp: number,
  acknowledged: boolean,
  now = Date.now(),
): StaleQuoteDecision {
  if (!marketHours.isOpen) return { allowed: false, reason: "MARKET_CLOSED" };
  if (marketHours.canTrade) return { allowed: true, useStalePrice: false };
  if (!Number.isFinite(quoteTimestamp) || quoteTimestamp <= 0 || quoteTimestamp > now + 5_000) {
    return { allowed: false, reason: "NO_VALID_QUOTE" };
  }
  if (!acknowledged) return { allowed: false, reason: "ACK_REQUIRED" };
  return { allowed: true, useStalePrice: true };
}

export function isExecutableQuote(
  quote: Quote | null,
  symbol: string,
  now = Date.now(),
  maxAgeMs = MAX_EXECUTABLE_QUOTE_AGE_MS,
): boolean {
  return Boolean(quote && quote.symbol === symbol && quoteAgeMs(quote, now)! <= maxAgeMs);
}
