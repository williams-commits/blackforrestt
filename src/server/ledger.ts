import { createHash } from "node:crypto";
import { Prisma, type AuditDomain } from "@prisma/client";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient;

export type LedgerKind =
  | "DEPOSIT"
  | "WITHDRAWAL_RESERVATION"
  | "WITHDRAWAL"
  | "REVERSAL"
  | "MARGIN_RESERVATION"
  | "COMMISSION"
  | "SWAP"
  | "TRADING_PNL"
  | "BONUS"
  | "FEE"
  | "ADMIN_ADJUSTMENT"
  | "NEGATIVE_BALANCE_PROTECTION"
  | "DEMO_FUNDING";

export type LedgerLine = {
  accountId: string;
  direction: "DEBIT" | "CREDIT";
  amount: Prisma.Decimal;
  asset: string;
};

export type UserLedgerBucket = "AVAILABLE" | "MARGIN" | "WITHDRAWAL_PENDING";

export type SystemLedgerAccount =
  | "CASH_CLEARING"
  | "COMMISSION_REVENUE"
  | "SWAP_REVENUE"
  | "SWAP_EXPENSE"
  | "TRADING_PNL_REVENUE"
  | "TRADING_PNL_EXPENSE"
  | "BONUS_EXPENSE"
  | "FEE_REVENUE"
  | "ADJUSTMENT_EQUITY"
  | "NEGATIVE_BALANCE_EXPENSE"
  | "DEMO_FUNDING_EXPENSE";

const SYSTEM_ACCOUNTS: Record<
  SystemLedgerAccount,
  { name: string; type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" }
> = {
  CASH_CLEARING: { name: "cash clearing", type: "ASSET" },
  COMMISSION_REVENUE: { name: "commission revenue", type: "REVENUE" },
  SWAP_REVENUE: { name: "swap revenue", type: "REVENUE" },
  SWAP_EXPENSE: { name: "swap expense", type: "EXPENSE" },
  TRADING_PNL_REVENUE: { name: "client trading loss revenue", type: "REVENUE" },
  TRADING_PNL_EXPENSE: { name: "client trading profit expense", type: "EXPENSE" },
  BONUS_EXPENSE: { name: "client bonus expense", type: "EXPENSE" },
  FEE_REVENUE: { name: "fee revenue", type: "REVENUE" },
  ADJUSTMENT_EQUITY: { name: "administrative adjustment clearing", type: "EQUITY" },
  NEGATIVE_BALANCE_EXPENSE: { name: "negative balance protection expense", type: "EXPENSE" },
  DEMO_FUNDING_EXPENSE: { name: "simulation funding expense", type: "EXPENSE" },
};

const USER_BUCKET_NAMES: Record<UserLedgerBucket, string> = {
  AVAILABLE: "available client funds liability",
  MARGIN: "reserved margin liability",
  WITHDRAWAL_PENDING: "pending withdrawal liability",
};

export class LedgerConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerConflictError";
  }
}

export function money(value: Prisma.Decimal.Value): Prisma.Decimal {
  const amount = new Prisma.Decimal(value);
  if (!amount.isFinite()) throw new Error("Money amount must be finite.");
  return amount.toDecimalPlaces(8, Prisma.Decimal.ROUND_HALF_EVEN);
}

export async function ensureSystemAccount(
  tx: Tx,
  account: SystemLedgerAccount,
  asset = "USD",
) {
  const definition = SYSTEM_ACCOUNTS[account];
  return tx.ledgerAccount.upsert({
    where: { code: `SYSTEM:${account}:${asset}` },
    update: {},
    create: {
      code: `SYSTEM:${account}:${asset}`,
      name: `${asset} ${definition.name}`,
      type: definition.type,
      asset,
    },
  });
}

