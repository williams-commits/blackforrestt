import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { computeMetrics } from "../src/server/engine/positionEngine.js";

test("advance credit is displayed but not double-counted in account metrics", () => {
  const amount = (value: number) => new Prisma.Decimal(value);
  const metrics = computeMetrics({
    balance: amount(1_000),
    credit: amount(200),
    available: amount(800),
    positions: [{ profit: amount(25), swap: amount(-5) }],
    margins: [amount(100)],
  });

  assert.equal(metrics.credit.toFixed(2), "200.00");
  assert.equal(metrics.equity.toFixed(2), "1020.00");
  assert.equal(metrics.free.toFixed(2), "820.00");
});
