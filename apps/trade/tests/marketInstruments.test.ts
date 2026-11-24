import assert from "node:assert/strict";
import test from "node:test";
import { AV_SYMBOL_MAP } from "../src/server/engine/alphavantageMap.js";
import { latestDailyPrice } from "../src/server/engine/alphavantageFeed.js";
import { FEED_SYMBOL_MAP } from "../src/server/engine/symbolMap.js";
import { tradingViewSymbolFor } from "../src/lib/tradingViewSymbols.js";

const CRYPTO_PAIRS: Record<string, string> = {
  BNBUSD: "BINANCE:BNBUSDT",
  TRXUSD: "BINANCE:TRXUSDT",
  TONUSD: "BINANCE:TONUSDT",
  SHIBUSD: "BINANCE:SHIBUSDT",
  XLMUSD: "BINANCE:XLMUSDT",
  ETCUSD: "BINANCE:ETCUSDT",
  FILUSD: "BINANCE:FILUSDT",
  ICPUSD: "BINANCE:ICPUSDT",
  NEARUSD: "BINANCE:NEARUSDT",
  APTUSD: "BINANCE:APTUSDT",
  SUIUSD: "BINANCE:SUIUSDT",
  AAVEUSD: "BINANCE:AAVEUSDT",
};

test("new crypto instruments use verified feed pairs and chart symbols", () => {
  for (const [symbol, pair] of Object.entries(CRYPTO_PAIRS)) {
    assert.deepEqual(FEED_SYMBOL_MAP[symbol], {
      symbol,
      feedSymbol: pair,
      candleEndpoint: "crypto",
      category: "CRYPTO",
    });
    assert.deepEqual(AV_SYMBOL_MAP[symbol], {
      symbol,
      feedSymbol: symbol.slice(0, -3),
      feedQuote: "USD",
      endpoint: "crypto",
      category: "CRYPTO",
    });
    assert.equal(
      tradingViewSymbolFor(symbol, "CRYPTO"),
      symbol === "TONUSD" ? "KRAKEN:TONUSDT" : pair,
    );
  }
});

test("direct index and commodity instruments retain native symbols", () => {
  const expected = {
    US2000: { feed: "OANDA:US2000_USD", av: "RUT", chart: "OANDA:US2000USD" },
    VIX: { feed: "CBOE:VIX", av: "VIX", chart: "CBOE:VIX" },
    WHEATUSD: { feed: "OANDA:WHEAT_USD", av: "WHEAT", chart: "OANDA:WHEATUSD" },
    SUGARUSD: { feed: "OANDA:SUGAR_USD", av: "SUGAR", chart: "OANDA:SUGARUSD" },
  } as const;

  for (const [symbol, entries] of Object.entries(expected)) {
    assert.equal(FEED_SYMBOL_MAP[symbol]?.feedSymbol, entries.feed);
    assert.equal(AV_SYMBOL_MAP[symbol]?.feedSymbol, entries.av);
    assert.equal(tradingViewSymbolFor(symbol, FEED_SYMBOL_MAP[symbol]!.category), entries.chart);
  }
});

test("Alpha Vantage daily index prices use the close and retain the source date", () => {
  const quote = latestDailyPrice([
    { date: "2026-05-01", "4. close": "2010.25" },
    { date: "2026-05-02", "4. close": "2021.50" },
  ], "index");

  assert.deepEqual(quote, {
    price: 2021.5,
    timestamp: Date.parse("2026-05-02T00:00:00Z"),
  });
  assert.equal(latestDailyPrice([{ date: "2026-05-02", value: "2021.50" }], "index"), null);
  assert.equal(latestDailyPrice([{ date: "2026-02-31", "4. close": "2021.50" }], "index"), null);
  assert.deepEqual(
    latestDailyPrice([{ date: "2026-05-02", value: "17.25" }], "commodity"),
    { price: 17.25, timestamp: Date.parse("2026-05-02T00:00:00Z") },
  );
});
