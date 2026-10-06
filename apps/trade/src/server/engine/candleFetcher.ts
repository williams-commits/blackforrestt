/**
 * Historical OHLC adapter for Finnhub.
 *
 * Finnhub forex/crypto candle routes require an entitled plan. In `auto` mode
 * the adapter probes normally, opens a process-level circuit after a 401/403,
 * logs one actionable message, and keeps the simulator's deterministic history.
 */
import { candleEndpointFor, feedSymbolFor } from "./symbolMap";
import {
  getFinnhubCandleMode,
  getMarketDataMode,
  requireFinnhubKey,
} from "./marketDataMode";
import type { Candle, CandleInterval } from "./types";
import { INTERVAL_SECONDS } from "./types";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const RESOLUTION_MAP: Record<CandleInterval, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
};

type RestCapability = "unknown" | "available" | "denied";
let restCapability: RestCapability = "unknown";
let entitlementWarningLogged = false;

interface FinnhubCandleResponse {
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v?: number[];
  t: number[];
  s: string;
}

function handleEntitlementDenied(status: number): never | null {
  restCapability = "denied";
  const mode = getFinnhubCandleMode();
  const message =
    `Finnhub historical candles returned HTTP ${status}. Forex/crypto OHLC requires the appropriate Finnhub market-data entitlement. ` +
    "Live WebSocket prices remain enabled; deterministic simulated history will be used.";
  if (!entitlementWarningLogged) {
    entitlementWarningLogged = true;
    console.warn(`📊 ${message}`);
  }
  if (mode === "required") throw new Error(message);
  return null;
}

/** Fetch historical candles for one instrument at one interval. */
export async function fetchCandles(
  symbol: string,
  interval: CandleInterval,
  count: number,
): Promise<Candle[] | null> {
  if (getMarketDataMode() !== "finnhub") return null;
  const candleMode = getFinnhubCandleMode();
  if (candleMode === "disabled" || restCapability === "denied") return null;
  const apiKey = requireFinnhubKey();
  const entry = candleEndpointFor(symbol);
  const feedSymbol = feedSymbolFor(symbol);
  if (!entry || !feedSymbol) return null;

  const resolution = RESOLUTION_MAP[interval];
  const seconds = INTERVAL_SECONDS[interval];
  const to = Math.floor(Date.now() / 1000);
  const from = to - seconds * count;
  const endpoint =
    entry === "forex"
      ? `${FINNHUB_BASE}/forex/candle`
      : entry === "crypto"
        ? `${FINNHUB_BASE}/crypto/candle`
        : `${FINNHUB_BASE}/stock/candle`;
  const url = `${endpoint}?symbol=${encodeURIComponent(feedSymbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "blckforest-market-adapter/1.0" },
    });
    if (response.status === 401 || response.status === 403) return handleEntitlementDenied(response.status);
    if (!response.ok) {
      console.warn(`📉 Finnhub candle request ${symbol} ${interval} failed with HTTP ${response.status}; simulated history retained.`);
      return null;
    }
    restCapability = "available";
    const data = (await response.json()) as FinnhubCandleResponse;
    const length = data.t?.length ?? 0;
    if (
      data.s !== "ok" ||
      length === 0 ||
      data.o?.length !== length ||
      data.h?.length !== length ||
      data.l?.length !== length ||
      data.c?.length !== length
    ) return null;

    const candles: Candle[] = [];
    for (let index = 0; index < length; index += 1) {
      const point = {
        time: data.t[index],
        open: data.o[index],
        high: data.h[index],
        low: data.l[index],
        close: data.c[index],
        volume: data.v?.[index] ?? 0,
      };
      if (
        !Number.isFinite(point.time) ||
        !Number.isFinite(point.open) ||
        !Number.isFinite(point.high) ||
        !Number.isFinite(point.low) ||
        !Number.isFinite(point.close) ||
        point.open <= 0 || point.high <= 0 || point.low <= 0 || point.close <= 0 || point.low > point.high
      ) continue;
      candles.push(point);
    }
    return candles.length > 0 ? candles : null;
  } catch (error) {
    if (getFinnhubCandleMode() === "required") throw error;
    console.warn(`📉 Finnhub candle adapter unavailable (${error instanceof Error ? error.message : String(error)}); simulated history retained.`);
    return null;
  }
}

/** Seed all instruments without repeating entitlement failures. */
export async function seedCandleHistory(
  symbols: string[],
  onCandles: (symbol: string, interval: CandleInterval, candles: Candle[]) => void,
): Promise<void> {
  if (getMarketDataMode() === "simulation") {
    console.log("📊 MARKET_DATA_MODE=simulation — using deterministic simulated candle history.");
    return;
  }
  requireFinnhubKey();
  const candleMode = getFinnhubCandleMode();
  if (candleMode === "disabled") {
    console.log("📊 FINNHUB_CANDLE_MODE=disabled — using simulated history with Finnhub live prices.");
    return;
  }

  console.log(`📊 Checking Finnhub historical-candle access for ${symbols.length} instruments…`);
  let fetched = 0;
  const configuredDelay = Number(process.env.FINNHUB_CANDLE_DELAY_MS ?? 1_050);
  const requestDelayMs = Number.isFinite(configuredDelay) ? Math.max(250, configuredDelay) : 1_050;

  for (let index = 0; index < symbols.length; index += 1) {
    if (restCapability === "denied") break;
    if (index > 0) await sleep(requestDelayMs);
    const symbol = symbols[index];
    const candles = await fetchCandles(symbol, "1m", 300);
    if (!candles?.length) continue;
    onCandles(symbol, "1m", candles);
    fetched += 1;
  }

  if (restCapability === "denied") {
    console.log(`📊 Historical source: simulated fallback for all ${symbols.length} instruments; Finnhub WebSocket remains independent.`);
  } else {
    console.log(`📊 Historical source: ${fetched}/${symbols.length} instruments seeded from Finnhub; remaining instruments use simulation.`);
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
