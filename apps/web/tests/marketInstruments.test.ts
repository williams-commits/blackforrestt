import assert from "node:assert/strict";
import test from "node:test";
import { AV_SYMBOL_MAP } from "../src/server/engine/alphavantageMap.js";
import { latestDailyPrice } from "../src/server/engine/alphavantageFeed.js";
import { FEED_SYMBOL_MAP } from "../src/server/engine/symbolMap.js";
import { translateSymbol } from "../src/server/engine/genericFeed.js";

const CRYPTO_ASSETS = [
  "BNBUSD", "TRXUSD", "TONUSD", "SHIBUSD", "XLMUSD", "ETCUSD",
  "FILUSD", "ICPUSD", "NEARUSD", "APTUSD", "SUIUSD", "AAVEUSD",
];

const DIRECT_MARKETS = {
  US2000: { category: "INDEX", feedSymbol: "OANDA:US2000_USD", avSymbol: "RUT" },
  VIX: { category: "INDEX", feedSymbol: "CBOE:VIX", avSymbol: "VIX" },
  WHEATUSD: { category: "COMMODITY", feedSymbol: "OANDA:WHEAT_USD", avSymbol: "WHEAT" },
  SUGARUSD: { category: "COMMODITY", feedSymbol: "OANDA:SUGAR_USD", avSymbol: "SUGAR" },
} as const;

test("new crypto pairs resolve through both web market-data maps and generic feeds", () => {
  for (const symbol of CRYPTO_ASSETS) {
    const asset = symbol.slice(0, -3);
    assert.equal(FEED_SYMBOL_MAP[symbol]?.category, "CRYPTO");
    assert.equal(FEED_SYMBOL_MAP[symbol]?.feedSymbol, `BINANCE:${asset}USDT`);
    assert.equal(AV_SYMBOL_MAP[symbol]?.endpoint, "crypto");
    assert.equal(AV_SYMBOL_MAP[symbol]?.feedSymbol, asset);
    assert.equal(AV_SYMBOL_MAP[symbol]?.feedQuote, "USD");
    for (const mode of ["tickerlayer", "sifting", "lse"] as const) {
      assert.deepEqual(translateSymbol(symbol, mode), { ticker: symbol, endpoint: "crypto" });
    }
  }
});

test("direct indices and commodity CFDs use their native feed symbols", () => {
  for (const [symbol, entry] of Object.entries(DIRECT_MARKETS)) {
    assert.equal(FEED_SYMBOL_MAP[symbol]?.category, entry.category);
    assert.equal(FEED_SYMBOL_MAP[symbol]?.feedSymbol, entry.feedSymbol);
    assert.equal(AV_SYMBOL_MAP[symbol]?.category, entry.category);
    assert.equal(AV_SYMBOL_MAP[symbol]?.feedSymbol, entry.avSymbol);
    assert.equal(Object.keys(AV_SYMBOL_MAP).includes(symbol), true);
  }

  for (const mode of ["tickerlayer", "sifting", "lse"] as const) {
    assert.deepEqual(translateSymbol("WHEATUSD", mode), {
      ticker: "WHEAT/USD",
      endpoint: mode === "lse" ? "fx" : "forex",
    });
    assert.deepEqual(translateSymbol("SUGARUSD", mode), {
      ticker: "SUGAR/USD",
      endpoint: mode === "lse" ? "fx" : "forex",
    });
  }

  assert.deepEqual(
    Object.keys(FEED_SYMBOL_MAP).sort(),
    Object.keys(AV_SYMBOL_MAP).sort(),
    "web provider maps must cover the same instruments",
  );
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
