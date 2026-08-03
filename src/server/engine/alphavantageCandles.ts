/**
 * Alpha Vantage candle-history fetcher. Mirrors the contract of
 * src/server/engine/candleFetcher.ts but uses Alpha Vantage's REST endpoints
 * and time-keyed response shape.
 *
 * Free tier: 5 requests/min, 25/day on premium endpoints. Serial fetch with
 * a delay between calls to stay within the per-minute limit.
 */
import type { Candle, CandleInterval } from "./types";
import { avEntryFor } from "./alphavantageMap";
import { getMarketDataMode, requireAlphavantageKey } from "./marketDataMode";

const AV_BASE = "https://www.alphavantage.co/query";
const FETCH_DELAY_MS = Number(process.env.ALPHAVANTAGE_CANDLE_DELAY_MS ?? 12_000);
const MIN_DELAY_MS = 12_000; // free tier = 5 req/min → 12s between calls

// AV intraday intervals that map to our CandleInterval.
const AV_INTRADAY_INTERVAL: Partial<Record<CandleInterval, string>> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "1h": "60min",
};

interface AvIntradayResponse {
  [timestamp: string]: {
    "1. open": string;
    "2. high": string;
    "3. low": string;
    "4. close": string;
    "5. volume": string;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchIntradayCandles(
  entry: ReturnType<typeof avEntryFor>,
  interval: CandleInterval,
  apiKey: string,
): Promise<Candle[] | null> {
  if (!entry) return null;
  const avInterval = AV_INTRADAY_INTERVAL[interval];
  if (!avInterval) return null;
  const params = new URLSearchParams({ apikey: apiKey, interval: avInterval, outputsize: "compact" });
  if (entry.endpoint === "forex") {
    const [from, to] = entry.feedSymbol.split("/");
    params.set("function", "FX_INTRADAY");
    params.set("from_symbol", from);
    params.set("to_symbol", to);
  } else if (entry.endpoint === "stock") {
    params.set("function", "TIME_SERIES_INTRADAY");
    params.set("symbol", entry.feedSymbol);
  } else {
    // Crypto intraday isn't available on AV free tier; skip silently.
    return null;
  }
  const url = `${AV_BASE}?${params.toString()}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!response.ok) throw new Error(`AV candle ${entry.symbol} returned ${response.status}`);
  const body = (await response.json()) as Record<string, unknown>;
  if (body["Note"] || body["Information"]) return null; // rate-limited or demo
  // AV wraps the time series under a key like "Time Series (1min)" or "FX_INTRADAY".
  const seriesKey = Object.keys(body).find((k) => k.includes("Time Series") || k.includes("Intraday"));
  if (!seriesKey) return null;
  const series = body[seriesKey] as AvIntradayResponse;
  if (!series || typeof series !== "object") return null;
  const candles: Candle[] = Object.entries(series)
    .map(([ts, ohlc]): Candle | null => {
      const time = Math.floor(new Date(ts.replace(" ", "T") + "Z").getTime() / 1000);
      const open = Number(ohlc["1. open"]);
      const high = Number(ohlc["2. high"]);
      const low = Number(ohlc["3. low"]);
      const close = Number(ohlc["4. close"]);
      const volume = Number(ohlc["5. volume"] ?? 0);
      if (![open, high, low, close].every(Number.isFinite) || low > high) return null;
      return { time, open, high, low, close, volume };
    })
    .filter((c): c is Candle => c !== null)
    .sort((a, b) => a.time - b.time)
    .slice(-300); // match the simulator's max candle buffer
  return candles.length >= 10 ? candles : null;
}

/**
 * Seed candle history for each instrument. Mirrors the Finnhub
 * seedCandleHistory contract: calls onCandles(symbol, interval, candles) per
 * successful instrument. Falls back silently (simulated history is retained).
 */
export async function seedAlphavantageCandles(
  symbols: string[],
  onCandles: (symbol: string, interval: CandleInterval, candles: Candle[]) => void,
): Promise<void> {
  if (getMarketDataMode() !== "alphavantage") return;
  const apiKey = requireAlphavantageKey();
  const delay = Math.max(FETCH_DELAY_MS, MIN_DELAY_MS);
  console.log(`📈 Seeding Alpha Vantage candle history (${symbols.length} instruments, ${delay}ms apart)…`);

  for (const symbol of symbols) {
    const entry = avEntryFor(symbol);
    if (!entry || entry.endpoint === "crypto") continue; // AV free tier has no crypto intraday
    try {
      const candles = await fetchIntradayCandles(entry, "1m", apiKey);
      if (candles && candles.length > 0) {
        onCandles(symbol, "1m", candles);
        console.log(`  ✓ ${symbol}: ${candles.length} candles seeded.`);
      }
    } catch (error) {
      console.warn(`  ↺ ${symbol}: candle seeding failed (${error instanceof Error ? error.message : "error"}); simulated history retained.`);
    }
    // Respect the 5 req/min free-tier limit.
    await sleep(delay);
  }
  console.log("📈 Alpha Vantage candle seeding complete.");
}
