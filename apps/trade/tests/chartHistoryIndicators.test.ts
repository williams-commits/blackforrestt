import assert from "node:assert/strict";
import test from "node:test";
import {
  computeATRSeries,
  computeStochasticSeries,
  computeVWAPSeries,
  type Candle,
} from "../src/lib/indicators.js";
import { DEFAULT_MARKET_DATA_INTERVAL, type CandleInterval } from "../src/lib/types.js";
import {
  CHART_HISTORY_DAYS,
  CHART_HISTORY_WINDOW_SECONDS,
  MAX_CHART_HISTORY_CANDLES,
} from "../src/lib/chartHistory.js";
import {
  aggregateFourHourCandles,
  fetchCandles,
  planCandleRequestRanges,
} from "../src/server/engine/candleFetcher.js";
import { FEED_SYMBOL_MAP } from "../src/server/engine/symbolMap.js";
import { tradingViewIntervalFor, tradingViewSymbolFor } from "../src/lib/tradingViewSymbols.js";

test("TradingView symbols map known terminal instruments to chartable markets", () => {
  assert.equal(tradingViewSymbolFor("AUDCAD", "FOREX"), "OANDA:AUDCAD");
  assert.equal(tradingViewSymbolFor("BTCUSD", "CRYPTO"), "BINANCE:BTCUSDT");
  assert.equal(tradingViewSymbolFor("US30", "INDEX"), "TVC:DJI");
  assert.equal(tradingViewSymbolFor("AAPL", "STOCK"), "NASDAQ:AAPL");
  assert.equal(tradingViewSymbolFor("UNKNOWN", "FOREX"), null);
});

test("every configured terminal instrument has a TradingView chart symbol", () => {
  for (const instrument of Object.values(FEED_SYMBOL_MAP)) {
    assert.ok(
      tradingViewSymbolFor(instrument.symbol, instrument.category),
      `${instrument.symbol} should have a TradingView symbol`,
    );
  }
});

test("TradingView intervals map correctly and the initial chart uses 5 minutes", () => {
  const intervals = ["1m", "5m", "15m", "1h", "4h", "1d"] as const satisfies readonly CandleInterval[];
  assert.deepEqual(
    intervals.map(tradingViewIntervalFor),
    ["1", "5", "15", "60", "240", "D"],
  );
  assert.equal(tradingViewIntervalFor(DEFAULT_MARKET_DATA_INTERVAL), "5");
});

test("chart history bounds include a full 360 days of one-minute candles", () => {
  assert.equal(CHART_HISTORY_DAYS, 360);
  assert.equal(CHART_HISTORY_WINDOW_SECONDS, 360 * 24 * 60 * 60);
  assert.ok(MAX_CHART_HISTORY_CANDLES >= 360 * 24 * 60);
});

test("four-hour history coverage fits inside the chart candle limit", () => {
  for (const intervalSeconds of [300, 900, 3_600, 14_400, 86_400]) {
    assert.ok(
      MAX_CHART_HISTORY_CANDLES >= Math.ceil(CHART_HISTORY_WINDOW_SECONDS / intervalSeconds),
      `history limit should cover ${intervalSeconds}-second candles`,
    );
  }
});

test("provider request plans cover all 360-day intervals without gaps", () => {
  const providerIntervals = [
    { seconds: 60, providerSeconds: 60 },
    { seconds: 300, providerSeconds: 300 },
    { seconds: 900, providerSeconds: 900 },
    { seconds: 3_600, providerSeconds: 3_600 },
    { seconds: 14_400, providerSeconds: 3_600 },
    { seconds: 86_400, providerSeconds: 86_400 },
  ];

  for (const { seconds, providerSeconds } of providerIntervals) {
    const from = 1_000_000;
    const targetBars = Math.ceil(CHART_HISTORY_WINDOW_SECONDS / seconds);
    const providerBars = targetBars * (seconds / providerSeconds);
    const to = from + providerBars * providerSeconds;
    const ranges = planCandleRequestRanges(from, to, providerSeconds);
    assert.equal(ranges[0]?.from, from);
    assert.equal(ranges.at(-1)?.to, to);
    for (let index = 1; index < ranges.length; index += 1) {
      assert.equal(ranges[index - 1]?.to, ranges[index]?.from);
    }
  }
});

test("full intraday history is split into contiguous provider-safe requests", () => {
  const from = 1_000;
  const to = from + 10_001 * 300;
  const ranges = planCandleRequestRanges(from, to, 300, 10_000);

  assert.deepEqual(ranges, [
    { from, to: from + 10_000 * 300 },
    { from: from + 10_000 * 300, to },
  ]);
});

