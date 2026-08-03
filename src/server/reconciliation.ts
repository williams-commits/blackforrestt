import { randomUUID } from "node:crypto";
import {
  Prisma,
  type ReconciliationBlockScope,
  type ReconciliationRunTrigger,
  type ReconciliationSeverity,
} from "@prisma/client";
import { prisma, withSerializableRetry } from "./db";
import {
  appendAuditEvent,
  getTrialBalance,
  money,
  userLedgerBalances,
} from "./ledger";

type Tx = Prisma.TransactionClient;

/**
 * Phase 5 reconciliation engine.
 *
 * Matches every operational feed against the authoritative posted ledger and
 * derived projections:
 *   - LEDGER_TRIAL_BALANCE: per-asset debits equal credits (system-wide)
 *   - USER_PROJECTION / WALLET_PROJECTION / ACCOUNT_METRICS: wallet and metrics
 *     fields equal their ledger-derived expected values (mirrors
 *     verifyUserAccountingProjection, generalized to all users)
 *   - POSITION_PNL: a closed position's stored realized P&L equals the value
 *     recomputed from open/close rate, volume, and instrument pip value
 *   - PAYMENT_SETTLEMENT: APPROVED payments with a settlement mismatch surface
 *
 * Critical divergences open a ReconciliationBlock (TRADE or WITHDRAW) that the
 * trading and withdrawal paths enforce. Runs are replay-safe: a second run with
 * the same reference returns the stored summary without re-creating cases.
 */

export type BlockScope = ReconciliationBlockScope;

export interface RunSummary {
  reference: string;
  status: string;
  trigger: ReconciliationRunTrigger;
  windowStart: string | null;
  windowEnd: string | null;
  usersChecked: number;
  caseCount: number;
  blockCount: number;
  summary: Record<string, unknown>;
}

export interface ReconciliationRunOptions {
  reference?: string;
  trigger?: ReconciliationRunTrigger;
  windowStart?: Date;
  windowEnd?: Date;
  requestedBy?: string;
}

export class ReconciliationRunInProgressError extends Error {
  constructor(readonly reference: string) {
    super(`Reconciliation run ${reference} is already in progress.`);
    this.name = "ReconciliationRunInProgressError";
  }
}

interface PendingCase {
  userId?: string;
  feedKind:
    | "LEDGER_TRIAL_BALANCE"
    | "USER_PROJECTION"
    | "WALLET_PROJECTION"
    | "ACCOUNT_METRICS"
    | "POSITION_PNL"
    | "PAYMENT_SETTLEMENT";
  severity: ReconciliationSeverity;
  message: string;
  expectedValue?: string;
  actualValue?: string;
}

