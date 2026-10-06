/**
 * Symbol map — translates our instrument symbols (e.g. "AUDCAD") into the
 * Finnhub feed symbols (e.g. "OANDA:AUD_CAD") for both the WebSocket trade
 * stream and the REST candle endpoints.
 *
 * Conventions:
 *   Forex / Commodities → OANDA: prefix, underscore pair separator.
 *   Crypto              → BINANCE: prefix, no separator, USDT quote.
 *   Indices             → ETF proxy tickers (DIA / QQQ / SPY) — the Finnhub
 *                          free tier doesn't expose raw index data; ETFs that
 *                          track each index are the closest free alternative.
 *
 * Reverse map (Finnhub symbol → ours) is also built for fast lookup in the
 * WebSocket message handler, where we receive { s: "OANDA:EUR_USD", p, t }.
 */
import type { InstrumentCategory } from "./types";

export interface FeedSymbolEntry {
  /** Our internal instrument symbol, e.g. "AUDCAD". */
  symbol: string;
  /** Finnhub symbol, e.g. "OANDA:AUD_CAD" or "BINANCE:BTCUSDT". */
  feedSymbol: string;
  /** Which REST candle endpoint to use. */
  candleEndpoint: "forex" | "crypto" | "stock";
  category: InstrumentCategory;
}

