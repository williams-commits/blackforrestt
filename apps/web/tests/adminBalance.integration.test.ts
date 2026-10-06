import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  adjustUserBalance,
  AdminBalanceError,
  getUserFinanceHistory,
} from "../src/server/adminBalance.js";

const prisma = new PrismaClient();

test("administrative balance adjustments are balanced, replay-safe, and visible in history", async () => {
  const suffix = randomUUID();
  const actor = await prisma.user.create({
    data: { email: `balance-actor-${suffix}@example.invalid`, accountNo: `a${suffix.replaceAll("-", "").slice(0, 11)}` },
  });
  const customer = await prisma.user.create({
    data: { email: `balance-user-${suffix}@example.invalid`, accountNo: `u${suffix.replaceAll("-", "").slice(0, 11)}` },
  });

  const creditKey = `credit-${suffix}`;
  const credit = await adjustUserBalance({
    actorId: actor.id,
    userId: customer.id,
    action: "CREDIT",
    amount: "250.00",
    reason: "Approved simulation account top-up",
    commandKey: creditKey,
  });
  assert.equal(credit.replayed, false);
  assert.equal(credit.metrics.balance, "250.00000000");

  const replay = await adjustUserBalance({
    actorId: actor.id,
    userId: customer.id,
    action: "CREDIT",
    amount: "250.00",
    reason: "Approved simulation account top-up",
    commandKey: creditKey,
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.metrics.balance, "250.00000000");

  const debit = await adjustUserBalance({
    actorId: actor.id,
    userId: customer.id,
    action: "DEBIT",
    amount: "40.00",
    reason: "Correct duplicate simulation allocation",
    commandKey: `debit-${suffix}`,
  });
  assert.equal(debit.metrics.balance, "210.00000000");

  await assert.rejects(
    adjustUserBalance({
      actorId: actor.id,
      userId: customer.id,
      action: "DEBIT",
      amount: "500.00",
      reason: "Attempt to exceed available funds",
      commandKey: `excess-${suffix}`,
    }),
    (error: unknown) => error instanceof AdminBalanceError && error.status === 409,
  );

  const history = await getUserFinanceHistory(customer.id, 20);
  assert.equal(history.metrics?.balance, "210.00000000");
  const adjustments = history.transactions.filter((item) => item.type === "ADJUSTMENT");
  assert.equal(adjustments.length, 2);
  assert.deepEqual(adjustments.map((item) => item.amount).sort(), ["-40.00000000", "250.00000000"]);

  const ledgerCount = await prisma.ledgerTransaction.count({
    where: { userId: customer.id, kind: "ADMIN_ADJUSTMENT" },
  });
  assert.equal(ledgerCount, 2);
});

test.after(async () => {
  await prisma.$disconnect();
});
