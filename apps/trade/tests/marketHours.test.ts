import assert from "node:assert/strict";
import test from "node:test";
import { FEED_SYMBOL_MAP } from "../src/server/engine/symbolMap.js";
import { isMarketOpenAt, marketHoursForSymbol, marketScheduleForSymbol } from "../src/lib/marketHours.js";

const at = (value: string) => Date.parse(value);

test("every active feed instrument has an explicit market schedule", () => {
  for (const symbol of Object.keys(FEED_SYMBOL_MAP)) {
    assert.ok(marketScheduleForSymbol(symbol), `${symbol} must have a market schedule`);
  }
});

test("crypto is open continuously, including weekends", () => {
  for (const instant of ["2026-11-14T12:00:00Z", "2026-11-15T12:00:00Z"]) {
    const now = at(instant);
    const status = marketHoursForSymbol("BTCUSD", now, now);
    assert.equal(status.state, "OPEN");
    assert.equal(status.canTrade, true);
    assert.equal(status.nextOpenAt, null);
    assert.equal(status.nextCloseAt, null);
  }
});

test("OANDA FX sessions include the daily break and Sunday open in New York time", () => {
  const schedule = marketScheduleForSymbol("EURUSD");
  assert.ok(schedule);
  assert.equal(isMarketOpenAt(schedule, "EURUSD", at("2026-11-10T21:58:00Z")), true);
  assert.equal(isMarketOpenAt(schedule, "EURUSD", at("2026-11-10T21:59:00Z")), false);
  assert.equal(isMarketOpenAt(schedule, "EURUSD", at("2026-11-10T22:05:00Z")), true);
  assert.equal(isMarketOpenAt(schedule, "EURUSD", at("2026-11-08T22:04:00Z")), false);
  assert.equal(isMarketOpenAt(schedule, "EURUSD", at("2026-11-08T22:05:00Z")), true);
});

test("the NZD session applies its additional Auckland maintenance break", () => {
  const schedule = marketScheduleForSymbol("NZDUSD");
  assert.ok(schedule);
  assert.equal(isMarketOpenAt(schedule, "NZDUSD", at("2026-11-10T17:58:00Z")), true);
  assert.equal(isMarketOpenAt(schedule, "NZDUSD", at("2026-11-10T17:59:00Z")), false);
  assert.equal(isMarketOpenAt(schedule, "NZDUSD", at("2026-11-10T18:05:00Z")), true);
});

test("US listed markets observe Thanksgiving and the scheduled early close", () => {
  const schedule = marketScheduleForSymbol("CORNUSD");
  assert.ok(schedule);
  assert.equal(isMarketOpenAt(schedule, "CORNUSD", at("2026-11-26T15:00:00Z")), false);
  assert.equal(isMarketOpenAt(schedule, "CORNUSD", at("2026-11-27T17:59:00Z")), true);
  assert.equal(isMarketOpenAt(schedule, "CORNUSD", at("2026-11-27T18:00:00Z")), false);

  const status = marketHoursForSymbol("CORNUSD", at("2026-11-26T15:00:00Z"), at("2026-11-26T15:00:00Z"));
  assert.equal(status.nextOpenAt, at("2026-11-27T14:30:00Z"));
  assert.equal(status.nextCloseAt, at("2026-11-27T18:00:00Z"));
});

test("US market hours follow daylight-saving transitions", () => {
  const schedule = marketScheduleForSymbol("AAPL");
  assert.ok(schedule);
  assert.equal(isMarketOpenAt(schedule, "AAPL", at("2026-03-09T13:30:00Z")), true);
  assert.equal(isMarketOpenAt(schedule, "AAPL", at("2026-11-09T14:30:00Z")), true);
});

test("Tokyo index session observes the lunch break and Japanese year-end closure", () => {
  const schedule = marketScheduleForSymbol("JPN225");
  assert.ok(schedule);
  assert.equal(isMarketOpenAt(schedule, "JPN225", at("2026-11-10T02:29:00Z")), true);
  assert.equal(isMarketOpenAt(schedule, "JPN225", at("2026-11-10T02:30:00Z")), false);
  assert.equal(isMarketOpenAt(schedule, "JPN225", at("2026-11-10T03:30:00Z")), true);
  assert.equal(isMarketOpenAt(schedule, "JPN225", at("2026-12-31T02:00:00Z")), false);
});

test("an open session remains non-executable until a fresh quote arrives", () => {
  const now = at("2026-11-10T15:00:00Z");
  const waiting = marketHoursForSymbol("AAPL", now, now - 60_000);
  const fresh = marketHoursForSymbol("AAPL", now, now);
  assert.equal(waiting.state, "WAITING_FOR_QUOTE");
  assert.equal(waiting.canTrade, false);
  assert.equal(fresh.state, "OPEN");
  assert.equal(fresh.canTrade, true);
});