export async function ensureUserLedgerAccount(
  tx: Tx,
  userId: string,
  bucket: UserLedgerBucket,
  asset = "USD",
) {
  const code =
    bucket === "AVAILABLE"
      ? `USER:${userId}:CLIENT_FUNDS:${asset}`
      : `USER:${userId}:${bucket}:${asset}`;
  return tx.ledgerAccount.upsert({
    where: { code },
    update: {},
    create: {
      code,
      name: `${asset} ${USER_BUCKET_NAMES[bucket]}`,
      type: "LIABILITY",
      asset,
      userId,
    },
  });
}

export async function ensureCashClearingAccount(tx: Tx, asset = "USD") {
  return ensureSystemAccount(tx, "CASH_CLEARING", asset);
}

/** Compatibility name for the available client-funds liability. */
export async function ensureClientFundsAccount(tx: Tx, userId: string, asset = "USD") {
  return ensureUserLedgerAccount(tx, userId, "AVAILABLE", asset);
}

export function stableJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (value instanceof Prisma.Decimal) return JSON.stringify(value.toFixed());
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",")}}`;
}

function postingFingerprint(input: {
  reference: string;
  kind: LedgerKind;
  description: string;
  userId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  reversalOfId?: string | null;
  metadata?: Prisma.InputJsonValue;
  lines: LedgerLine[];
}): string {
  const lines = input.lines
    .map((line) => ({
      accountId: line.accountId,
      direction: line.direction,
      amount: money(line.amount).toFixed(8),
      asset: line.asset,
    }))
    .sort((left, right) =>
      `${left.asset}:${left.accountId}:${left.direction}`.localeCompare(
        `${right.asset}:${right.accountId}:${right.direction}`,
      ),
    );
  return createHash("sha256")
    .update(
      stableJson({
        reference: input.reference,
        kind: input.kind,
        description: input.description,
        userId: input.userId ?? null,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        reversalOfId: input.reversalOfId ?? null,
        metadata: input.metadata ?? null,
        lines,
      }),
    )
    .digest("hex");
}

export async function postLedgerTransaction(
  tx: Tx,
  input: {
    reference: string;
    kind: LedgerKind;
    description: string;
    createdBy?: string | null;
    userId?: string | null;
    sourceType?: string | null;
    sourceId?: string | null;
    reversalOfId?: string | null;
    metadata?: Prisma.InputJsonValue;
    effectiveAt?: Date;
    lines: LedgerLine[];
  },
): Promise<{
  transaction: Prisma.LedgerTransactionGetPayload<{ include: { entries: true } }>;
  replayed: boolean;
}> {
  const reference = input.reference.trim();
  if (reference.length < 3 || reference.length > 190) {
    throw new Error("Ledger reference must contain 3 to 190 characters.");
  }
  if (input.lines.length < 2) {
    throw new Error("A ledger transaction requires at least two entries.");
  }

  const accountIds = new Set<string>();
  const totals = new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();
  for (const line of input.lines) {
    const amount = money(line.amount);
    if (!amount.greaterThan(0)) throw new Error("Ledger entry amounts must be positive.");
    if (accountIds.has(line.accountId)) {
      throw new Error("A ledger transaction cannot contain duplicate account lines.");
    }
    accountIds.add(line.accountId);
    const total = totals.get(line.asset) ?? {
      debit: money(0),
      credit: money(0),
    };
    if (line.direction === "DEBIT") total.debit = total.debit.add(amount);
    else total.credit = total.credit.add(amount);
    totals.set(line.asset, total);
  }

  for (const [asset, total] of totals) {
    if (!total.debit.equals(total.credit)) {
      throw new Error(
        `Unbalanced ${asset} ledger transaction: debit=${total.debit.toFixed()} credit=${total.credit.toFixed()}`,
      );
    }
  }

  const accounts = await tx.ledgerAccount.findMany({
    where: { id: { in: Array.from(accountIds) } },
    select: { id: true, asset: true },
  });
  if (accounts.length !== accountIds.size) throw new Error("Ledger account not found.");
  const assetByAccount = new Map(accounts.map((account) => [account.id, account.asset]));
  for (const line of input.lines) {
    if (assetByAccount.get(line.accountId) !== line.asset) {
      throw new Error(`Ledger account ${line.accountId} does not accept ${line.asset}.`);
    }
  }

  const fingerprint = postingFingerprint({ ...input, reference });
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ledger:${reference}`}))`;
  const existing = await tx.ledgerTransaction.findUnique({
    where: { reference },
    include: { entries: true },
  });
  if (existing) {
    if (existing.status === "POSTED" && existing.fingerprint === fingerprint) {
      return { transaction: existing, replayed: true };
    }
    throw new LedgerConflictError(`Ledger reference ${reference} is already in use.`);
  }

  const draft = await tx.ledgerTransaction.create({
    data: {
      reference,
      fingerprint,
      kind: input.kind,
      description: input.description,
      status: "DRAFT",
      createdBy: input.createdBy ?? null,
      userId: input.userId ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      reversalOfId: input.reversalOfId ?? null,
      metadata: input.metadata,
      effectiveAt: input.effectiveAt ?? new Date(),
      entries: {
        create: input.lines.map((line) => ({
          accountId: line.accountId,
          direction: line.direction,
          amount: money(line.amount),
          asset: line.asset,
        })),
      },
    },
  });
  const posted = await tx.ledgerTransaction.update({
    where: { id: draft.id },
    data: { status: "POSTED" },
    include: { entries: true },
  });
  return { transaction: posted, replayed: false };
}

export async function reverseLedgerTransaction(
  tx: Tx,
  input: {
    originalReference: string;
    reversalReference: string;
    description: string;
    createdBy?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ledger:${input.originalReference}`}))`;
  const original = await tx.ledgerTransaction.findUnique({
    where: { reference: input.originalReference },
    include: { entries: true, reversedBy: { include: { entries: true } } },
  });
  if (!original || original.status !== "POSTED") {
    throw new Error(`Posted ledger transaction ${input.originalReference} was not found.`);
  }
  if (original.reversedBy) {
    if (original.reversedBy.reference === input.reversalReference) {
      return { transaction: original.reversedBy, replayed: true };
    }
    throw new LedgerConflictError(
      `Ledger transaction ${input.originalReference} was already reversed.`,
    );
  }

  return postLedgerTransaction(tx, {
    reference: input.reversalReference,
    kind: "REVERSAL",
    description: input.description,
    createdBy: input.createdBy,
    userId: original.userId,
    sourceType: original.sourceType,
    sourceId: original.sourceId,
    reversalOfId: original.id,
    metadata: input.metadata,
    lines: original.entries.map((entry) => ({
      accountId: entry.accountId,
      direction: entry.direction === "DEBIT" ? "CREDIT" : "DEBIT",
      amount: entry.amount,
      asset: entry.asset,
    })),
  });
}

export async function ledgerAccountBalance(
  tx: Tx,
  accountId: string,
): Promise<Prisma.Decimal> {
  const totals = await tx.ledgerEntry.groupBy({
    by: ["direction"],
    where: { accountId, transaction: { status: "POSTED" } },
    _sum: { amount: true },
  });
  let credit = money(0);
  let debit = money(0);
  for (const total of totals) {
    const amount = total._sum.amount ?? money(0);
    if (total.direction === "CREDIT") credit = credit.add(amount);
    else debit = debit.add(amount);
  }
  return credit.sub(debit);
}

export async function userLedgerBalances(tx: Tx, userId: string, asset = "USD") {
  const [availableAccount, marginAccount, withdrawalAccount] = await Promise.all([
    ensureUserLedgerAccount(tx, userId, "AVAILABLE", asset),
    ensureUserLedgerAccount(tx, userId, "MARGIN", asset),
    ensureUserLedgerAccount(tx, userId, "WITHDRAWAL_PENDING", asset),
  ]);
  const [available, margin, withdrawalPending] = await Promise.all([
    ledgerAccountBalance(tx, availableAccount.id),
    ledgerAccountBalance(tx, marginAccount.id),
    ledgerAccountBalance(tx, withdrawalAccount.id),
  ]);
  return {
    accounts: {
      available: availableAccount,
      margin: marginAccount,
      withdrawalPending: withdrawalAccount,
    },
    available,
    margin,
    withdrawalPending,
    total: available.add(margin).add(withdrawalPending),
  };
}

export async function refreshLedgerProjections(
  tx: Tx,
  userId: string,
  asset = "USD",
  floatingOverride?: Prisma.Decimal,
  options: { writeWallet?: boolean } = {},
) {
  const balances = await userLedgerBalances(tx, userId, asset);
  const openPositionTotals =
    floatingOverride == null
      ? await tx.position.aggregate({
          where: { userId, status: "OPEN" },
          _sum: { profit: true, swap: true },
        })
      : null;
  const floating = money(
    floatingOverride ??
      (openPositionTotals?._sum.profit ?? money(0)).add(
        openPositionTotals?._sum.swap ?? money(0),
      ),
  );
  const credit = money(0);
  const balance = money(balances.total);
  const equity = money(balance.add(credit).add(floating));
  const free = money(balances.available.add(credit).add(floating));
  const marginLevel = balances.margin.greaterThan(0)
    ? equity.div(balances.margin).mul(100).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_EVEN)
    : null;

  // This flag is transaction-local (`is_local = true`) and PostgreSQL clears it
  // automatically on COMMIT or ROLLBACK. Do not issue a reset query in `finally`:
  // after a serialization/deadlock failure the transaction is aborted and any
  // follow-up statement produces SQLSTATE 25P02, masking the original retryable
  // error.
  await tx.$executeRaw`SELECT set_config('app.ledger_projection_write', '1', true)`;
  const wallet = options.writeWallet === false
    ? await tx.wallet.findUniqueOrThrow({ where: { userId_asset: { userId, asset } } })
    : await tx.wallet.upsert({
        where: { userId_asset: { userId, asset } },
        update: {
          free: money(balances.available),
          locked: money(balances.margin.add(balances.withdrawalPending)),
        },
        create: {
          userId,
          asset,
          free: money(balances.available),
          locked: money(balances.margin.add(balances.withdrawalPending)),
        },
      });
  const metrics = await tx.accountMetrics.upsert({
    where: { userId },
    update: {
      balance,
      credit,
      equity,
      margin: money(balances.margin),
      marginLevel,
      free,
      floatingPl: floating,
    },
    create: {
      userId,
      balance,
      credit,
      equity,
      margin: money(balances.margin),
      marginLevel,
      free,
      floatingPl: floating,
    },
  });
  return { balances, wallet, metrics };
}

export async function getTrialBalance() {
  const grouped = await prisma.ledgerEntry.groupBy({
    by: ["asset", "direction"],
    where: { transaction: { status: "POSTED" } },
    _sum: { amount: true },
  });
  const rows = new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();
  for (const item of grouped) {
    const row = rows.get(item.asset) ?? { debit: money(0), credit: money(0) };
    const amount = item._sum.amount ?? money(0);
    if (item.direction === "DEBIT") row.debit = row.debit.add(amount);
    else row.credit = row.credit.add(amount);
    rows.set(item.asset, row);
  }
  return Array.from(rows, ([asset, row]) => ({
    asset,
    debit: money(row.debit),
    credit: money(row.credit),
    difference: money(row.debit.sub(row.credit)),
    balanced: row.debit.equals(row.credit),
  }));
}

export async function verifyUserAccountingProjection(userId: string, asset = "USD") {
  return prisma.$transaction(async (tx) => {
    const balances = await userLedgerBalances(tx, userId, asset);
    const [wallet, metrics, openTotals] = await Promise.all([
      tx.wallet.findUnique({ where: { userId_asset: { userId, asset } } }),
      tx.accountMetrics.findUnique({ where: { userId } }),
      tx.position.aggregate({
        where: { userId, status: "OPEN" },
        _sum: { profit: true, swap: true },
      }),
    ]);
    const floating = money(openTotals._sum.profit ?? 0).add(openTotals._sum.swap ?? 0);
    const expectedLocked = money(balances.margin.add(balances.withdrawalPending));
    const expectedBalance = money(balances.total);
    const expectedEquity = money(expectedBalance.add(floating));
    const expectedFree = money(balances.available.add(floating));
    const violations: string[] = [];

    if (!wallet) violations.push(`${asset} wallet projection is missing`);
    else {
      if (!wallet.free.equals(balances.available)) {
        violations.push(`${asset} wallet free does not equal available ledger funds`);
      }
      if (!wallet.locked.equals(expectedLocked)) {
        violations.push(`${asset} wallet locked does not equal reserved ledger funds`);
      }
    }

    if (!metrics) violations.push("account metrics projection is missing");
    else {
      if (!metrics.balance.equals(expectedBalance)) {
        violations.push("account balance does not equal total client liability");
      }
      if (!metrics.margin.equals(balances.margin)) {
        violations.push("account margin does not equal reserved margin liability");
      }
      if (!metrics.floatingPl.equals(floating)) {
        violations.push("floating P&L does not equal open-position marks");
      }
      if (!metrics.equity.equals(expectedEquity)) {
        violations.push("equity does not equal balance plus floating P&L");
      }
      if (!metrics.free.equals(expectedFree)) {
        violations.push("free margin does not equal available funds plus floating P&L");
      }
    }
    if (balances.margin.isNegative()) violations.push("reserved margin liability is negative");
    if (balances.withdrawalPending.isNegative()) {
      violations.push("pending withdrawal liability is negative");
    }
    if (balances.available.isNegative()) {
      violations.push("available client funds liability is negative");
    }

    return {
      userId,
      asset,
      valid: violations.length === 0,
      violations,
      balances,
    };
  }, { isolationLevel: "Serializable" });
}

export function inferAuditDomain(action: string, entityType: string): AuditDomain {
  const value = `${action}:${entityType}`.toUpperCase();
  if (value.includes("SECURITY") || value.includes("LOGIN") || value.includes("PASSWORD") || value.includes("MFA") || value.includes("SESSION") || value.includes("EMAIL_VERIFICATION")) return "SECURITY";
  if (value.includes("KYC") || value.includes("DOCUMENT")) return "KYC";
  if (value.includes("PAYMENT") || value.includes("DEPOSIT") || value.includes("WITHDRAW")) return "PAYMENT";
  if (value.includes("LEDGER") || value.includes("ACCOUNTING") || value.includes("TRANSACTION")) return "LEDGER";
  if (value.includes("POSITION") || value.includes("ORDER") || value.includes("EXECUTION") || value.includes("TRADE")) return "EXECUTION";
  if (value.includes("RECONCILIATION")) return "RECONCILIATION";
  if (value.includes("SUPPORT")) return "SUPPORT";
  if (value.includes("CONFIG") || value.includes("INSTRUMENT") || value.includes("RISK_RULE")) return "CONFIGURATION";
  if (value.includes("SYSTEM") || value.includes("SERVICE_HEALTH")) return "SYSTEM";
  return "ADMIN";
}

export async function appendAuditEvent(
  tx: Tx,
  input: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    requestId?: string | null;
    domain?: AuditDomain;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(843920174)`;
  const previous = await tx.auditEvent.findFirst({ orderBy: { sequence: "desc" } });
  const createdAt = new Date();
  const schemaVersion = 2;
  const domain = input.domain ?? inferAuditDomain(input.action, input.entityType);
  const payload = {
    schemaVersion,
    domain,
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    requestId: input.requestId ?? null,
    metadata: input.metadata ?? null,
    previousHash: previous?.eventHash ?? null,
    createdAt: createdAt.toISOString(),
  };
  const eventHash = createHash("sha256").update(stableJson(payload)).digest("hex");

  return tx.auditEvent.create({
    data: {
      ...payload,
      metadata: input.metadata,
      eventHash,
      createdAt,
    },
  });
}
