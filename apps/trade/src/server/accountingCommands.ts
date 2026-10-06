import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import {
  appendAuditEvent,
  ensureSystemAccount,
  money,
  postLedgerTransaction,
  refreshLedgerProjections,
  reverseLedgerTransaction,
  userLedgerBalances,
} from "./ledger";

export type ClientEconomicEventKind = "BONUS" | "FEE" | "ADMIN_ADJUSTMENT";

const EVENT_CONFIG: Record<
  ClientEconomicEventKind,
  {
    account: "BONUS_EXPENSE" | "FEE_REVENUE" | "ADJUSTMENT_EQUITY";
    transactionType: "BONUS" | "FEE" | "ADJUSTMENT";
  }
> = {
  BONUS: { account: "BONUS_EXPENSE", transactionType: "BONUS" },
  FEE: { account: "FEE_REVENUE", transactionType: "FEE" },
  ADMIN_ADJUSTMENT: {
    account: "ADJUSTMENT_EQUITY",
    transactionType: "ADJUSTMENT",
  },
};

export async function postClientEconomicEvent(input: {
  userId: string;
  kind: ClientEconomicEventKind;
  /** Signed from the client's perspective: positive credit, negative charge. */
  clientAmount: Prisma.Decimal.Value;
  asset?: string;
  idempotencyKey: string;
  description: string;
  createdBy?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const asset = input.asset ?? "USD";
  const amount = money(input.clientAmount);
  if (amount.isZero()) throw new Error("Economic event amount cannot be zero.");
  if (input.kind === "BONUS" && amount.isNegative()) {
    throw new Error("A bonus correction must reverse the original transaction.");
  }
  if (input.kind === "FEE" && amount.isPositive()) {
    throw new Error("A fee correction must reverse the original transaction.");
  }
  const idempotencyKey = input.idempotencyKey.trim();
  if (idempotencyKey.length < 6 || idempotencyKey.length > 128) {
    throw new Error("A 6 to 128 character idempotency key is required.");
  }

  return prisma.$transaction(
    async (tx) => {
      const balances = await userLedgerBalances(tx, input.userId, asset);
      if (amount.isNegative() && balances.available.lessThan(amount.abs())) {
        throw new Error("Client funds are insufficient for this debit.");
      }
      const config = EVENT_CONFIG[input.kind];
      const contra = await ensureSystemAccount(tx, config.account, asset);
      const absolute = amount.abs();
      const reference = `ECONOMIC:${input.kind}:${input.userId}:${idempotencyKey}`;
      const posting = await postLedgerTransaction(tx, {
        reference,
        kind: input.kind,
        description: input.description,
        createdBy: input.createdBy,
        userId: input.userId,
        sourceType: input.sourceType ?? input.kind,
        sourceId: input.sourceId ?? idempotencyKey,
        metadata: input.metadata,
        lines: amount.isPositive()
          ? [
              { accountId: contra.id, direction: "DEBIT", amount: absolute, asset },
              {
                accountId: balances.accounts.available.id,
                direction: "CREDIT",
                amount: absolute,
                asset,
              },
            ]
          : [
              {
                accountId: balances.accounts.available.id,
                direction: "DEBIT",
                amount: absolute,
                asset,
              },
              { accountId: contra.id, direction: "CREDIT", amount: absolute, asset },
            ],
      });

      await tx.transaction.upsert({
        where: {
          userId_reference: {
            userId: input.userId,
            reference: `EVENT:${input.kind}:${idempotencyKey}`,
          },
        },
        update: {},
        create: {
          userId: input.userId,
          type: config.transactionType,
          status: "COMPLETED",
          amount,
          asset,
          description: input.description,
          reference: `EVENT:${input.kind}:${idempotencyKey}`,
        },
      });
      const projection = await refreshLedgerProjections(tx, input.userId, asset);
      if (!posting.replayed) {
        await appendAuditEvent(tx, {
          actorId: input.createdBy ?? input.userId,
          action: input.kind,
          entityType: "LedgerTransaction",
          entityId: posting.transaction.id,
          metadata: {
            userId: input.userId,
            amount: amount.toFixed(8),
            asset,
            sourceType: input.sourceType ?? null,
            sourceId: input.sourceId ?? null,
          },
        });
      }
      return { ...posting, projection };
    },
    { isolationLevel: "Serializable" },
  );
}

export async function reverseClientEconomicEvent(input: {
  originalReference: string;
  idempotencyKey: string;
  description: string;
  createdBy?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const key = input.idempotencyKey.trim();
  if (key.length < 6 || key.length > 128) {
    throw new Error("A 6 to 128 character idempotency key is required.");
  }
  return prisma.$transaction(
    async (tx) => {
      const original = await tx.ledgerTransaction.findUnique({
        where: { reference: input.originalReference },
        include: {
          entries: {
            include: { account: { select: { userId: true, code: true } } },
          },
        },
      });
      if (!original?.userId) throw new Error("Client ledger transaction was not found.");
      const clientLine = original.entries.find(
        (entry) =>
          entry.account.userId === original.userId &&
          entry.account.code.includes(":CLIENT_FUNDS:"),
      );
      if (!clientLine) throw new Error("Original transaction has no available client-funds line.");

      const reversal = await reverseLedgerTransaction(tx, {
        originalReference: input.originalReference,
        reversalReference: `ECONOMIC:REVERSAL:${original.userId}:${key}`,
        description: input.description,
        createdBy: input.createdBy,
        metadata: input.metadata,
      });
      const reversalAmount =
        clientLine.direction === "CREDIT" ? clientLine.amount.neg() : clientLine.amount;
      await tx.transaction.upsert({
        where: {
          userId_reference: {
            userId: original.userId,
            reference: `EVENT:REVERSAL:${key}`,
          },
        },
        update: {},
        create: {
          userId: original.userId,
          type: "REVERSAL",
          status: "COMPLETED",
          amount: reversalAmount,
          asset: clientLine.asset,
          description: input.description,
          reference: `EVENT:REVERSAL:${key}`,
        },
      });
      const projection = await refreshLedgerProjections(
        tx,
        original.userId,
        clientLine.asset,
      );
      if (!reversal.replayed) {
        await appendAuditEvent(tx, {
          actorId: input.createdBy ?? null,
          action: "LEDGER_TRANSACTION_REVERSED",
          entityType: "LedgerTransaction",
          entityId: reversal.transaction.id,
          metadata: {
            originalTransactionId: original.id,
            userId: original.userId,
            amount: reversalAmount.toFixed(8),
            asset: clientLine.asset,
          },
        });
      }
      return { ...reversal, projection };
    },
    { isolationLevel: "Serializable" },
  );
}
