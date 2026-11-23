import assert from "node:assert/strict";
import test from "node:test";
import { AV_SYMBOL_MAP } from "../src/server/engine/alphavantageMap.js";
import { FEED_SYMBOL_MAP } from "../src/server/engine/symbolMap.js";
import { translateSymbol } from "../src/server/engine/genericFeed.js";

const AI_STOCK_SYMBOLS = [
  "ANT", "AI", "PLTR", "SOUN", "BBAI", "PATH", "NBIS", "CRWV", "TEM",
  "AVGO", "ARM", "TSM", "MU", "MRVL", "QCOM", "ASML", "AMAT", "LRCX",
  "SMCI", "DELL", "HPE", "VRT", "ANET", "SNPS", "CDNS", "IBM", "INTC",
  "ORCL", "CRM", "NOW", "SNOW", "ADBE",
];

test("web market feed maps all public AI equities to stock providers", () => {
  for (const symbol of AI_STOCK_SYMBOLS) {
    assert.equal(FEED_SYMBOL_MAP[symbol]?.category, "STOCK", `${symbol} should be a stock`);
    assert.equal(FEED_SYMBOL_MAP[symbol]?.feedSymbol, symbol);
    assert.equal(AV_SYMBOL_MAP[symbol]?.feedSymbol, symbol);
    for (const mode of ["tickerlayer", "sifting", "lse"] as const) {
      assert.deepEqual(translateSymbol(symbol, mode), {
        ticker: symbol,
        endpoint: mode === "lse" ? "equity" : "stock",
      });
    }
  }

  assert.deepEqual(
    Object.keys(FEED_SYMBOL_MAP).sort(),
    Object.keys(AV_SYMBOL_MAP).sort(),
    "web feed maps must cover the same instruments",
  );
});
