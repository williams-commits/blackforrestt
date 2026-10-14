/**
 * Design-verification seed for the dev test account (stage3-probe-*).
 * Fills positions/transactions/payments so the account pages can be judged
 * with real data density. DEV ONLY — never run against production.
 *
 * Run: npx tsx scripts/seed-design-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL = "stage3-probe-1791903119658@blackforrestt.dev";

const daysAgo = (d: number, h = 0) =>
  new Date(Date.now() - d * 86_400_000 - h * 3_600_000);

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) throw new Error(`Test user not found: ${EMAIL}`);
  const userId = user.id;

  // Wallet/metrics are ledger projections — allow internal-style writes.
  await prisma.$executeRawUnsafe("SET app.ledger_projection_write = '1'");

  // Idempotent: wipe previous design seeds for this user first.
  await prisma.paymentProof.deleteMany({ where: { paymentRequest: { userId } } });
  await prisma.paymentEvent.deleteMany({ where: { paymentRequest: { userId } } });
  await prisma.paymentRequest.deleteMany({ where: { userId } });
  await prisma.transaction.deleteMany({
    where: { userId, reference: { startsWith: "DESK-SEED" } },
  });
  await prisma.position.deleteMany({ where: { userId, idempotencyKey: { startsWith: "seed-" } } });

  // ── Wallet + metrics ────────────────────────────────────────────────────
  await prisma.wallet.upsert({
    where: { userId_asset: { userId, asset: "USD" } },
    create: { userId, asset: "USD", free: 24_350, locked: 500 },
    update: { free: 24_350, locked: 500 },
  });

  // ── Open positions (mixed P/L, realistic majors + gold) ─────────────────
  const openPositions = [
    { symbol: "EURUSD", side: "BUY" as const, volume: 1.0, openRate: 1.08423, currentRate: 1.08712, profit: 289.0, swap: -2.4, commission: 7, tradingCommission: 2.1, openedAt: daysAgo(2, 5) },
    { symbol: "XAUUSD", side: "SELL" as const, volume: 0.5, openRate: 2652.4, currentRate: 2641.8, profit: 264.0, swap: -4.8, commission: 6.5, tradingCommission: 1.9, openedAt: daysAgo(1, 8) },
    { symbol: "GBPJPY", side: "BUY" as const, volume: 0.8, openRate: 197.324, currentRate: 196.948, profit: -236.8, swap: -1.2, commission: 5.6, tradingCommission: 1.7, openedAt: daysAgo(0, 6) },
  ];
  for (const [i, p] of openPositions.entries()) {
    await prisma.position.create({
      data: {
        userId,
        symbol: p.symbol,
        type: "CFD",
        side: p.side,
        volume: p.volume,
        openRate: p.openRate,
        currentRate: p.currentRate,
        swap: p.swap,
        commission: p.commission,
        tradingCommission: p.tradingCommission,
        profit: p.profit,
        netProfit: p.profit + p.swap - p.commission - p.tradingCommission,
        status: "OPEN",
        openedAt: p.openedAt,
        idempotencyKey: `seed-open-${i}`,
      },
    });
  }

  // ── Closed positions (history spread over ~3 weeks) ─────────────────────
  const closed = [
    { symbol: "EURUSD", side: "BUY" as const, volume: 0.8, openRate: 1.0789, currentRate: 1.0842, profit: 418.4, swap: -3.6, commission: 5.6, tradingCommission: 1.7, opened: 24, closed: 21 },
    { symbol: "XAUUSD", side: "BUY" as const, volume: 1.2, openRate: 2611.2, currentRate: 2648.6, profit: 902.6, swap: -9.2, commission: 12, tradingCommission: 3.6, opened: 19, closed: 14 },
    { symbol: "USDCAD", side: "SELL" as const, volume: 0.6, openRate: 1.3712, currentRate: 1.3748, profit: -154.2, swap: 1.1, commission: 4.2, tradingCommission: 1.3, opened: 12, closed: 10 },
    { symbol: "USDJPY", side: "BUY" as const, volume: 0.5, openRate: 154.82, currentRate: 155.31, profit: 198.3, swap: -2.2, commission: 3.5, tradingCommission: 1.1, opened: 9, closed: 6 },
    { symbol: "GBPUSD", side: "SELL" as const, volume: 0.9, openRate: 1.2731, currentRate: 1.2688, profit: 342.7, swap: -3.1, commission: 6.3, tradingCommission: 1.9, opened: 6, closed: 3 },
    { symbol: "XAGUSD", side: "BUY" as const, volume: 1.5, openRate: 30.84, currentRate: 30.12, profit: -761.8, swap: -5.4, commission: 9, tradingCommission: 2.7, opened: 4, closed: 1 },
  ];
  for (const [i, p] of closed.entries()) {
    await prisma.position.create({
      data: {
        userId,
        symbol: p.symbol,
        type: "CFD",
        side: p.side,
        volume: p.volume,
        openRate: p.openRate,
        currentRate: p.currentRate,
        swap: p.swap,
        commission: p.commission,
        tradingCommission: p.tradingCommission,
        profit: p.profit,
        netProfit: p.profit + p.swap - p.commission - p.tradingCommission,
        status: "CLOSED",
        openedAt: daysAgo(p.opened, 3),
        closedAt: daysAgo(p.closed, 1),
        closeReason: "MANUAL",
        idempotencyKey: `seed-closed-${i}`,
      },
    });
  }

  // ── Transactions (ledger-style feed) ────────────────────────────────────
  const txns = [
    { type: "DEPOSIT", status: "COMPLETED", amount: 20_000, description: "Bank transfer deposit", reference: "DESK-SEED-DEP-001", createdAt: daysAgo(30) },
    { type: "BONUS", status: "COMPLETED", amount: 250, description: "Welcome bonus", reference: "DESK-SEED-BON-001", createdAt: daysAgo(29) },
    { type: "DEPOSIT", status: "COMPLETED", amount: 5_000, description: "Card deposit · Visa •••• 4242", reference: "DESK-SEED-DEP-002", createdAt: daysAgo(21) },
    { type: "WITHDRAW", status: "COMPLETED", amount: -1_500, description: "Withdrawal to bank account", reference: "DESK-SEED-WDR-001", createdAt: daysAgo(18) },
    { type: "COMMISSION", status: "COMPLETED", amount: -5.6, description: "EURUSD opening commission", reference: "DESK-SEED-COM-001", createdAt: daysAgo(24) },
    { type: "COMMISSION", status: "COMPLETED", amount: -12.0, description: "XAUUSD opening commission", reference: "DESK-SEED-COM-002", createdAt: daysAgo(19) },
    { type: "TRADE_PNL", status: "COMPLETED", amount: 410.9, description: "EURUSD manual_close realized P&L", reference: "DESK-SEED-PNL-001", createdAt: daysAgo(21, 2) },
    { type: "TRADE_PNL", status: "COMPLETED", amount: 885.8, description: "XAUUSD manual_close realized P&L", reference: "DESK-SEED-PNL-002", createdAt: daysAgo(14, 2) },
    { type: "SWAP", status: "COMPLETED", amount: -9.2, description: "XAUUSD overnight swap", reference: "DESK-SEED-SWP-001", createdAt: daysAgo(15) },
    { type: "TRADE_PNL", status: "COMPLETED", amount: -156.2, description: "USDCAD manual_close realized P&L", reference: "DESK-SEED-PNL-003", createdAt: daysAgo(10, 2) },
    { type: "WITHDRAW", status: "PENDING", amount: -800, description: "Withdrawal to USDT TRC-20", reference: "DESK-SEED-WDR-002", createdAt: daysAgo(1, 4) },
    { type: "FEE", status: "COMPLETED", amount: -15, description: "Withdrawal processing fee", reference: "DESK-SEED-FEE-001", createdAt: daysAgo(18, 1) },
    { type: "TRADE_PNL", status: "COMPLETED", amount: -765.9, description: "XAGUSD stop_loss realized P&L", reference: "DESK-SEED-PNL-004", createdAt: daysAgo(1, 2) },
    { type: "REVERSAL", status: "COMPLETED", amount: 15, description: "Withdrawal fee reversal", reference: "DESK-SEED-REV-001", createdAt: daysAgo(17) },
  ];
  for (const t of txns as {
    type: "DEPOSIT" | "WITHDRAW" | "BONUS" | "COMMISSION" | "SWAP" | "TRADE_PNL" | "FEE" | "REVERSAL";
    status: "COMPLETED" | "PENDING";
    amount: number;
    description: string;
    reference: string;
    createdAt: Date;
  }[]) {
    await prisma.transaction.create({ data: { userId, ...t } });
  }

  // ── Payment requests (one per lifecycle stage) ──────────────────────────
  const approvedTxn = await prisma.transaction.create({
    data: { userId, type: "DEPOSIT", status: "COMPLETED", amount: 5_000, description: "Bank transfer deposit", reference: "DESK-SEED-PAY-001", createdAt: daysAgo(21, 1) },
  });
  await prisma.paymentRequest.create({
    data: {
      userId,
      transactionId: approvedTxn.id,
      type: "DEPOSIT",
      status: "APPROVED",
      amount: 5_000,
      method: "BANK_TRANSFER",
      userReference: "TRF-88213476",
      externalReference: "IN-5521",
      reconciliationStatus: "MATCHED",
      reconciliationReference: "REC-8821",
      methodDetailsSummary: "HSBC •••• 8842 → BlackForest Securities",
      preparedAt: daysAgo(20, 20),
      reviewedAt: daysAgo(20, 4),
      createdAt: daysAgo(21, 1),
      proofs: {
        create: [{ status: "CLEAN", declaredMime: "image/jpeg", detectedMime: "image/jpeg", sizeBytes: 284_512, uploadedBy: userId, storageKey: "seed-proof-bank", bucket: "quarantine", sha256: "seed-hash-bank", uploadedAt: daysAgo(21), finalizedAt: daysAgo(20, 22) }],
      },
    },
  });

  const pendingTxn = await prisma.transaction.create({
    data: { userId, type: "WITHDRAW", status: "PENDING", amount: -800, description: "Withdrawal to USDT TRC-20", reference: "DESK-SEED-PAY-002", createdAt: daysAgo(1, 4) },
  });
  await prisma.paymentRequest.create({
    data: {
      userId,
      transactionId: pendingTxn.id,
      type: "WITHDRAWAL",
      status: "AWAITING_APPROVAL",
      amount: 800,
      method: "CRYPTO",
      userReference: "TX-9f3a…c21e",
      beneficiarySummary: "USDT TRC-20 · T•••• 7Qf2",
      methodDetailsSummary: "USDT · TRON (TRC-20) network",
      reconciliationStatus: "PENDING",
      riskHoldUntil: daysAgo(0, -2), // still cooling off (2h future)
      createdAt: daysAgo(1, 4),
      proofs: {
        create: [{ status: "CLEAN", declaredMime: "application/pdf", detectedMime: "application/pdf", sizeBytes: 96_204, uploadedBy: userId, storageKey: "seed-proof-usdt", bucket: "quarantine", sha256: "seed-hash-usdt", uploadedAt: daysAgo(1, 3), finalizedAt: daysAgo(1, 2) }],
      },
    },
  });

  const cardTxn = await prisma.transaction.create({
    data: { userId, type: "DEPOSIT", status: "PENDING", amount: 2_000, description: "Card deposit · Visa •••• 4242", reference: "DESK-SEED-PAY-003", createdAt: daysAgo(0, 5) },
  });
  await prisma.paymentRequest.create({
    data: {
      userId,
      transactionId: cardTxn.id,
      type: "DEPOSIT",
      status: "PENDING",
      amount: 2_000,
      method: "CARD",
      externalReference: "CH-3DS-77341",
      reconciliationStatus: "PENDING",
      createdAt: daysAgo(0, 5),
    },
  });

  // ── Event timelines (what the payment detail slider shows) ───────────────
  const bankRequest = await prisma.paymentRequest.findFirst({ where: { userId, method: "BANK_TRANSFER" }, orderBy: { createdAt: "desc" } });
  if (bankRequest) {
    await prisma.paymentEvent.createMany({ data: [
      { paymentRequestId: bankRequest.id, type: "CREATED", createdAt: daysAgo(21, 1) },
      { paymentRequestId: bankRequest.id, type: "PROOF_RECEIVED", createdAt: daysAgo(21) },
      { paymentRequestId: bankRequest.id, type: "PROOF_FINALIZED", createdAt: daysAgo(20, 22) },
      { paymentRequestId: bankRequest.id, type: "PREPARED", createdAt: daysAgo(20, 20) },
      { paymentRequestId: bankRequest.id, type: "APPROVED", createdAt: daysAgo(20, 4) },
      { paymentRequestId: bankRequest.id, type: "RECONCILED", createdAt: daysAgo(20, 2) },
    ] });
  }
  const cryptoRequest = await prisma.paymentRequest.findFirst({ where: { userId, method: "CRYPTO" }, orderBy: { createdAt: "desc" } });
  if (cryptoRequest) {
    await prisma.paymentEvent.createMany({ data: [
      { paymentRequestId: cryptoRequest.id, type: "CREATED", createdAt: daysAgo(1, 4) },
      { paymentRequestId: cryptoRequest.id, type: "PROOF_RECEIVED", createdAt: daysAgo(1, 3) },
      { paymentRequestId: cryptoRequest.id, type: "PROOF_FINALIZED", createdAt: daysAgo(1, 2) },
    ] });
  }
  const cardRequest = await prisma.paymentRequest.findFirst({ where: { userId, method: "CARD" }, orderBy: { createdAt: "desc" } });
  if (cardRequest) {
    await prisma.paymentEvent.createMany({ data: [
      { paymentRequestId: cardRequest.id, type: "CREATED", createdAt: daysAgo(0, 5) },
    ] });
  }

  // ── Account metrics (coherent with the seeded wallet/positions) ─────────
  const floating = openPositions.reduce((s, p) => s + p.profit + p.swap - p.commission - p.tradingCommission, 0);
  const balance = 24_350 + 500; // free + locked
  const margin = 3_240;
  const equity = balance + floating;
  await prisma.accountMetrics.upsert({
    where: { userId },
    create: { userId, balance, credit: 250, equity: equity + 250, margin, marginLevel: ((equity + 250) / margin) * 100, free: equity + 250 - margin, floatingPl: floating },
    update: { balance, credit: 250, equity: equity + 250, margin, marginLevel: ((equity + 250) / margin) * 100, free: equity + 250 - margin, floatingPl: floating },
  });

  console.log("Seed complete:", {
    open: openPositions.length,
    closed: closed.length,
    transactions: txns.length + 3,
    payments: 3,
    equity: (equity + 250).toFixed(2),
  });
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(() => prisma.$disconnect());
