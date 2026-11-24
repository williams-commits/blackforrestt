import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import { INSTRUMENT_IMAGES } from "../src/components/icons/instrumentAssets.js";

const AI_STOCK_SYMBOLS = [
  "ANT", "AI", "PLTR", "SOUN", "BBAI", "PATH", "NBIS", "CRWV", "TEM",
  "AVGO", "ARM", "TSM", "MU", "MRVL", "QCOM", "ASML", "AMAT", "LRCX",
  "SMCI", "DELL", "HPE", "VRT", "ANET", "SNPS", "CDNS", "IBM", "INTC",
  "ORCL", "CRM", "NOW", "SNOW", "ADBE",
];

const ADDITIONAL_MARKET_SYMBOLS = [
  "BNBUSD", "TRXUSD", "TONUSD", "SHIBUSD", "XLMUSD", "ETCUSD",
  "FILUSD", "ICPUSD", "NEARUSD", "APTUSD", "SUIUSD", "AAVEUSD",
  "US2000", "VIX", "WHEATUSD", "SUGARUSD",
];

test("each added AI stock resolves to a local logo asset", async () => {
  for (const symbol of AI_STOCK_SYMBOLS) {
    const image = INSTRUMENT_IMAGES[symbol];
    assert.ok(image, `${symbol} should resolve to a logo`);
    await access(new URL(`../public/brands/gbfxs/markets/${image}`, import.meta.url));
  }
});

test("each added market has a local raster logo", async () => {
  for (const symbol of ADDITIONAL_MARKET_SYMBOLS) {
    const image = INSTRUMENT_IMAGES[symbol];
    assert.ok(image, `${symbol} should resolve to a logo`);
    assert.match(image, /\.(png|jpe?g|webp)$/i, `${symbol} logo must not be SVG`);
    await access(new URL(`../public/brands/gbfxs/markets/${image}`, import.meta.url));
  }
});