function positiveNumber(value: string | undefined, fallback: number, minimum: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

const OPEN_PROJECTION_WINDOW_HOURS = positiveNumber(
  process.env.RECONCILIATION_PAYMENT_PENDING_HOURS,
  72,
  1,
);
const RUN_STALE_MS = positiveNumber(
  process.env.RECONCILIATION_RUN_STALE_MS,
  15 * 60_000,
  60_000,
);

function normalizedReference(value: string): string {
  const normalized = value.trim().slice(0, 160);
  if (normalized.length < 8) throw new Error("Reconciliation reference must contain at least 8 characters.");
  return normalized;
}

function generatedReference(trigger: ReconciliationRunTrigger): string {
  return `RECON:${trigger}:${new Date().toISOString()}:${randomUUID()}`.slice(0, 160);
}

export function scheduledReconciliationReference(windowStart: Date, windowEnd: Date): string {
  return normalizedReference(
    `RECON:SCHEDULED:${windowStart.toISOString()}:${windowEnd.toISOString()}`,
  );
}

function toRunSummary(run: {
  reference: string;
  status: string;
  trigger: ReconciliationRunTrigger;
  windowStart: Date | null;
  windowEnd: Date | null;
  usersChecked: number;
  caseCount: number;
  blockCount: number;
  summary: unknown;
}): RunSummary {
  return {
    reference: run.reference,
    status: run.status,
    trigger: run.trigger,
    windowStart: run.windowStart?.toISOString() ?? null,
    windowEnd: run.windowEnd?.toISOString() ?? null,
    usersChecked: run.usersChecked,
    caseCount: run.caseCount,
    blockCount: run.blockCount,
    summary: (run.summary as Record<string, unknown> | null) ?? {},
  };
}

async function claimRun(options: ReconciliationRunOptions): Promise<{
  replayed?: RunSummary;
  runId?: string;
  reference: string;
}> {
  const trigger = options.trigger ?? "MANUAL";
  const reference = options.reference
    ? normalizedReference(options.reference)
    : generatedReference(trigger);
  const now = new Date();
  const staleBefore = new Date(now.getTime() - RUN_STALE_MS);

  return withSerializableRetry(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reconciliation:${reference}`}))`;
    const existing = await tx.reconciliationRun.findUnique({ where: { reference } });
    if (existing?.status === "COMPLETED") {
      return { reference, replayed: toRunSummary(existing) };
    }
    if (existing?.status === "RUNNING" && existing.heartbeatAt > staleBefore) {
      throw new ReconciliationRunInProgressError(reference);
    }

    let runId: string;
    if (existing) {
      const priorCaseCount = await tx.reconciliationCase.count({
        where: { runId: existing.id },
      });
      // Cases and blocks are persisted atomically only after every feed check
      // succeeds. If they exist, a crash occurred between persistence and run
      // finalization. Recover from aggregate database results instead of
      // loading every case identifier into application memory.
      if (priorCaseCount > 0) {
        const groups = await tx.reconciliationCase.groupBy({
          by: ["feedKind", "severity"],
          where: { runId: existing.id },
          _count: { _all: true },
        });
        const byFeed: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};
        for (const item of groups) {
          byFeed[item.feedKind] = (byFeed[item.feedKind] ?? 0) + item._count._all;
          bySeverity[item.severity] = (bySeverity[item.severity] ?? 0) + item._count._all;
        }
        const [blockCount, usersChecked] = await Promise.all([
          tx.reconciliationBlock.count({ where: { case: { runId: existing.id } } }),
          tx.user.count({ where: { isDev: false } }),
        ]);
        const recovered = await tx.reconciliationRun.update({
          where: { id: existing.id },
          data: {
            status: "COMPLETED",
            completedAt: now,
            heartbeatAt: now,
            usersChecked,
            caseCount: priorCaseCount,
            blockCount,
            summary: { byFeed, bySeverity } as Prisma.InputJsonValue,
            errorMessage: null,
          },
        });
        await appendAuditEvent(tx, {
          actorId: options.requestedBy ?? existing.requestedBy ?? null,
          action: "RECONCILIATION_RUN_RECOVERED",
          entityType: "ReconciliationRun",
          entityId: existing.id,
          metadata: { reference, caseCount: priorCaseCount, blockCount },
        });
        return { reference, replayed: toRunSummary(recovered) };
      }

      const reclaimed = await tx.reconciliationRun.update({
        where: { id: existing.id },
        data: {
          status: "RUNNING",
          trigger: existing.status === "FAILED" ? "RETRY" : trigger,
          windowStart: options.windowStart ?? existing.windowStart,
          windowEnd: options.windowEnd ?? existing.windowEnd,
          requestedBy: options.requestedBy ?? existing.requestedBy,
          startedAt: now,
          heartbeatAt: now,
          completedAt: null,
          usersChecked: 0,
          caseCount: 0,
          blockCount: 0,
          summary: Prisma.JsonNull,
          errorMessage: null,
        },
      });
      runId = reclaimed.id;
    } else {
      const created = await tx.reconciliationRun.create({
        data: {
          reference,
          trigger,
          windowStart: options.windowStart,
          windowEnd: options.windowEnd,
          requestedBy: options.requestedBy,
          heartbeatAt: now,
        },
      });
      runId = created.id;
    }

    await appendAuditEvent(tx, {
      actorId: options.requestedBy ?? null,
      action: "RECONCILIATION_RUN_STARTED",
      entityType: "ReconciliationRun",
      entityId: runId,
      metadata: { reference, trigger, windowStart: options.windowStart?.toISOString() ?? null, windowEnd: options.windowEnd?.toISOString() ?? null },
    });
    return { reference, runId };
  });
}

