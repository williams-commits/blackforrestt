import assert from "node:assert/strict";
import test from "node:test";
import { getTradeSymbolRedirect } from "../src/lib/tradeSymbolRedirects.js";

test("Binance BTCUSDT links resolve to the terminal's BTCUSD instrument", () => {
  assert.equal(getTradeSymbolRedirect("BTCUSDT"), "BTCUSD");
  assert.equal(getTradeSymbolRedirect("btcusdt"), "BTCUSD");
});

test("provider-facing XRPUSDT and WTI aliases resolve to canonical terminal symbols", () => {
  assert.equal(getTradeSymbolRedirect("XRPUSDT"), "XRPUSD");
  assert.equal(getTradeSymbolRedirect("xrpusdt"), "XRPUSD");
  assert.equal(getTradeSymbolRedirect("WTI"), "WTIUSD");
});

test("existing legacy instrument redirects remain available", () => {
  assert.equal(getTradeSymbolRedirect("MATICUSD"), "POLUSD");
  assert.equal(getTradeSymbolRedirect("VIX"), "VIXY");
  assert.equal(getTradeSymbolRedirect("AUDCAD"), undefined);
});
