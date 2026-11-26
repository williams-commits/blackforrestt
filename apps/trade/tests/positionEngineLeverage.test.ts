import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  marginForLeverage,
  marginForPosition,
  markPosition,
  openPosition,
  type InstrumentCfg,
} from "../src/server/engine/positionEngine.js";
import {
  hasValidContractSize,
  resolvePreferredLeverage,
  validateLeveragePolicyConfiguration,
} from "../src/server/leverage.js";

const instrument: InstrumentCfg = {
  symbol: "EURUSD",
  digits: 5,
  pipSize: new Prisma.Decimal("0.0001"),
  pipValue: new Prisma.Decimal(10),
  contractSize: new Prisma.Decimal(100000),
  quoteToAccountRate: new Prisma.Decimal(1),
  marginPerLot: new Prisma.Decimal(1000),
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

test("instruments without selected leverage retain the fixed-margin preset", () => {
  const legacyInstrument = { ...instrument };
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

test("leverage requires a positive contract size", () => {
  assert.equal(hasValidContractSize(new Prisma.Decimal(1)), true);
  assert.equal(hasValidContractSize(new Prisma.Decimal(0)), false);
  assert.equal(hasValidContractSize(new Prisma.Decimal(-1)), false);
});

test("margin calculation uses contract units and quote-currency conversion", () => {
  const btc = {
    ...instrument,
    contractSize: new Prisma.Decimal(1),
    quoteToAccountRate: new Prisma.Decimal(1),
  };
  const opened = openPosition({
    userId: "test-user",
    instrument: btc,
    side: "BUY",
    volume: 0.1,
    type: "CFD",
    strikeRate: null,
    expiryMinutes: null,
    stopLoss: null,
    takeProfit: null,
    marketRate: 64_000,
    leverage: new Prisma.Decimal(5),
  });

  assert.equal(opened.margin.toNumber(), 1280);
  const marked = markPosition(opened.position, 64_001, btc).position;
  assert.equal(marked.profit.toNumber(), 0.1);
});

test("non-USD quote exposure converts both margin and P/L to USD", () => {
  const eurGbp = {
    ...instrument,
    contractSize: new Prisma.Decimal(100000),
    quoteToAccountRate: new Prisma.Decimal("1.25"),
  };
  const opened = openPosition({
    userId: "test-user",
    instrument: eurGbp,
    side: "BUY",
    volume: 0.1,
    type: "CFD",
    strikeRate: null,
    expiryMinutes: null,
    stopLoss: null,
    takeProfit: null,
    marketRate: 0.85,
    leverage: new Prisma.Decimal(5),
  });

  assert.equal(opened.margin.toNumber(), 2125);
  const updatedConversion = {
    ...eurGbp,
    quoteToAccountRate: new Prisma.Decimal("1.30"),
  };
  const marked = markPosition(opened.position, 0.86, updatedConversion).position;
  assert.equal(marked.profit.toNumber(), 130);
  assert.equal(marked.lastQuoteToAccountRate?.toNumber(), 1.3);
});

test("leveraged margin uses the same rounded entry rate stored on the position", () => {
  const btc = {
    ...instrument,
    digits: 2,
    contractSize: new Prisma.Decimal(1),
    quoteToAccountRate: new Prisma.Decimal(1),
  };
  const opened = openPosition({
    userId: "test-user",
    instrument: btc,
    side: "BUY",
    volume: 0.1,
    type: "CFD",
    strikeRate: null,
    expiryMinutes: null,
    stopLoss: null,
    takeProfit: null,
    marketRate: 64_000.126,
    leverage: new Prisma.Decimal(5),
  });

  assert.equal(opened.position.openRate, 64_000.13);
  assert.equal(opened.margin.toNumber(), 1280.0026);
});

test("legacy open positions keep their snapshotted pip-based P/L", () => {
  const btc = {
    ...instrument,
    symbol: "BTCUSD",
    digits: 2,
    pipSize: new Prisma.Decimal("0.1"),
    pipValue: new Prisma.Decimal(1),
    contractSize: new Prisma.Decimal(1),
  };
  const legacyPosition = {
    ...openPosition({
      userId: "test-user",
      instrument: btc,
      side: "BUY",
      volume: 0.1,
      type: "CFD",
      strikeRate: null,
      expiryMinutes: null,
      stopLoss: null,
      takeProfit: null,
      marketRate: 64_000,
    }).position,
    appliedContractSize: null,
    lastQuoteToAccountRate: null,
  };
  const marked = markPosition(legacyPosition, 64_001, btc).position;

  assert.equal(marked.profit.toNumber(), 1);
});

test("margin calculation rejects missing or invalid exposure inputs", () => {
  assert.throws(
    () => marginForLeverage(1, 1.1, new Prisma.Decimal(100000), null, new Prisma.Decimal(20)),
    RangeError,
  );
  assert.throws(
    () => marginForLeverage(1, 1.1, new Prisma.Decimal(100000), new Prisma.Decimal(1), new Prisma.Decimal("0.5")),
    RangeError,
  );
});
