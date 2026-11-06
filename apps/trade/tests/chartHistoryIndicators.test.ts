import assert from "node:assert/strict";
import test from "node:test";
import {
  computeATRSeries,
  computeStochasticSeries,
  computeVWAPSeries,
  type Candle,
} from "../src/lib/indicators.js";
import {
  CHART_HISTORY_DAYS,
  CHART_HISTORY_WINDOW_SECONDS,
  MAX_CHART_HISTORY_CANDLES,
} from "../src/lib/chartHistory.js";

test("chart history bounds include a full 360 days of one-minute candles", () => {
  assert.equal(CHART_HISTORY_DAYS, 360);
  assert.equal(CHART_HISTORY_WINDOW_SECONDS, 360 * 24 * 60 * 60);
  assert.ok(MAX_CHART_HISTORY_CANDLES >= 360 * 24 * 60);
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