export const FEED_SYMBOL_MAP: Record<string, FeedSymbolEntry> = {
  // ── Forex (majors + crosses) ─────────────────────────────────────────────
  AUDCAD: { symbol: "AUDCAD", feedSymbol: "OANDA:AUD_CAD", candleEndpoint: "forex", category: "FOREX" },
  EURUSD: { symbol: "EURUSD", feedSymbol: "OANDA:EUR_USD", candleEndpoint: "forex", category: "FOREX" },
  GBPUSD: { symbol: "GBPUSD", feedSymbol: "OANDA:GBP_USD", candleEndpoint: "forex", category: "FOREX" },
  USDJPY: { symbol: "USDJPY", feedSymbol: "OANDA:USD_JPY", candleEndpoint: "forex", category: "FOREX" },
  AUDUSD: { symbol: "AUDUSD", feedSymbol: "OANDA:AUD_USD", candleEndpoint: "forex", category: "FOREX" },
  USDCAD: { symbol: "USDCAD", feedSymbol: "OANDA:USD_CAD", candleEndpoint: "forex", category: "FOREX" },
  NZDUSD: { symbol: "NZDUSD", feedSymbol: "OANDA:NZD_USD", candleEndpoint: "forex", category: "FOREX" },
  EURGBP: { symbol: "EURGBP", feedSymbol: "OANDA:EUR_GBP", candleEndpoint: "forex", category: "FOREX" },
  USDCHF: { symbol: "USDCHF", feedSymbol: "OANDA:USD_CHF", candleEndpoint: "forex", category: "FOREX" },
  EURJPY: { symbol: "EURJPY", feedSymbol: "OANDA:EUR_JPY", candleEndpoint: "forex", category: "FOREX" },
  GBPJPY: { symbol: "GBPJPY", feedSymbol: "OANDA:GBP_JPY", candleEndpoint: "forex", category: "FOREX" },
  EURCHF: { symbol: "EURCHF", feedSymbol: "OANDA:EUR_CHF", candleEndpoint: "forex", category: "FOREX" },
  EURAUD: { symbol: "EURAUD", feedSymbol: "OANDA:EUR_AUD", candleEndpoint: "forex", category: "FOREX" },
  GBPCAD: { symbol: "GBPCAD", feedSymbol: "OANDA:GBP_CAD", candleEndpoint: "forex", category: "FOREX" },
  CHFJPY: { symbol: "CHFJPY", feedSymbol: "OANDA:CHF_JPY", candleEndpoint: "forex", category: "FOREX" },
  AUDJPY: { symbol: "AUDJPY", feedSymbol: "OANDA:AUD_JPY", candleEndpoint: "forex", category: "FOREX" },

  // ── Commodities (metals + energy) ────────────────────────────────────────
  XAUUSD: { symbol: "XAUUSD", feedSymbol: "OANDA:XAU_USD",    candleEndpoint: "forex", category: "COMMODITY" },
  XAGUSD: { symbol: "XAGUSD", feedSymbol: "OANDA:XAG_USD",    candleEndpoint: "forex", category: "COMMODITY" },
  WTIUSD: { symbol: "WTIUSD", feedSymbol: "OANDA:WTI_USD",    candleEndpoint: "forex", category: "COMMODITY" },
  XBRUSD: { symbol: "XBRUSD", feedSymbol: "OANDA:BCO_USD",    candleEndpoint: "forex", category: "COMMODITY" },
  XPTUSD: { symbol: "XPTUSD", feedSymbol: "OANDA:XPT_USD",    candleEndpoint: "forex", category: "COMMODITY" },
  XPDUSD: { symbol: "XPDUSD", feedSymbol: "OANDA:XPD_USD",    candleEndpoint: "forex", category: "COMMODITY" },
  NGUSD:  { symbol: "NGUSD",  feedSymbol: "OANDA:NATGAS_USD", candleEndpoint: "forex", category: "COMMODITY" },
  HGUSD:  { symbol: "HGUSD",  feedSymbol: "OANDA:XCU_USD",    candleEndpoint: "forex", category: "COMMODITY" },

  // ── Indices (US ETFs + European/Asian via OANDA CFDs) ─────────────────────
  US30:   { symbol: "US30",   feedSymbol: "DIA",            candleEndpoint: "stock", category: "INDEX" },
  NAS100: { symbol: "NAS100", feedSymbol: "QQQ",            candleEndpoint: "stock", category: "INDEX" },
  SPX500: { symbol: "SPX500", feedSymbol: "SPY",            candleEndpoint: "stock", category: "INDEX" },
  GER40:  { symbol: "GER40",  feedSymbol: "OANDA:DE40_EUR", candleEndpoint: "forex", category: "INDEX" },
  UK100:  { symbol: "UK100",  feedSymbol: "OANDA:UK100_GBP",candleEndpoint: "forex", category: "INDEX" },
  FRA40:  { symbol: "FRA40",  feedSymbol: "OANDA:FR40_EUR", candleEndpoint: "forex", category: "INDEX" },
  JPN225: { symbol: "JPN225", feedSymbol: "OANDA:JP225_USD",candleEndpoint: "forex", category: "INDEX" },
  VIX:    { symbol: "VIX",    feedSymbol: "OANDA:VIX_USD",  candleEndpoint: "forex", category: "INDEX" },

  // ── Crypto ───────────────────────────────────────────────────────────────
  BTCUSD:   { symbol: "BTCUSD",   feedSymbol: "BINANCE:BTCUSDT",   candleEndpoint: "crypto", category: "CRYPTO" },
  ETHUSD:   { symbol: "ETHUSD",   feedSymbol: "BINANCE:ETHUSDT",   candleEndpoint: "crypto", category: "CRYPTO" },
  SOLUSD:   { symbol: "SOLUSD",   feedSymbol: "BINANCE:SOLUSDT",   candleEndpoint: "crypto", category: "CRYPTO" },
  XRPUSD:   { symbol: "XRPUSD",   feedSymbol: "BINANCE:XRPUSDT",   candleEndpoint: "crypto", category: "CRYPTO" },
  ADAUSD:   { symbol: "ADAUSD",   feedSymbol: "BINANCE:ADAUSDT",   candleEndpoint: "crypto", category: "CRYPTO" },
  DOGEUSD:  { symbol: "DOGEUSD",  feedSymbol: "BINANCE:DOGEUSDT",  candleEndpoint: "crypto", category: "CRYPTO" },
  LINKUSD:  { symbol: "LINKUSD",  feedSymbol: "BINANCE:LINKUSDT",  candleEndpoint: "crypto", category: "CRYPTO" },
  AVAXUSD:  { symbol: "AVAXUSD",  feedSymbol: "BINANCE:AVAXUSDT",  candleEndpoint: "crypto", category: "CRYPTO" },
  MATICUSD: { symbol: "MATICUSD", feedSymbol: "BINANCE:MATICUSDT", candleEndpoint: "crypto", category: "CRYPTO" },

  // ── Stocks ───────────────────────────────────────────────────────────────
  AAPL: { symbol: "AAPL", feedSymbol: "AAPL", candleEndpoint: "stock", category: "STOCK" },
  MSFT: { symbol: "MSFT", feedSymbol: "MSFT", candleEndpoint: "stock", category: "STOCK" },
  NVDA: { symbol: "NVDA", feedSymbol: "NVDA", candleEndpoint: "stock", category: "STOCK" },
  TSLA: { symbol: "TSLA", feedSymbol: "TSLA", candleEndpoint: "stock", category: "STOCK" },
};

/** Reverse lookup: Finnhub symbol → our symbol. */
export const FEED_REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.values(FEED_SYMBOL_MAP).map((e) => [e.feedSymbol, e.symbol]),
);

/** Get the Finnhub symbol for our instrument (falls back to our symbol if unmapped). */
export function feedSymbolFor(symbol: string): string | null {
  return FEED_SYMBOL_MAP[symbol]?.feedSymbol ?? null;
}

/** Resolve our instrument symbol from a Finnhub feed symbol. */
export function symbolFromFeed(feedSymbol: string): string | null {
  return FEED_REVERSE_MAP[feedSymbol] ?? null;
}

/** Which REST candle endpoint category applies to this instrument. */
export function candleEndpointFor(symbol: string): FeedSymbolEntry["candleEndpoint"] | null {
  return FEED_SYMBOL_MAP[symbol]?.candleEndpoint ?? null;
}