async function heartbeatRun(runId: string): Promise<void> {
  await prisma.reconciliationRun.updateMany({
    where: { id: runId, status: "RUNNING" },
    data: { heartbeatAt: new Date() },
  });
}

/**
 * Run a full reconciliation pass. A caller-supplied reference is replay-safe:
 * completed runs are returned without duplicating cases or blocks. Stale or
 * failed attempts are reclaimed under a PostgreSQL advisory lock.
 */
export async function runReconciliation(options: ReconciliationRunOptions = {}): Promise<RunSummary> {
  const claimed = await claimRun(options);
  if (claimed.replayed) return claimed.replayed;
  const runId = claimed.runId!;
  const cases: PendingCase[] = [];

  try {
    cases.push(...(await checkTrialBalance()));
    await heartbeatRun(runId);
    cases.push(...(await checkAllUsers()));
    await heartbeatRun(runId);
    cases.push(...(await checkPayments()));
    await heartbeatRun(runId);

    await persistRunResults(runId, cases);
    return await finalizeRun(runId, claimed.reference, cases);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await withSerializableRetry(async (tx) => {
      await tx.reconciliationRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          heartbeatAt: new Date(),
          errorMessage: message.slice(0, 1000),
        },
      });
      await appendAuditEvent(tx, {
        actorId: options.requestedBy ?? null,
        action: "RECONCILIATION_RUN_FAILED",
        entityType: "ReconciliationRun",
        entityId: runId,
        metadata: { reference: claimed.reference, error: message.slice(0, 500) },
      });
    });
    throw error;
  }
}

/** System-wide double-entry: per-asset trial balance difference must be zero. */
async function checkTrialBalance(): Promise<PendingCase[]> {
  const rows = await getTrialBalance();
  const cases: PendingCase[] = [];
  for (const row of rows) {
    if (!row.balanced) {
      cases.push({
        feedKind: "LEDGER_TRIAL_BALANCE",
        severity: "CRITICAL",
        message: `Trial balance is not zero for asset ${row.asset}.`,
        expectedValue: row.debit.toFixed(8),
        actualValue: row.credit.toFixed(8),
      });
    }
  }
  return cases;
}

