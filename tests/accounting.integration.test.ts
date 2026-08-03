import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  LedgerConflictError,
  ensureSystemAccount,
  ensureUserLedgerAccount,
  getTrialBalance,
  ledgerAccountBalance,
  money,
  postLedgerTransaction,
  refreshLedgerProjections,
  reverseLedgerTransaction,
  verifyUserAccountingProjection,
} from "../src/server/ledger.js";
import { hub } from "../src/server/engine/hub.js";
import {
  postClientEconomicEvent,
  reverseClientEconomicEvent,
} from "../src/server/accountingCommands.js";

const prisma = new PrismaClient();

test("posted ledger, reversals, projections, and trial balance enforce invariants", async () => {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `accounting-${suffix}@example.invalid`,
      accountNo: suffix.replaceAll("-", "").slice(0, 12),
    },
  });

  const fundingReference = `TEST:FUNDING:${suffix}`;
  const firstPosting = await prisma.$transaction(
    async (tx) => {
      const available = await ensureUserLedgerAccount(tx, user.id, "AVAILABLE");
      const funding = await ensureSystemAccount(tx, "DEMO_FUNDING_EXPENSE");
      const posting = await postLedgerTransaction(tx, {
        reference: fundingReference,
        kind: "DEMO_FUNDING",
        description: "Accounting integration funding",
        userId: user.id,
        sourceType: "AccountingTest",
        sourceId: suffix,
        lines: [
          { accountId: funding.id, direction: "DEBIT", amount: money("1234.56789012"), asset: "USD" },
          { accountId: available.id, direction: "CREDIT", amount: money("1234.56789012"), asset: "USD" },
        ],
      });
      await refreshLedgerProjections(tx, user.id);
      return { posting, availableId: available.id, fundingId: funding.id };
    },
    { isolationLevel: "Serializable" },
  );

  assert.equal(firstPosting.posting.replayed, false);
  assert.equal(firstPosting.posting.transaction.status, "POSTED");
  assert.equal(firstPosting.posting.transaction.entries.length, 2);

  const replay = await prisma.$transaction((tx) =>
    postLedgerTransaction(tx, {
      reference: fundingReference,
      kind: "DEMO_FUNDING",
      description: "Accounting integration funding",
      userId: user.id,
      sourceType: "AccountingTest",
      sourceId: suffix,
      lines: [
        { accountId: firstPosting.fundingId, direction: "DEBIT", amount: money("1234.56789012"), asset: "USD" },
        { accountId: firstPosting.availableId, direction: "CREDIT", amount: money("1234.56789012"), asset: "USD" },
      ],
    }),
  );
  assert.equal(replay.replayed, true);
  assert.equal(replay.transaction.id, firstPosting.posting.transaction.id);

  await assert.rejects(
    prisma.$transaction((tx) =>
      postLedgerTransaction(tx, {
        reference: fundingReference,
        kind: "DEMO_FUNDING",
        description: "Accounting integration funding",
        userId: user.id,
        sourceType: "AccountingTest",
        sourceId: suffix,
        lines: [
          { accountId: firstPosting.fundingId, direction: "DEBIT", amount: money("1"), asset: "USD" },
          { accountId: firstPosting.availableId, direction: "CREDIT", amount: money("1"), asset: "USD" },
        ],
      }),
    ),
    LedgerConflictError,
  );

  await assert.rejects(
    prisma.$transaction((tx) =>
      postLedgerTransaction(tx, {
        reference: `TEST:UNBALANCED:${suffix}`,
        kind: "ADMIN_ADJUSTMENT",
        description: "Must not post",
        userId: user.id,
        lines: [
          { accountId: firstPosting.fundingId, direction: "DEBIT", amount: money("2"), asset: "USD" },
          { accountId: firstPosting.availableId, direction: "CREDIT", amount: money("1"), asset: "USD" },
        ],
      }),
    ),
    /Unbalanced USD ledger transaction/,
  );

  await assert.rejects(
    prisma.wallet.update({
      where: { userId_asset: { userId: user.id, asset: "USD" } },
      data: { free: money("999") },
    }),
    /ledger-derived projection/,
  );
  await assert.rejects(
    prisma.ledgerTransaction.update({
      where: { id: firstPosting.posting.transaction.id },
      data: { description: "mutated" },
    }),
    /immutable/,
  );
  await assert.rejects(
    prisma.ledgerEntry.update({
      where: { id: firstPosting.posting.transaction.entries[0].id },
      data: { amount: money("3") },
    }),
    /immutable/,
  );
  await assert.rejects(
    prisma.ledgerEntry.create({
      data: {
        transactionId: firstPosting.posting.transaction.id,
        accountId: firstPosting.fundingId,
        direction: "DEBIT",
        amount: money("1"),
        asset: "USD",
      },
    }),
    /draft ledger transaction/,
  );

  const reversal = await prisma.$transaction(
    async (tx) => {
      const result = await reverseLedgerTransaction(tx, {
        originalReference: fundingReference,
        reversalReference: `TEST:REVERSAL:${suffix}`,
        description: "Reverse integration funding",
      });
      await refreshLedgerProjections(tx, user.id);
      return result;
    },
    { isolationLevel: "Serializable" },
  );
  assert.equal(reversal.replayed, false);
  assert.equal(reversal.transaction.kind, "REVERSAL");
  assert.equal(reversal.transaction.reversalOfId, firstPosting.posting.transaction.id);

  const availableBalance = await prisma.$transaction((tx) =>
    ledgerAccountBalance(tx, firstPosting.availableId),
  );
  assert.equal(availableBalance.toFixed(8), "0.00000000");

  const projection = await verifyUserAccountingProjection(user.id);
  assert.equal(projection.valid, true, projection.violations.join("; "));

  const trialBalance = await getTrialBalance();
  assert.ok(trialBalance.length > 0);
  for (const row of trialBalance) {
    assert.equal(row.balanced, true, `${row.asset} trial balance differs by ${row.difference}`);
    assert.equal(row.difference.toFixed(8), "0.00000000");
  }
});

