import assert from "node:assert/strict";
import test from "node:test";
import { isExecutableQuote, MAX_EXECUTABLE_QUOTE_AGE_MS } from "../src/lib/marketFreshness.js";
import type { Quote } from "../src/lib/types.js";

test("execution quotes remain fresh for 60 seconds, then become stale", () => {
  const now = 1_800_000_000_000;
  const quote: Quote = {
    symbol: "EURUSD",
    bid: 1.1,
    ask: 1.1002,
    mid: 1.1001,
    time: now - 60_000,
    open24h: 1.09,
    high24h: 1.11,
    low24h: 1.08,
    changePct: 0.1,
    marketHours: {
      state: "OPEN",
      isOpen: true,
      canTrade: true,
      venue: "OANDA",
      timezone: "America/New_York",
      nextOpenAt: null,
      nextCloseAt: null,
    },
  };

  assert.equal(MAX_EXECUTABLE_QUOTE_AGE_MS, 60_000);
  assert.equal(isExecutableQuote(quote, "EURUSD", now), true);
  assert.equal(isExecutableQuote({ ...quote, time: now - 60_001 }, "EURUSD", now), false);
});