/** Per-user projection + position-P&L checks across every user with activity. */
async function checkAllUsers(): Promise<PendingCase[]> {
  const cases: PendingCase[] = [];
  let cursor: string | undefined;

  // Bound memory while retaining deterministic full-population coverage.
  for (;;) {
    const users = await prisma.user.findMany({
      where: { isDev: false },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const user of users) {
      cases.push(...(await checkUserProjection(user.id)));
      cases.push(...(await checkClosedPositions(user.id)));
    }
    if (users.length < 100) break;
    cursor = users.at(-1)?.id;
  }
  return cases;
}

/** Wallet + account-metrics projection vs ledger-derived expected values. */
async function checkUserProjection(userId: string): Promise<PendingCase[]> {
  return withSerializableRetry(async (tx) => {
    const balances = await userLedgerBalances(tx, userId, "USD");
    const [wallet, metrics, openTotals] = await Promise.all([
      tx.wallet.findUnique({ where: { userId_asset: { userId, asset: "USD" } } }),
      tx.accountMetrics.findUnique({ where: { userId } }),
      tx.position.aggregate({
        where: { userId, status: "OPEN" },
        _sum: { profit: true, swap: true },
      }),
    ]);
    const floating = money(money(openTotals._sum.profit ?? 0).add(openTotals._sum.swap ?? 0));
    const expectedLocked = money(balances.margin.add(balances.withdrawalPending));
    const cases: PendingCase[] = [];

    if (!wallet) {
      cases.push(critical(userId, "WALLET_PROJECTION", "USD wallet projection is missing."));
    } else {
      if (!wallet.free.equals(balances.available)) {
        cases.push({
          userId, feedKind: "WALLET_PROJECTION", severity: "CRITICAL",
          message: "Wallet free funds do not equal available ledger liability.",
          expectedValue: balances.available.toFixed(8), actualValue: wallet.free.toFixed(8),
        });
      }
      if (!wallet.locked.equals(expectedLocked)) {
        cases.push({
          userId, feedKind: "WALLET_PROJECTION", severity: "CRITICAL",
          message: "Wallet locked funds do not equal reserved ledger liability.",
          expectedValue: expectedLocked.toFixed(8), actualValue: wallet.locked.toFixed(8),
        });
      }
    }

    if (!metrics) {
      cases.push(critical(userId, "ACCOUNT_METRICS", "Account metrics projection is missing."));
    } else {
      const expectedBalance = money(balances.total);
      const expectedEquity = money(expectedBalance.add(floating));
      const expectedFree = money(balances.available.add(floating));
      if (!metrics.balance.equals(expectedBalance)) {
        cases.push(critical(userId, "ACCOUNT_METRICS", "Account balance does not equal total client liability.", expectedBalance.toFixed(8), metrics.balance.toFixed(8)));
      }
      if (!metrics.margin.equals(balances.margin)) {
        cases.push(critical(userId, "ACCOUNT_METRICS", "Account margin does not equal reserved margin liability.", balances.margin.toFixed(8), metrics.margin.toFixed(8)));
      }
      if (!metrics.floatingPl.equals(floating)) {
        cases.push(critical(userId, "ACCOUNT_METRICS", "Floating P&L does not equal open-position marks.", floating.toFixed(8), metrics.floatingPl.toFixed(8)));
      }
      if (!metrics.equity.equals(expectedEquity)) {
        cases.push(critical(userId, "ACCOUNT_METRICS", "Equity does not equal balance plus floating P&L.", expectedEquity.toFixed(8), metrics.equity.toFixed(8)));
      }
      if (!metrics.free.equals(expectedFree)) {
        cases.push(critical(userId, "ACCOUNT_METRICS", "Free margin does not equal available funds plus floating P&L.", expectedFree.toFixed(8), metrics.free.toFixed(8)));
      }
    }

    if (balances.available.isNegative()) {
      cases.push(critical(userId, "USER_PROJECTION", "Available client funds liability is negative.", "0", balances.available.toFixed(8)));
    }
    if (balances.margin.isNegative()) {
      cases.push(critical(userId, "USER_PROJECTION", "Reserved margin liability is negative.", "0", balances.margin.toFixed(8)));
    }
    return cases;
  });
}

/**
 * For each CLOSED position, recompute the expected gross realized P&L from the
 * stored rates/volume/instrument and compare to the stored profit. Divergence
 * is CRITICAL and blocks trading.
 */
async function checkClosedPositions(userId: string): Promise<PendingCase[]> {
  const cases: PendingCase[] = [];
  let cursor: string | undefined;

  for (;;) {
    const positions = await prisma.position.findMany({
      where: { userId, status: "CLOSED" },
      include: { instrument: { select: { pipSize: true, pipValue: true, digits: true } } },
      orderBy: { id: "asc" },
      take: 250,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (positions.length === 0) break;

    const references = positions.flatMap((position) => [
      `MARGIN_RELEASE:${position.id}`,
      `COMMISSION:${position.id}`,
      `TRADING_PNL:${position.id}`,
      `SWAP:${position.id}`,
    ]);
    const postings = await prisma.ledgerTransaction.findMany({
      where: { reference: { in: references }, status: "POSTED" },
      select: { reference: true },
    });
    const postedReferences = new Set(postings.map((posting) => posting.reference));

    for (const position of positions) {
      const pipSize = position.instrument.pipSize;
      if (pipSize.isZero()) {
        cases.push(critical(userId, "POSITION_PNL", `Position ${position.id} has an invalid zero pip size.`));
        continue;
      }
      const entry = position.strikeRate ?? position.openRate;
      const diff = position.side === "BUY"
        ? position.currentRate.sub(entry)
        : entry.sub(position.currentRate);
      const pips = diff.div(pipSize);
      const expectedProfit = money(pips.mul(position.instrument.pipValue).mul(position.volume));
      const expectedNet = money(
        expectedProfit
          .add(position.swap)
          .sub(position.commission)
          .sub(position.tradingCommission),
      );

      if (!expectedProfit.equals(money(position.profit))) {
        cases.push({
          userId, feedKind: "POSITION_PNL", severity: "CRITICAL",
          message: `Closed position ${position.id} realized P&L diverges from rate-derived value.`,
          expectedValue: expectedProfit.toFixed(8), actualValue: position.profit.toFixed(8),
        });
      }
      if (!expectedNet.equals(money(position.netProfit))) {
        cases.push({
          userId, feedKind: "POSITION_PNL", severity: "CRITICAL",
          message: `Closed position ${position.id} net P&L is inconsistent with profit, swap, and commissions.`,
          expectedValue: expectedNet.toFixed(8), actualValue: position.netProfit.toFixed(8),
        });
      }

      const requiredReferences = [`MARGIN_RELEASE:${position.id}`];
      if (!position.commission.add(position.tradingCommission).isZero()) requiredReferences.push(`COMMISSION:${position.id}`);
      if (!position.profit.isZero()) requiredReferences.push(`TRADING_PNL:${position.id}`);
      if (!position.swap.isZero()) requiredReferences.push(`SWAP:${position.id}`);
      for (const reference of requiredReferences) {
        if (!postedReferences.has(reference)) {
          cases.push(critical(
            userId,
            "POSITION_PNL",
            `Closed position ${position.id} is missing posted ledger transaction ${reference}.`,
          ));
        }
      }
    }

    cursor = positions.at(-1)?.id;
    if (positions.length < 250) break;
  }
  return cases;
}

/** Surface APPROVED payments whose settlement did not match the bank statement. */
async function checkPayments(): Promise<PendingCase[]> {
  const cases: PendingCase[] = [];
  const staleThreshold = new Date(Date.now() - OPEN_PROJECTION_WINDOW_HOURS * 3_600_000);

  let mismatchCursor: string | undefined;
  for (;;) {
    const mismatched = await prisma.paymentRequest.findMany({
      where: { status: { in: ["APPROVED", "REVERSED"] }, reconciliationStatus: "MISMATCHED" },
      orderBy: { id: "asc" },
      take: 250,
      ...(mismatchCursor ? { cursor: { id: mismatchCursor }, skip: 1 } : {}),
      select: { id: true, userId: true, amount: true, reconciledAmount: true },
    });
    for (const request of mismatched) {
      cases.push({
        userId: request.userId, feedKind: "PAYMENT_SETTLEMENT", severity: "CRITICAL",
        message: `Payment ${request.id} settlement amount does not match the bank statement.`,
        expectedValue: request.amount.toFixed(8), actualValue: request.reconciledAmount?.toFixed(8) ?? "unset",
      });
    }
    if (mismatched.length < 250) break;
    mismatchCursor = mismatched.at(-1)?.id;
  }

  let staleCursor: string | undefined;
  for (;;) {
    const stale = await prisma.paymentRequest.findMany({
      where: {
        status: "APPROVED",
        reconciliationStatus: "PENDING",
        reviewedAt: { lt: staleThreshold },
      },
      orderBy: { id: "asc" },
      take: 250,
      ...(staleCursor ? { cursor: { id: staleCursor }, skip: 1 } : {}),
      select: { id: true, userId: true, amount: true },
    });
    for (const request of stale) {
      cases.push({
        userId: request.userId, feedKind: "PAYMENT_SETTLEMENT", severity: "WARNING",
        message: `Payment ${request.id} has not been reconciled within ${OPEN_PROJECTION_WINDOW_HOURS}h of settlement.`,
        expectedValue: request.amount.toFixed(8),
      });
    }
    if (stale.length < 250) break;
    staleCursor = stale.at(-1)?.id;
  }
  return cases;
}

function critical(
  userId: string,
  feedKind: PendingCase["feedKind"],
  message: string,
  expectedValue?: string,
  actualValue?: string,
): PendingCase {
  return { userId, feedKind, severity: "CRITICAL", message, expectedValue, actualValue };
}

/** Determine which customer actions a critical discrepancy must block. */
function scopesForCase(feedKind: PendingCase["feedKind"]): BlockScope[] {
  if (feedKind === "PAYMENT_SETTLEMENT") return ["WITHDRAW"];
  return ["TRADE", "WITHDRAW"];
}

/** Persist cases and open one block per discrepancy/scope, idempotently. */
async function persistRunResults(runId: string, cases: PendingCase[]): Promise<void> {
  await withSerializableRetry(async (tx) => {
    const created = await Promise.all(
      cases.map((pending) =>
        tx.reconciliationCase.create({
          data: {
            runId,
            userId: pending.userId,
            feedKind: pending.feedKind,
            severity: pending.severity,
            status: "OPEN",
            message: pending.message.slice(0, 500),
            expectedValue: pending.expectedValue ?? null,
            actualValue: pending.actualValue ?? null,
          },
        }),
      ),
    );

    const systemWideCritical = cases.some(
      (pending) =>
        pending.severity === "CRITICAL" &&
        !pending.userId &&
        pending.feedKind === "LEDGER_TRIAL_BALANCE",
    );
    for (let index = 0; index < cases.length; index += 1) {
      const pending = cases[index];
      const caseRow = created[index];
      if (pending.severity !== "CRITICAL") continue;

      if (pending.userId) {
        for (const scope of scopesForCase(pending.feedKind)) {
          await openBlockIdempotent(tx, {
            userId: pending.userId,
            scope,
            reason: pending.message.slice(0, 240),
            caseId: caseRow.id,
          });
        }
        continue;
      }

      if (!systemWideCritical || pending.feedKind !== "LEDGER_TRIAL_BALANCE") continue;
      let userCursor: string | undefined;
      for (;;) {
        const users = await tx.user.findMany({
          where: { isDev: false },
          select: { id: true },
          orderBy: { id: "asc" },
          take: 250,
          ...(userCursor ? { cursor: { id: userCursor }, skip: 1 } : {}),
        });
        for (const user of users) {
          for (const scope of scopesForCase(pending.feedKind)) {
            await openBlockIdempotent(tx, {
              userId: user.id,
              scope,
              reason: pending.message.slice(0, 240),
              caseId: caseRow.id,
            });
          }
        }
        if (users.length < 250) break;
        userCursor = users.at(-1)?.id;
      }
    }
  });
}

async function openBlockIdempotent(
  tx: Tx,
  input: { userId: string; scope: BlockScope; reason: string; caseId: string },
): Promise<void> {
  const existing = await tx.reconciliationBlock.findFirst({
    where: {
      userId: input.userId,
      scope: input.scope,
      caseId: input.caseId,
      releasedAt: null,
    },
    select: { id: true },
  });
  if (existing) return;
  const block = await tx.reconciliationBlock.create({
    data: {
      userId: input.userId,
      scope: input.scope,
      reason: input.reason,
      caseId: input.caseId,
    },
  });
  await appendAuditEvent(tx, {
    action: "RECONCILIATION_BLOCK_OPENED",
    entityType: "ReconciliationBlock",
    entityId: block.id,
    metadata: {
      caseId: input.caseId,
      userId: input.userId,
      scope: input.scope,
      reason: input.reason,
    },
  });
}

async function finalizeRun(runId: string, reference: string, cases: PendingCase[]): Promise<RunSummary> {
  const byFeed: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const item of cases) {
    byFeed[item.feedKind] = (byFeed[item.feedKind] ?? 0) + 1;
    bySeverity[item.severity] = (bySeverity[item.severity] ?? 0) + 1;
  }
  const usersChecked = await prisma.user.count({ where: { isDev: false } });
  const blockCount = await prisma.reconciliationBlock.count({
    where: { case: { runId } },
  });

  const updated = await withSerializableRetry(async (tx) => {
    const run = await tx.reconciliationRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        heartbeatAt: new Date(),
        usersChecked,
        caseCount: cases.length,
        blockCount,
        summary: { byFeed, bySeverity } as Prisma.InputJsonValue,
      },
    });
    await appendAuditEvent(tx, {
      actorId: run.requestedBy ?? null,
      action: "RECONCILIATION_RUN_COMPLETED",
      entityType: "ReconciliationRun",
      entityId: run.id,
      metadata: { reference, usersChecked, caseCount: cases.length, blockCount },
    });
    return run;
  });
  return toRunSummary(updated);
}

