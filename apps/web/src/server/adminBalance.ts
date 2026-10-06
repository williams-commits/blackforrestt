import { prisma, withSerializableRetry } from "@/server/db";
import {
  appendAuditEvent,
  ensureSystemAccount,
  ensureUserLedgerAccount,
  money,
  postLedgerTransaction,
  refreshLedgerProjections,
  userLedgerBalances,
} from "@/server/ledger";

export type AdminBalanceAction = "CREDIT" | "DEBIT";

export class AdminBalanceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AdminBalanceError";
  }
}

export async function getUserFinanceHistory(userId: string, limit = 100) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      accountNo: true,
      metrics: {
        select: { balance: true, equity: true, free: true, margin: true, floatingPl: true },
      },
      wallets: {
        where: { asset: "USD" },
        select: { asset: true, free: true, locked: true },
      },
    },
  });
  if (!user) throw new AdminBalanceError("User not found.", 404);

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.max(1, Math.min(200, limit)),
    select: {
      id: true,
      type: true,
      status: true,
      amount: true,
      asset: true,
      description: true,
      reference: true,
      createdAt: true,
    },
  });

  const wallet = user.wallets[0] ?? null;
  return {
    user: { id: user.id, email: user.email, name: user.name, accountNo: user.accountNo },
    metrics: user.metrics ? {
      balance: user.metrics.balance.toFixed(8),
      equity: user.metrics.equity.toFixed(8),
      free: user.metrics.free.toFixed(8),
      margin: user.metrics.margin.toFixed(8),
      floatingPl: user.metrics.floatingPl.toFixed(8),
    } : null,
    wallet: wallet ? {
      asset: wallet.asset,
      free: wallet.free.toFixed(8),
      locked: wallet.locked.toFixed(8),
    } : null,
    transactions: transactions.map((item) => ({
      ...item,
      amount: item.amount.toFixed(8),
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export async function adjustUserBalance(input: {
  actorId: string;
  userId: string;
  action: AdminBalanceAction;
  amount: string;
  reason: string;
  commandKey: string;
}) {
  const amount = money(input.amount);
  // Use greaterThan(0), not isPositive(): Decimal.isPositive() is true for +0,
  // which would let a zero amount through and then fail at the ledger layer.
  if (!amount.greaterThan(0) || amount.greaterThan(money("1000000"))) {
    throw new AdminBalanceError("Amount must be greater than zero and no more than USD 1,000,000.", 400);
  }
  if (input.reason.trim().length < 5 || input.reason.trim().length > 500) {
    throw new AdminBalanceError("An audited reason of 5 to 500 characters is required.", 400);
  }
  if (!/^[A-Za-z0-9._:-]{8,100}$/.test(input.commandKey)) {
    throw new AdminBalanceError("A valid command key is required.", 400);
  }

  const signedAmount = input.action === "CREDIT" ? amount : amount.negated();
  const ledgerReference = `ADMIN_BALANCE:${input.userId}:${input.commandKey}`;
  const transactionReference = `ADMIN-${input.action}-${input.commandKey}`;

  return withSerializableRetry(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`admin-balance:${input.userId}:USD`}))`;
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!user) throw new AdminBalanceError("User not found.", 404);

    const available = await ensureUserLedgerAccount(tx, input.userId, "AVAILABLE", "USD");
    const adjustment = await ensureSystemAccount(tx, "ADJUSTMENT_EQUITY", "USD");
    const existingPosting = await tx.ledgerTransaction.findUnique({
      where: { reference: ledgerReference },
      select: { id: true },
    });
    if (!existingPosting && input.action === "DEBIT") {
      const balances = await userLedgerBalances(tx, input.userId, "USD");
      if (balances.available.lessThan(amount)) {
        throw new AdminBalanceError(
          `Deduction exceeds the available balance of USD ${balances.available.toFixed(2)}.`,
          409,
        );
      }
    }

    const posted = await postLedgerTransaction(tx, {
      reference: ledgerReference,
      kind: "ADMIN_ADJUSTMENT",
      description: `${input.action === "CREDIT" ? "Administrative balance top-up" : "Administrative balance deduction"}: ${input.reason.trim()}`,
      createdBy: input.actorId,
      userId: input.userId,
      sourceType: "User",
      sourceId: input.userId,
      metadata: {
        simulation: true,
        action: input.action,
        amount: amount.toFixed(8),
        reason: input.reason.trim(),
        commandKey: input.commandKey,
      },
      lines: input.action === "CREDIT"
        ? [
            { accountId: adjustment.id, direction: "DEBIT", amount, asset: "USD" },
            { accountId: available.id, direction: "CREDIT", amount, asset: "USD" },
          ]
        : [
            { accountId: available.id, direction: "DEBIT", amount, asset: "USD" },
            { accountId: adjustment.id, direction: "CREDIT", amount, asset: "USD" },
          ],
    });

    const transaction = await tx.transaction.upsert({
      where: { userId_reference: { userId: input.userId, reference: transactionReference } },
      update: {},
      create: {
        userId: input.userId,
        type: "ADJUSTMENT",
        status: "COMPLETED",
        amount: signedAmount,
        asset: "USD",
        description: input.reason.trim(),
        reference: transactionReference,
      },
    });
    const projection = await refreshLedgerProjections(tx, input.userId);
    if (!posted.replayed) {
      await appendAuditEvent(tx, {
        actorId: input.actorId,
        action: input.action === "CREDIT" ? "USER_BALANCE_CREDITED" : "USER_BALANCE_DEBITED",
        entityType: "User",
        entityId: input.userId,
        domain: "LEDGER",
        metadata: {
          amount: amount.toFixed(8),
          asset: "USD",
          reason: input.reason.trim(),
          ledgerTransactionId: posted.transaction.id,
          customerTransactionId: transaction.id,
        },
      });
    }
    return {
      replayed: posted.replayed,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        status: transaction.status,
        amount: transaction.amount.toFixed(8),
        asset: transaction.asset,
        description: transaction.description,
        reference: transaction.reference,
        createdAt: transaction.createdAt.toISOString(),
      },
      metrics: {
        balance: projection.metrics.balance.toFixed(8),
        equity: projection.metrics.equity.toFixed(8),
        free: projection.metrics.free.toFixed(8),
        margin: projection.metrics.margin.toFixed(8),
        floatingPl: projection.metrics.floatingPl.toFixed(8),
      },
    };
  }, { operation: `${input.action.toLowerCase()} user balance ${input.userId}` });
}
