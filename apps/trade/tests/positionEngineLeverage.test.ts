import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  marginForLeverage,
  marginForPosition,
  openPosition,
  type InstrumentCfg,
} from "../src/server/engine/positionEngine.js";
import {
  hasConsistentNotionalFactor,
  resolvePreferredLeverage,
  validateLeveragePolicyConfiguration,
} from "../src/server/leverage.js";

const instrument: InstrumentCfg = {
  symbol: "EURUSD",
  digits: 5,
  pipSize: new Prisma.Decimal("0.0001"),
  pipValue: new Prisma.Decimal(10),
  marginPerLot: new Prisma.Decimal(1000),
  leverageNotionalFactor: new Prisma.Decimal(100000),
  commissionPerLot: new Prisma.Decimal(0),
  swapLongPipsPerDay: new Prisma.Decimal(0),
  swapShortPipsPerDay: new Prisma.Decimal(0),
};

function openWith(leverage: Prisma.Decimal | null, cfg = instrument) {
  return openPosition({
    userId: "test-user",
    instrument: cfg,
    side: "BUY",
    volume: 1,
    type: "CFD",
    strikeRate: null,
    expiryMinutes: null,
    stopLoss: null,
    takeProfit: null,
    marketRate: 1.1,
    leverage,
  });
}

test("margin uses entry notional divided by leverage and snapshots it on the position", () => {
  const opened = openWith(new Prisma.Decimal(20));

  assert.equal(opened.margin.toNumber(), 5500);
  assert.equal(opened.position.marginUsed.toNumber(), 5500);
  assert.equal(opened.position.appliedLeverage?.toNumber(), 20);
});

test("unverified instruments retain the fixed-margin model without a leverage label", () => {
  const legacyInstrument = { ...instrument, leverageNotionalFactor: null };
  const opened = openWith(null, legacyInstrument);

  assert.equal(opened.margin.toNumber(), 1000);
  assert.equal(opened.position.marginUsed.toNumber(), 1000);
  assert.equal(opened.position.appliedLeverage, null);
});

test("open-position margin remains locked when the instrument margin changes", () => {
  const opened = openWith(new Prisma.Decimal(20));

  assert.equal(marginForPosition(opened.position, new Prisma.Decimal(25000)).toNumber(), 5500);
});

test("asset preference overrides class preference, which overrides the class default", () => {
  const defaultRatio = new Prisma.Decimal(1);
  const maximum = new Prisma.Decimal(100);

  assert.equal(
    resolvePreferredLeverage(defaultRatio, maximum, new Prisma.Decimal(20), new Prisma.Decimal(50)).toNumber(),
    50,
  );
  assert.equal(
    resolvePreferredLeverage(defaultRatio, maximum, new Prisma.Decimal(20), new Prisma.Decimal(101)).toNumber(),
    100,
  );
  assert.equal(
    resolvePreferredLeverage(defaultRatio, maximum, new Prisma.Decimal(101)).toNumber(),
    100,
  );
});

test("class leverage policy requires valid defaults and maxima for every class", () => {
  const configuration = {
    defaults: { FOREX: "1", CRYPTO: "1", COMMODITY: "1", INDEX: "1", STOCK: "1" },
    maximums: { FOREX: "100", CRYPTO: "100", COMMODITY: "25", INDEX: "25", STOCK: "100" },
  };
  assert.equal(validateLeveragePolicyConfiguration(configuration), null);
  assert.match(
    validateLeveragePolicyConfiguration({
      ...configuration,
      maximums: { ...configuration.maximums, CRYPTO: "0" },
    }) ?? "",
    /CRYPTO/,
  );
});

test("verified notional factor must match the engine's pip-based P/L exposure", () => {
  const pipSize = new Prisma.Decimal("0.01");
  const pipValue = new Prisma.Decimal(1);

  assert.equal(hasConsistentNotionalFactor(pipSize, pipValue, new Prisma.Decimal(100)), true);
  assert.equal(hasConsistentNotionalFactor(pipSize, pipValue, new Prisma.Decimal(1)), false);
  assert.equal(hasConsistentNotionalFactor(new Prisma.Decimal(0), pipValue, new Prisma.Decimal(100)), false);
});

test("margin calculation rejects missing or invalid verified exposure inputs", () => {
  assert.throws(
    () => marginForLeverage(1, 1.1, null, new Prisma.Decimal(20)),
    RangeError,
  );
  assert.throws(
    () => marginForLeverage(1, 1.1, new Prisma.Decimal(100000), new Prisma.Decimal("0.5")),
    RangeError,
  );
});
