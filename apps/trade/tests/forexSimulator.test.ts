import assert from "node:assert/strict";
import test from "node:test";
import { ForexSimulator } from "../src/server/engine/forexSimulator.js";
import type { Candle } from "../src/server/engine/types.js";

function createSimulator() {
  return new ForexSimulator({
    symbol: "TESTUSD",
    basePrice: 1,
    digits: 5,
    spread: 0.0002,
    volatility: 0.1,
    reversion: 0.1,
  });
}

test("first live price aligns simulated candles and leaves provider candles unchanged", () => {
  const simulator = createSimulator();
  const providerCandle: Candle = {
    time: 1_700_000_000,
    open: 1.19,
    high: 1.25,
    low: 1.18,
    close: 1.23,
    volume: 10,
  };
  simulator.seedCandles("1h", [providerCandle]);

  const rebased = simulator.setPrice(1.5, 25);

  assert.deepEqual(rebased, ["1m", "5m", "15m", "4h", "1d"]);
  assert.deepEqual(simulator.getCandles("1h", 1), [providerCandle]);

  for (const interval of rebased) {
    const candles = simulator.getCandles(interval);
    assert.equal(candles.at(-1)?.close, simulator.getQuote().mid, `${interval} latest simulated close`);
    for (const candle of candles) {
      assert.ok(candle.low <= candle.open && candle.low <= candle.close);
      assert.ok(candle.high >= candle.open && candle.high >= candle.close);
    }
  }
});

test("later live prices do not repeatedly rescale candle history", () => {
  const simulator = createSimulator();
  simulator.setPrice(1.5);
  const firstCandle = simulator.getCandles("1m")[0];

  assert.ok(firstCandle);
  simulator.setPrice(1.6);

  assert.equal(simulator.getCandles("1m")[0]?.close, firstCandle.close);
  assert.deepEqual(simulator.setPrice(1.7), []);
});
