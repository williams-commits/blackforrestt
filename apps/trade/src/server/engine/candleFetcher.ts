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
const FOUR_HOUR_SECONDS = 4 * 60 * 60;
const FINNHUB_PAGE_CANDLES = 10_000;
const RESOLUTION_MAP: Record<Exclude<CandleInterval, "4h">, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "1d": "D",
};
const DEFAULT_CANDLE_DELAY_MS = 1_050;

let candleRequestQueue: Promise<void> = Promise.resolve();
let lastCandleRequestAt = 0;

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

export interface CandleRequestRange {
  from: number;
  to: number;
}

export function planCandleRequestRanges(
  from: number,
  to: number,
  candleSeconds: number,
  maxCandles = FINNHUB_PAGE_CANDLES,
): CandleRequestRange[] {
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    !Number.isFinite(candleSeconds) ||
    !Number.isInteger(maxCandles) ||
    from >= to ||
    candleSeconds <= 0 ||
    maxCandles <= 0
  ) return [];

  const ranges: CandleRequestRange[] = [];
  const chunkSeconds = candleSeconds * maxCandles;
  for (let rangeFrom = from; rangeFrom < to;) {
    const rangeTo = Math.min(to, rangeFrom + chunkSeconds);
    ranges.push({ from: rangeFrom, to: rangeTo });
    rangeFrom = rangeTo;
  }
  return ranges;
}

export function aggregateFourHourCandles(hourlyCandles: Candle[]): Candle[] {
  const buckets = new Map<number, Candle>();
  const orderedCandles = [...hourlyCandles].sort((left, right) => left.time - right.time);

  for (const candle of orderedCandles) {
    const time = Math.floor(candle.time / FOUR_HOUR_SECONDS) * FOUR_HOUR_SECONDS;
    const bucket = buckets.get(time);
    if (bucket) {
      bucket.high = Math.max(bucket.high, candle.high);
      bucket.low = Math.min(bucket.low, candle.low);
      bucket.close = candle.close;
      bucket.volume += candle.volume;
    } else {
      buckets.set(time, { ...candle, time });
    }
  }

  return [...buckets.values()];
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

function scheduleCandleRequest(url: string): Promise<Response> {
  const configured = Number(process.env.FINNHUB_CANDLE_DELAY_MS ?? DEFAULT_CANDLE_DELAY_MS);
  const minDelayMs = Number.isFinite(configured) ? Math.max(250, configured) : DEFAULT_CANDLE_DELAY_MS;
  const request = candleRequestQueue.then(async () => {
    const wait = Math.max(0, lastCandleRequestAt + minDelayMs - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCandleRequestAt = Date.now();
    return fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "blckforest-market-adapter/1.0" },
    });
  });
  candleRequestQueue = request.then(() => undefined, () => undefined);
  return request;
}

/** Fetch historical candles for one instrument at one interval. */
export async function fetchCandles(
  symbol: string,
  interval: CandleInterval,
  count: number,
  before?: number,
): Promise<Candle[] | null> {
  if (getMarketDataMode() !== "finnhub") return null;
  const candleMode = getFinnhubCandleMode();
  if (candleMode === "disabled" || restCapability === "denied") return null;
  const apiKey = requireFinnhubKey();
  const entry = candleEndpointFor(symbol);
  const feedSymbol = feedSymbolFor(symbol);
  if (!entry || !feedSymbol) return null;

  const seconds = INTERVAL_SECONDS[interval];
  const to = Math.min(before ?? Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000));
  const requestedFrom = to - seconds * count;
  const isFourHour = interval === "4h";
  const sourceSeconds = isFourHour ? INTERVAL_SECONDS["1h"] : seconds;
  const from = isFourHour
    ? Math.floor(requestedFrom / FOUR_HOUR_SECONDS) * FOUR_HOUR_SECONDS
    : requestedFrom;
  const resolution = isFourHour ? "60" : RESOLUTION_MAP[interval];
  const endpoint =
    entry === "forex"
      ? `${FINNHUB_BASE}/forex/candle`
      : entry === "crypto"
        ? `${FINNHUB_BASE}/crypto/candle`
        : `${FINNHUB_BASE}/stock/candle`;

  try {
    const requests = planCandleRequestRanges(from, to, sourceSeconds);
    const candlesByTime = new Map<number, Candle>();
    for (const range of requests) {
      const url = `${endpoint}?symbol=${encodeURIComponent(feedSymbol)}&resolution=${resolution}&from=${range.from}&to=${range.to - 1}&token=${apiKey}`;
      const response = await scheduleCandleRequest(url);
      if (response.status === 401 || response.status === 403) return handleEntitlementDenied(response.status);
      if (!response.ok) {
        console.warn(`📉 Finnhub candle request ${symbol} ${interval} failed with HTTP ${response.status}; simulated history retained.`);
        return null;
      }

      const data = (await response.json()) as FinnhubCandleResponse;
      if (data.s === "no_data") {
        restCapability = "available";
        continue;
      }
      const length = data.t?.length ?? 0;
      if (
        data.s !== "ok" ||
        data.o?.length !== length ||
        data.h?.length !== length ||
        data.l?.length !== length ||
        data.c?.length !== length
      ) {
        console.warn(`📉 Finnhub candle request ${symbol} ${interval} returned an invalid response; simulated history retained.`);
        return null;
      }
      restCapability = "available";

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
          point.time < range.from ||
          point.time >= range.to ||
          !Number.isFinite(point.open) ||
          !Number.isFinite(point.high) ||
          !Number.isFinite(point.low) ||
          !Number.isFinite(point.close) ||
          point.open <= 0 || point.high <= 0 || point.low <= 0 || point.close <= 0 || point.low > point.high
        ) continue;
        candlesByTime.set(point.time, point);
      }
    }

    const candles = [...candlesByTime.values()].sort((left, right) => left.time - right.time);
    const result = isFourHour ? aggregateFourHourCandles(candles) : candles;
    return result.length > 0 ? result : null;
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

  for (let index = 0; index < symbols.length; index += 1) {
    if (restCapability === "denied") break;
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