test("trade open and close post margin, commission, P&L, and replay only once", async () => {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `trade-ledger-${suffix}@example.invalid`,
      accountNo: suffix.replaceAll("-", "").slice(0, 12),
    },
  });
  await prisma.$transaction(
    async (tx) => {
      const available = await ensureUserLedgerAccount(tx, user.id, "AVAILABLE");
      const funding = await ensureSystemAccount(tx, "DEMO_FUNDING_EXPENSE");
      await postLedgerTransaction(tx, {
        reference: `TEST:TRADE:FUNDING:${suffix}`,
        kind: "DEMO_FUNDING",
        description: "Trade accounting integration funding",
        userId: user.id,
        lines: [
          { accountId: funding.id, direction: "DEBIT", amount: money("5000"), asset: "USD" },
          { accountId: available.id, direction: "CREDIT", amount: money("5000"), asset: "USD" },
        ],
      });
      await refreshLedgerProjections(tx, user.id);
    },
    { isolationLevel: "Serializable" },
  );

  await hub.init();
  const request = {
    userId: user.id,
    symbol: "EURUSD",
    side: "BUY" as const,
    volume: 0.1,
    type: "CFD" as const,
    strikeRate: null,
    expiryMinutes: null,
    stopLoss: null,
    takeProfit: null,
    idempotencyKey: `trade-${suffix}`,
  };
  const opened = await hub.openPositionReq(request);
  const replayed = await hub.openPositionReq(request);
  assert.equal(replayed.position.id, opened.position.id);

  const sourcePostings = await prisma.ledgerTransaction.findMany({
    where: { sourceType: "Position", sourceId: opened.position.id },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(
    sourcePostings.map((posting) => posting.kind).sort(),
    ["COMMISSION", "MARGIN_RESERVATION"],
  );

  const closed = await hub.closePositionReq(user.id, opened.position.id);
  assert.ok(closed);
  assert.equal(closed.position.status, "CLOSED");
  assert.equal(await hub.closePositionReq(user.id, opened.position.id), null);

  const finalPostings = await prisma.ledgerTransaction.findMany({
    where: { sourceType: "Position", sourceId: opened.position.id },
  });
  assert.equal(
    finalPostings.filter((posting) => posting.kind === "MARGIN_RESERVATION").length,
    1,
  );
  assert.equal(finalPostings.filter((posting) => posting.kind === "COMMISSION").length, 1);
  assert.equal(finalPostings.filter((posting) => posting.kind === "REVERSAL").length, 1);
  assert.equal(finalPostings.filter((posting) => posting.kind === "TRADING_PNL").length, 1);

  const projection = await verifyUserAccountingProjection(user.id);
  assert.equal(projection.valid, true, projection.violations.join("; "));
});

