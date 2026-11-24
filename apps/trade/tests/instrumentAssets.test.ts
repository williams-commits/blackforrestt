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

test("each added AI stock resolves to a local logo asset", async () => {
  for (const symbol of AI_STOCK_SYMBOLS) {
    const image = INSTRUMENT_IMAGES[symbol];
    assert.ok(image, `${symbol} should resolve to a logo`);
    await access(new URL(`../public/brands/gbfxs/markets/${image}`, import.meta.url));
  }
});
