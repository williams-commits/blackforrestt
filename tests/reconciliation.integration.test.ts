import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  isUserBlocked,
  releaseBlock,
  runReconciliation,
} from "../src/server/reconciliation.js";
import { money } from "../src/server/ledger.js";

const prisma = new PrismaClient();

test("reconciliation is replay-safe and critical payment mismatches block withdrawals", async () => {
  const suffix = randomUUID();
  const customer = await prisma.user.create({
    data: {
      email: `reconciliation-customer-${suffix}@example.invalid`,
      accountNo: suffix.replaceAll("-", "").slice(0, 12),
      emailVerifiedAt: new Date(),
      verified: true,
    },
  });
  const operator = await prisma.user.create({
    data: {
      email: `reconciliation-admin-${suffix}@example.invalid`,
      accountNo: `a${suffix.replaceAll("-", "").slice(0, 11)}`,
      emailVerifiedAt: new Date(),
      verified: true,
      isAdmin: true,
    },
  });
  const transaction = await prisma.transaction.create({
    data: {
      userId: customer.id,
      type: "DEPOSIT",
      status: "COMPLETED",
      amount: money("50"),
      asset: "USD",
      description: "Reconciliation mismatch fixture",
      reference: `RECON-TEST-TXN-${suffix}`,
    },
  });
  await prisma.paymentRequest.create({
    data: {
      userId: customer.id,
      transactionId: transaction.id,
      type: "DEPOSIT",
      status: "APPROVED",
      amount: money("50"),
      asset: "USD",
      method: "Bank transfer",
      externalReference: `RECON-TEST-EXT-${suffix}`,
      reviewedAt: new Date(),
      reconciliationStatus: "MISMATCHED",
      reconciliationReference: `RECON-TEST-STMT-${suffix}`,
      reconciledAmount: money("49"),
      reconciledAt: new Date(),
      reconciledBy: operator.id,
    },
  });

  const reference = `RECON:TEST:${suffix}`;
  const first = await runReconciliation({
    reference,
    trigger: "MANUAL",
    requestedBy: operator.id,
  });
  assert.equal(first.status, "COMPLETED");
  assert.ok(first.caseCount >= 1);
  assert.ok(first.blockCount >= 1);

  const active = await isUserBlocked(customer.id, "WITHDRAW");
  assert.ok(active, "critical payment mismatch must block withdrawals");

  const runCountBeforeReplay = await prisma.reconciliationRun.count({ where: { reference } });
  const caseCountBeforeReplay = await prisma.reconciliationCase.count({
    where: { run: { reference } },
  });
  const replay = await runReconciliation({
    reference,
    trigger: "MANUAL",
    requestedBy: operator.id,
  });
  assert.deepEqual(replay, first);
  assert.equal(await prisma.reconciliationRun.count({ where: { reference } }), runCountBeforeReplay);
  assert.equal(
    await prisma.reconciliationCase.count({ where: { run: { reference } } }),
    caseCountBeforeReplay,
  );

  assert.equal(
    await releaseBlock({
      blockId: active.id,
      actorId: operator.id,
      note: "Statement discrepancy was independently resolved.",
    }),
    true,
  );
  assert.equal(await isUserBlocked(customer.id, "WITHDRAW"), null);
});

test.after(async () => {
  await prisma.$disconnect();
});
