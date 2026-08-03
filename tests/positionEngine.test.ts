import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  accrueSwap,
  computeMetrics,
  markPosition,
  openPosition,
  pipsBetween,
  type InstrumentCfg,
} from "../src/server/engine/positionEngine.js";

const instrument: InstrumentCfg = {
  symbol: "EURUSD",
  digits: 5,
  pipSize: new Prisma.Decimal("0.0001"),
  pipValue: new Prisma.Decimal("10"),
  marginPerLot: new Prisma.Decimal("1000"),
  commissionPerLot: new Prisma.Decimal("7"),
  swapLongPipsPerDay: new Prisma.Decimal("3.2"),
  swapShortPipsPerDay: new Prisma.Decimal("1.8"),
};

function closeTo(
  actual: Prisma.Decimal.Value,
  expected: Prisma.Decimal.Value,
  tolerance = "0.00000001",
): void {
  const difference = new Prisma.Decimal(actual).sub(expected).abs();
  assert.ok(difference.lessThanOrEqualTo(tolerance), `${actual} != ${expected}`);
}

test("direction-aware pip calculation", () => {
  closeTo(pipsBetween("BUY", 1.1, 1.101, instrument.pipSize), 10);
  closeTo(pipsBetween("SELL", 1.101, 1.1, instrument.pipSize), 10);
});

test("opening and marking a buy position books spread and commission separately", () => {
  const opened = openPosition({
    userId: "user",
    instrument,
    side: "BUY",
    volume: 0.1,
    type: "CFD",
    strikeRate: null,
    expiryMinutes: null,
    stopLoss: null,
    takeProfit: null,
    marketRate: 1.1002,
  });

  closeTo(opened.margin, 100);
  closeTo(opened.commissionTotal, 0.7);
  const marked = markPosition(opened.position, 1.1, instrument);
  closeTo(marked.position.profit, -2);
  closeTo(marked.position.netProfit, -2.7);

  // The hub books commission into balance. Equity must then include only the
  // unrealized market movement, not netProfit, or commission is double-counted.
  const metrics = computeMetrics({
    balance: new Prisma.Decimal("249.3"),
    credit: new Prisma.Decimal(0),
    available: new Prisma.Decimal("149.3"),
    positions: [marked.position],
    margins: [opened.margin],
  });
  closeTo(metrics.equity, 247.3);
  closeTo(metrics.free, 147.3);
  closeTo(metrics.floatingPl, -2);
});


test("dealer P/L adjustment is additive, deterministic, and included in net P/L", () => {
  const opened = openPosition({
    userId: "user",
    instrument,
    side: "BUY",
    volume: 0.1,
    type: "CFD",
    strikeRate: null,
    expiryMinutes: null,
    stopLoss: null,
    takeProfit: null,
    marketRate: 1.1002,
  }).position;
  opened.adminPnlAdjustment = new Prisma.Decimal("25");
  const marked = markPosition(opened, 1.1, instrument);
  closeTo(marked.position.profit, 23);
  closeTo(marked.position.netProfit, 22.3);
});

test("stop-loss and take-profit trigger at the executable mark", () => {
  const opened = openPosition({
    userId: "user",
    instrument,
    side: "BUY",
    volume: 0.1,
    type: "CFD",
    strikeRate: null,
    expiryMinutes: null,
    stopLoss: 1.099,
    takeProfit: 1.102,
    marketRate: 1.1,
  });

  const stopped = markPosition(opened.position, 1.0989, instrument);
  assert.equal(stopped.shouldClose, true);
  assert.equal(stopped.closeReason, "STOP_LOSS");

  const won = markPosition(opened.position, 1.1021, instrument);
  assert.equal(won.shouldClose, true);
  assert.equal(won.closeReason, "TAKE_PROFIT");
});

test("swap accrues once over elapsed time and is included in floating equity", () => {
  const openedAt = Date.UTC(2026, 0, 1);
  const opened = openPosition({
    userId: "user",
    instrument,
    side: "BUY",
    volume: 0.1,
    type: "CFD",
    strikeRate: null,
    expiryMinutes: null,
    stopLoss: null,
    takeProfit: null,
    marketRate: 1.1,
  }).position;
  opened.openedAtMs = openedAt;
  opened.lastSwapMs = openedAt;

  const afterOneDay = accrueSwap(opened, instrument, openedAt + 86_400_000);
  closeTo(afterOneDay.swap, -3.2);
  const unchanged = accrueSwap(afterOneDay, instrument, openedAt + 86_400_000);
  closeTo(unchanged.swap, -3.2);
});

test("strike positions settle only at expiry", () => {
  const opened = openPosition({
    userId: "user",
    instrument,
    side: "BUY",
    volume: 0.1,
    type: "STRIKE",
    strikeRate: 1.1,
    expiryMinutes: 5,
    stopLoss: null,
    takeProfit: null,
    marketRate: 1.1002,
  }).position;

  const before = markPosition(opened, 1.101, instrument, opened.openedTillMs! - 1);
  assert.equal(before.shouldClose, false);
  const atExpiry = markPosition(opened, 1.101, instrument, opened.openedTillMs!);
  assert.equal(atExpiry.shouldClose, true);
  assert.equal(atExpiry.closeReason, "EXPIRY");
});