/** Return the active block for a user/scope, or null. Enforced at trade/withdraw gates. */
export async function isUserBlocked(
  userId: string,
  scope: BlockScope,
): Promise<{ id: string; reason: string; caseId: string | null } | null> {
  const block = await prisma.reconciliationBlock.findFirst({
    where: { userId, scope, releasedAt: null },
    select: { id: true, reason: true, caseId: true },
  });
  return block ?? null;
}

/** Admin release of a reconciliation block (audited). */
export async function releaseBlock(input: {
  blockId: string;
  actorId: string;
  note: string;
}): Promise<boolean> {
  const note = input.note.trim();
  if (note.length < 3) throw new Error("A release reason of at least 3 characters is required.");

  return withSerializableRetry(async (tx) => {
    const block = await tx.reconciliationBlock.findUnique({ where: { id: input.blockId } });
    if (!block || block.releasedAt) return false;
    await tx.reconciliationBlock.update({
      where: { id: block.id },
      data: { releasedAt: new Date(), releasedBy: input.actorId, releaseNote: note.slice(0, 500) },
    });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: "RECONCILIATION_BLOCK_RELEASED",
      entityType: "ReconciliationBlock",
      entityId: block.id,
      metadata: { userId: block.userId, scope: block.scope, note: note.slice(0, 240) },
    });
    return true;
  });
}

