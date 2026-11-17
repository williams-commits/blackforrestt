import assert from "node:assert/strict";
import test from "node:test";
import {
  isExecutableQuote,
  MAX_EXECUTABLE_QUOTE_AGE_MS,
  staleQuoteDecision,
} from "../src/lib/marketFreshness.js";
import type { Quote } from "../src/lib/types.js";
import type { MarketHoursView } from "../src/lib/marketHours.js";

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

test("stale quote execution requires a valid prior quote and explicit acknowledgement", () => {
  const now = 1_000_000;
  const openAndStale: Pick<MarketHoursView, "isOpen" | "canTrade"> = {
    isOpen: true,
    canTrade: false,
  };

  assert.deepEqual(staleQuoteDecision(openAndStale, now - 61_000, false, now), {
    allowed: false,
    reason: "ACK_REQUIRED",
  });
  assert.deepEqual(staleQuoteDecision(openAndStale, 0, true, now), {
    allowed: false,
    reason: "NO_VALID_QUOTE",
  });
  assert.deepEqual(staleQuoteDecision(openAndStale, now - 61_000, true, now), {
    allowed: true,
    useStalePrice: true,
  });
});

test("stale quote acknowledgement never overrides a closed market", () => {
  assert.deepEqual(
    staleQuoteDecision({ isOpen: false, canTrade: false }, 900_000, true, 1_000_000),
    { allowed: false, reason: "MARKET_CLOSED" },
  );
});

test("fresh executable quotes do not require stale-price acknowledgement", () => {
  assert.deepEqual(
    staleQuoteDecision({ isOpen: true, canTrade: true }, 990_000, false, 1_000_000),
    { allowed: true, useStalePrice: false },
  );
});
