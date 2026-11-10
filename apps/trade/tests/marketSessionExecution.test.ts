import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { markPosition, openPosition, type InstrumentCfg } from "../src/server/engine/positionEngine.js";

const instrument: InstrumentCfg = {
  symbol: "EURUSD",
  digits: 5,
  pipSize: new Prisma.Decimal("0.0001"),
  pipValue: new Prisma.Decimal(10),
  marginPerLot: new Prisma.Decimal(1000),
  commissionPerLot: new Prisma.Decimal(0),
  swapLongPipsPerDay: new Prisma.Decimal(0),
  swapShortPipsPerDay: new Prisma.Decimal(0),
};

test("closed-session marking defers stop, target, and expiry exits until execution resumes", () => {
  const now = Date.now();
  const cases = [
    {
      name: "stop loss",
      type: "CFD" as const,
      stopLoss: 1.05,
      takeProfit: null,
      expiryMinutes: null,
      markRate: 1.049,
      reason: "STOP_LOSS" as const,
    },
    {
      name: "take profit",
      type: "CFD" as const,
      stopLoss: null,
      takeProfit: 1.15,
      expiryMinutes: null,
      markRate: 1.151,
      reason: "TAKE_PROFIT" as const,
    },
    {
      name: "expiry",
      type: "STRIKE" as const,
      stopLoss: null,
      takeProfit: null,
      expiryMinutes: 1,
      markRate: 1.101,
      reason: "EXPIRY" as const,
    },
  ];

  for (const exitCase of cases) {
    const position = openPosition({
      userId: "test-user",
      instrument,
      side: "BUY",
      volume: 1,
      type: exitCase.type,
      strikeRate: null,
      expiryMinutes: exitCase.expiryMinutes,
      stopLoss: exitCase.stopLoss,
      takeProfit: exitCase.takeProfit,
      marketRate: 1.1,
    }).position;

    const deferred = markPosition(position, exitCase.markRate, instrument, now + 120_000, false);
    assert.equal(deferred.shouldClose, false, `${exitCase.name} should remain open while execution is unavailable`);
    assert.ok(
      Math.abs(deferred.position.currentRate - exitCase.markRate) < 1e-9,
      `${exitCase.name} should still be marked`,
    );

    const resumed = markPosition(position, exitCase.markRate, instrument, now + 120_000, true);
    assert.equal(resumed.shouldClose, true, `${exitCase.name} should execute when a fresh quote resumes`);
    assert.equal(resumed.closeReason, exitCase.reason);
  }
});