test("bonuses, fees, administrative adjustments, and corrections are ledger events", async () => {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `economic-events-${suffix}@example.invalid`,
      accountNo: suffix.replaceAll("-", "").slice(0, 12),
    },
  });
  await prisma.$transaction(async (tx) => {
    const available = await ensureUserLedgerAccount(tx, user.id, "AVAILABLE");
    const funding = await ensureSystemAccount(tx, "DEMO_FUNDING_EXPENSE");
    await postLedgerTransaction(tx, {
      reference: `TEST:EVENT:FUNDING:${suffix}`,
      kind: "DEMO_FUNDING",
      description: "Economic event test funding",
      userId: user.id,
      lines: [
        { accountId: funding.id, direction: "DEBIT", amount: money("100"), asset: "USD" },
        { accountId: available.id, direction: "CREDIT", amount: money("100"), asset: "USD" },
      ],
    });
    await refreshLedgerProjections(tx, user.id);
  });

  const bonus = await postClientEconomicEvent({
    userId: user.id,
    kind: "BONUS",
    clientAmount: "10",
    idempotencyKey: `bonus-${suffix}`,
    description: "Test bonus",
  });
  await postClientEconomicEvent({
    userId: user.id,
    kind: "FEE",
    clientAmount: "-3.25",
    idempotencyKey: `fee-${suffix}`,
    description: "Test fee",
  });
  const feeReplay = await postClientEconomicEvent({
    userId: user.id,
    kind: "FEE",
    clientAmount: "-3.25",
    idempotencyKey: `fee-${suffix}`,
    description: "Test fee",
  });
  assert.equal(feeReplay.replayed, true);
  await postClientEconomicEvent({
    userId: user.id,
    kind: "ADMIN_ADJUSTMENT",
    clientAmount: "1.5",
    idempotencyKey: `adjustment-${suffix}`,
    description: "Test adjustment",
  });
  await reverseClientEconomicEvent({
    originalReference: bonus.transaction.reference,
    idempotencyKey: `bonus-reversal-${suffix}`,
    description: "Correct test bonus",
  });

  const wallet = await prisma.wallet.findUniqueOrThrow({
    where: { userId_asset: { userId: user.id, asset: "USD" } },
  });
  assert.equal(wallet.free.toFixed(8), "98.25000000");
  const kinds = await prisma.ledgerTransaction.groupBy({
    by: ["kind"],
    where: { userId: user.id },
    _count: { _all: true },
  });
  const countByKind = new Map(kinds.map((row) => [row.kind, row._count._all]));
  assert.equal(countByKind.get("BONUS"), 1);
  assert.equal(countByKind.get("FEE"), 1);
  assert.equal(countByKind.get("ADMIN_ADJUSTMENT"), 1);
  assert.equal(countByKind.get("REVERSAL"), 1);
  const projection = await verifyUserAccountingProjection(user.id);
  assert.equal(projection.valid, true, projection.violations.join("; "));
});

test.after(async () => {
  await hub.shutdown();
  await prisma.$disconnect();
});