export async function acknowledgeCase(input: {
  caseId: string;
  actorId: string;
  assignee?: string;
}): Promise<boolean> {
  return withSerializableRetry(async (tx) => {
    const existing = await tx.reconciliationCase.findUnique({ where: { id: input.caseId } });
    if (!existing || existing.status === "RESOLVED") return false;
    const assignee = input.assignee?.trim().slice(0, 120) || input.actorId;
    await tx.reconciliationCase.update({
      where: { id: input.caseId },
      data: { status: "ACKNOWLEDGED", ownerAssignee: assignee, acknowledgedAt: new Date() },
    });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: "RECONCILIATION_CASE_ACKNOWLEDGED",
      entityType: "ReconciliationCase",
      entityId: input.caseId,
      metadata: { assignee },
    });
    return true;
  });
}

export async function resolveCase(input: {
  caseId: string;
  actorId: string;
  note: string;
}): Promise<boolean> {
  return withSerializableRetry(async (tx) => {
    const existing = await tx.reconciliationCase.findUnique({
      where: { id: input.caseId },
      include: { blocks: { where: { releasedAt: null }, select: { id: true } } },
    });
    if (!existing || existing.status === "RESOLVED") return false;
    if (existing.blocks.length > 0) {
      throw new Error("Release every active block linked to this case before resolving it.");
    }
    await tx.reconciliationCase.update({
      where: { id: input.caseId },
      data: {
        status: "RESOLVED",
        resolutionNote: input.note.slice(0, 1_000),
        resolvedAt: new Date(),
        acknowledgedAt: existing.acknowledgedAt ?? new Date(),
        ownerAssignee: existing.ownerAssignee ?? input.actorId,
      },
    });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: "RECONCILIATION_CASE_RESOLVED",
      entityType: "ReconciliationCase",
      entityId: input.caseId,
      metadata: { note: input.note.slice(0, 240) },
    });
    return true;
  });
}
