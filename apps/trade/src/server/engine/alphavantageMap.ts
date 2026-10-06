/**
 * Alpha Vantage symbol map — translates our instrument symbols (e.g. "EURUSD")
 * into Alpha Vantage's conventions for its REST API endpoints.
 *
 * Alpha Vantage conventions:
 *   Forex / Commodities → "EUR/USD" slash pair (CURRENCY_EXCHANGE_RATE / FX_INTRADAY)
 *   Crypto              → { "BTC", "USD" } from/to pair (CURRENCY_EXCHANGE_RATE)
 *   Stocks / Indices    → plain ticker "AAPL", "DIA" (GLOBAL_QUOTE / TIME_SERIES_INTRADAY)
 *
 * There is no WebSocket — the feed client polls these REST endpoints.
 */
import type { InstrumentCategory } from "./types";

export type AvEndpoint = "forex" | "crypto" | "stock";

export interface AvSymbolEntry {
  symbol: string;
  /** For forex/crypto: the slash pair or from/to. For stocks: the ticker. */
  feedSymbol: string;
  /** For crypto: the quote currency (e.g. "USD"). Empty for others. */
  feedQuote?: string;
  endpoint: AvEndpoint;
  category: InstrumentCategory;
}

export const AV_SYMBOL_MAP: Record<string, AvSymbolEntry> = {
  // ── Forex (majors + crosses) — slash pair ────────────────────────────────
  AUDCAD: { symbol: "AUDCAD", feedSymbol: "AUD/CAD", endpoint: "forex", category: "FOREX" },
  EURUSD: { symbol: "EURUSD", feedSymbol: "EUR/USD", endpoint: "forex", category: "FOREX" },
  GBPUSD: { symbol: "GBPUSD", feedSymbol: "GBP/USD", endpoint: "forex", category: "FOREX" },
  USDJPY: { symbol: "USDJPY", feedSymbol: "USD/JPY", endpoint: "forex", category: "FOREX" },
  AUDUSD: { symbol: "AUDUSD", feedSymbol: "AUD/USD", endpoint: "forex", category: "FOREX" },
  USDCAD: { symbol: "USDCAD", feedSymbol: "USD/CAD", endpoint: "forex", category: "FOREX" },
  NZDUSD: { symbol: "NZDUSD", feedSymbol: "NZD/USD", endpoint: "forex", category: "FOREX" },
  EURGBP: { symbol: "EURGBP", feedSymbol: "EUR/GBP", endpoint: "forex", category: "FOREX" },
  USDCHF: { symbol: "USDCHF", feedSymbol: "USD/CHF", endpoint: "forex", category: "FOREX" },
  EURJPY: { symbol: "EURJPY", feedSymbol: "EUR/JPY", endpoint: "forex", category: "FOREX" },
  GBPJPY: { symbol: "GBPJPY", feedSymbol: "GBP/JPY", endpoint: "forex", category: "FOREX" },
  EURCHF: { symbol: "EURCHF", feedSymbol: "EUR/CHF", endpoint: "forex", category: "FOREX" },
  EURAUD: { symbol: "EURAUD", feedSymbol: "EUR/AUD", endpoint: "forex", category: "FOREX" },
  GBPCAD: { symbol: "GBPCAD", feedSymbol: "GBP/CAD", endpoint: "forex", category: "FOREX" },
  CHFJPY: { symbol: "CHFJPY", feedSymbol: "CHF/JPY", endpoint: "forex", category: "FOREX" },
  AUDJPY: { symbol: "AUDJPY", feedSymbol: "AUD/JPY", endpoint: "forex", category: "FOREX" },

  // ── Commodities (metals + energy) — forex pairs where AV supports them ───
  XAUUSD: { symbol: "XAUUSD", feedSymbol: "XAU/USD", endpoint: "forex", category: "COMMODITY" },
  XAGUSD: { symbol: "XAGUSD", feedSymbol: "XAG/USD", endpoint: "forex", category: "COMMODITY" },
  // WTI / Brent / NatGas / Copper — not in AV forex; use ETF proxies via stock
  WTIUSD: { symbol: "WTIUSD", feedSymbol: "USO",   endpoint: "stock", category: "COMMODITY" },
  XBRUSD: { symbol: "XBRUSD", feedSymbol: "BNO",   endpoint: "stock", category: "COMMODITY" },
  XPTUSD: { symbol: "XPTUSD", feedSymbol: "PLT",   endpoint: "stock", category: "COMMODITY" },
  XPDUSD: { symbol: "XPDUSD", feedSymbol: "PALL",  endpoint: "stock", category: "COMMODITY" },
  NGUSD:  { symbol: "NGUSD",  feedSymbol: "UNG",   endpoint: "stock", category: "COMMODITY" },
  HGUSD:  { symbol: "HGUSD",  feedSymbol: "CPER",  endpoint: "stock", category: "COMMODITY" },

  // ── Indices (US ETFs + European/Asian via AV if available) ──────────────
  US30:   { symbol: "US30",   feedSymbol: "DIA",   endpoint: "stock", category: "INDEX" },
  NAS100: { symbol: "NAS100", feedSymbol: "QQQ",   endpoint: "stock", category: "INDEX" },
  SPX500: { symbol: "SPX500", feedSymbol: "SPY",   endpoint: "stock", category: "INDEX" },
  GER40:  { symbol: "GER40",  feedSymbol: "EWG",   endpoint: "stock", category: "INDEX" },
  UK100:  { symbol: "UK100",  feedSymbol: "EWU",   endpoint: "stock", category: "INDEX" },
  FRA40:  { symbol: "FRA40",  feedSymbol: "EWQ",   endpoint: "stock", category: "INDEX" },
  JPN225: { symbol: "JPN225", feedSymbol: "EWJ",   endpoint: "stock", category: "INDEX" },
  VIX:    { symbol: "VIX",    feedSymbol: "VIXY",  endpoint: "stock", category: "INDEX" },

  // ── Crypto — from/to pair ───────────────────────────────────────────────
  BTCUSD:   { symbol: "BTCUSD",   feedSymbol: "BTC",   feedQuote: "USD", endpoint: "crypto", category: "CRYPTO" },
  ETHUSD:   { symbol: "ETHUSD",   feedSymbol: "ETH",   feedQuote: "USD", endpoint: "crypto", category: "CRYPTO" },
  SOLUSD:   { symbol: "SOLUSD",   feedSymbol: "SOL",   feedQuote: "USD", endpoint: "crypto", category: "CRYPTO" },
  XRPUSD:   { symbol: "XRPUSD",   feedSymbol: "XRP",   feedQuote: "USD", endpoint: "crypto", category: "CRYPTO" },
  ADAUSD:   { symbol: "ADAUSD",   feedSymbol: "ADA",   feedQuote: "USD", endpoint: "crypto", category: "CRYPTO" },
  DOGEUSD:  { symbol: "DOGEUSD",  feedSymbol: "DOGE",  feedQuote: "USD", endpoint: "crypto", category: "CRYPTO" },
  LINKUSD:  { symbol: "LINKUSD",  feedSymbol: "LINK",  feedQuote: "USD", endpoint: "crypto", category: "CRYPTO" },
  AVAXUSD:  { symbol: "AVAXUSD",  feedSymbol: "AVAX",  feedQuote: "USD", endpoint: "crypto", category: "CRYPTO" },
  MATICUSD: { symbol: "MATICUSD", feedSymbol: "MATIC", feedQuote: "USD", endpoint: "crypto", category: "CRYPTO" },

  // ── Stocks ──────────────────────────────────────────────────────────────
  AAPL: { symbol: "AAPL", feedSymbol: "AAPL", endpoint: "stock", category: "STOCK" },
  MSFT: { symbol: "MSFT", feedSymbol: "MSFT", endpoint: "stock", category: "STOCK" },
  NVDA: { symbol: "NVDA", feedSymbol: "NVDA", endpoint: "stock", category: "STOCK" },
  TSLA: { symbol: "TSLA", feedSymbol: "TSLA", endpoint: "stock", category: "STOCK" },
};

/** Reverse lookup for correlating AV responses back to our symbols. */
export const AV_REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.values(AV_SYMBOL_MAP).map((e) => [e.feedSymbol, e.symbol]),
);

export function avEntryFor(symbol: string): AvSymbolEntry | null {
  return AV_SYMBOL_MAP[symbol] ?? null;
}

export function avFeedSymbolFor(symbol: string): string | null {
  return AV_SYMBOL_MAP[symbol]?.feedSymbol ?? null;
}

export function avEndpointFor(symbol: string): AvEndpoint | null {
  return AV_SYMBOL_MAP[symbol]?.endpoint ?? null;
}

export function avSymbolFromFeed(feedSymbol: string): string | null {
  return AV_REVERSE_MAP[feedSymbol] ?? null;
}