test("Finnhub fetches every provider-sized page in a long intraday range", async () => {
  const priorMode = process.env.MARKET_DATA_MODE;
  const priorKey = process.env.FINNHUB_API_KEY;
  const priorDelay = process.env.FINNHUB_CANDLE_DELAY_MS;
  const priorFetch = globalThis.fetch;
  const requestRanges: Array<{ from: number; to: number }> = [];
  process.env.MARKET_DATA_MODE = "finnhub";
  process.env.FINNHUB_API_KEY = "unit-test-key";
  process.env.FINNHUB_CANDLE_DELAY_MS = "250";
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const range = {
      from: Number(url.searchParams.get("from")),
      to: Number(url.searchParams.get("to")),
    };
    requestRanges.push(range);
    return new Response(JSON.stringify({
      s: "ok",
      t: [range.from],
      o: [1],
      h: [2],
      l: [0.5],
      c: [1.5],
      v: [3],
    }), { status: 200 });
  }) as typeof fetch;

  try {
    const to = 1_800_000_000;
    const candles = await fetchCandles("GBPUSD", "5m", 10_001, to);
    assert.equal(requestRanges.length, 2);
    assert.equal(candles?.length, 2);
    assert.ok(requestRanges[0]!.from < requestRanges[1]!.from);
    assert.equal(requestRanges[0]!.to + 1, requestRanges[1]!.from);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorMode === undefined) delete process.env.MARKET_DATA_MODE;
    else process.env.MARKET_DATA_MODE = priorMode;
    if (priorKey === undefined) delete process.env.FINNHUB_API_KEY;
    else process.env.FINNHUB_API_KEY = priorKey;
    if (priorDelay === undefined) delete process.env.FINNHUB_CANDLE_DELAY_MS;
    else process.env.FINNHUB_CANDLE_DELAY_MS = priorDelay;
  }
});

test("four-hour candles aggregate ordered hourly OHLCV into UTC buckets", () => {
  const hourly: Candle[] = [
    { time: 14_400, open: 14, high: 18, low: 13, close: 17, volume: 4 },
    { time: 3_600, open: 11, high: 14, low: 10, close: 13, volume: 2 },
    { time: 0, open: 10, high: 12, low: 9, close: 11, volume: 1 },
    { time: 10_800, open: 13, high: 15, low: 12, close: 14, volume: 3 },
    { time: 7_200, open: 12, high: 16, low: 11, close: 15, volume: 2 },
  ];

  assert.deepEqual(aggregateFourHourCandles(hourly), [
    { time: 0, open: 10, high: 16, low: 9, close: 14, volume: 8 },
    { time: 14_400, open: 14, high: 18, low: 13, close: 17, volume: 4 },
  ]);
});

test("ATR series uses true range and Wilder smoothing", () => {
  const candles: Candle[] = [
    { time: 1, open: 10, high: 10, low: 10, close: 10, volume: 1 },
    { time: 2, open: 10, high: 12, low: 9, close: 11, volume: 1 },
    { time: 3, open: 11, high: 13, low: 11, close: 12, volume: 1 },
    { time: 4, open: 12, high: 15, low: 12, close: 14, volume: 1 },
  ];

  assert.deepEqual(computeATRSeries(candles, 2), [
    { time: 3, value: 2.5 },
    { time: 4, value: 2.75 },
  ]);
});

test("Stochastic returns %K and a smoothed %D after warmup", () => {
  const candles: Candle[] = [
    { time: 1, open: 5, high: 10, low: 0, close: 5, volume: 1 },
    { time: 2, open: 5, high: 12, low: 2, close: 8, volume: 1 },
    { time: 3, open: 8, high: 11, low: 3, close: 10, volume: 1 },
    { time: 4, open: 10, high: 14, low: 4, close: 12, volume: 1 },
  ];
  const result = computeStochasticSeries(candles, 3, 2);

  assert.equal(result.length, 2);
  assert.equal(result[0]?.k, (10 / 12) * 100);
  assert.equal(result[0]?.d, null);
  assert.equal(result[1]?.d, (result[0]!.k + result[1]!.k) / 2);
});

test("VWAP is volume-weighted and resets at UTC midnight", () => {
  const candles: Candle[] = [
    { time: 86_398, open: 10, high: 10, low: 10, close: 10, volume: 1 },
    { time: 86_399, open: 12, high: 12, low: 12, close: 12, volume: 3 },
    { time: 86_400, open: 20, high: 20, low: 20, close: 20, volume: 1 },
  ];

  assert.deepEqual(computeVWAPSeries(candles), [
    { time: 86_398, value: 10 },
    { time: 86_399, value: 11.5 },
    { time: 86_400, value: 20 },
  ]);
});
