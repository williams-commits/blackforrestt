import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma, resolveUserId, withSerializableRetry } from "@/server/db";
import { userMutationMutex } from "@/server/locks";
import {
  appendAuditEvent,
  money,
  postLedgerTransaction,
  refreshLedgerProjections,
  userLedgerBalances,
} from "@/server/ledger";
import { PaymentAmountSchema } from "@/server/moneyValidation";
import { PaymentError, withdrawalRiskHold } from "@/server/payments";
import {
  disabledPaymentMethods,
  paymentMethodLabel,
  preparePaymentMethodDetails,
  WithdrawalRequestSchema,
} from "@/server/paymentMethodDetails";
import { isUserBlocked } from "@/server/reconciliation";
import { hasRecentStepUp } from "@/server/security/sessions";
import { queueUserEmail } from "@/server/email/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = WithdrawalRequestSchema.extend({ amount: PaymentAmountSchema });

/** Reserve funds and create a manual withdrawal request for finance review. */
export async function POST(req: Request) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);

  if (!session?.securitySessionId || !(await hasRecentStepUp(session.securitySessionId, userId))) {
    await prisma.$transaction((tx) => appendAuditEvent(tx, {
      actorId: userId,
      action: "WITHDRAWAL_STEP_UP_REQUIRED",
      entityType: "User",
      entityId: userId,
    }));
    return NextResponse.json({ error: "Recent MFA step-up authentication is required.", code: "STEP_UP_REQUIRED" }, { status: 403 });
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid withdrawal request.", details: parsed.error.flatten() }, { status: 400 });
  }
  if (disabledPaymentMethods().has(parsed.data.method)) {
    return NextResponse.json({ error: "This payment method is not available.", code: "METHOD_DISABLED" }, { status: 400 });
  }

  let methodDetails: ReturnType<typeof preparePaymentMethodDetails>;
  try {
    methodDetails = preparePaymentMethodDetails("WITHDRAWAL", parsed.data.method, parsed.data.details);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Complete the required destination details for the selected withdrawal method.", details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  const idempotencyKey = req.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 6 || idempotencyKey.length > 128) {
    return NextResponse.json({ error: "A valid Idempotency-Key header is required." }, { status: 400 });
  }

  const reference = idempotencyKey;
  const amount = parsed.data.amount;
  const userReference = parsed.data.reference;
  const methodLabel = paymentMethodLabel(parsed.data.method);

  try {
    return await userMutationMutex.runExclusive(userId, async () => {
      const activeBlock = await isUserBlocked(userId, "WITHDRAW");
      if (activeBlock) throw new PaymentError("Withdrawals are blocked while an account discrepancy is under reconciliation review.", 403, "RECONCILIATION_BLOCK");

      const result = await withSerializableRetry(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment-request:${userId}:${reference}`}))`;
        const transactionalBlock = await tx.reconciliationBlock.findFirst({ where: { userId, scope: "WITHDRAW", releasedAt: null }, select: { id: true } });
        if (transactionalBlock) return { kind: "blocked" as const };

        const existing = await tx.transaction.findUnique({ where: { userId_reference: { userId, reference } }, include: { paymentRequest: true } });
        if (existing) {
          if (
            existing.type !== "WITHDRAW" ||
            !existing.amount.abs().equals(amount) ||
            existing.paymentRequest?.method !== parsed.data.method ||
            existing.paymentRequest?.methodDetailsFingerprint !== methodDetails.fingerprint
          ) return { kind: "conflict" as const };
          return { kind: "ok" as const, transaction: existing, paymentRequest: existing.paymentRequest, replayed: true };
        }

        const riskHoldUntil = await withdrawalRiskHold(tx, { userId, amount, beneficiaryFingerprint: methodDetails.fingerprint });
        const balances = await userLedgerBalances(tx, userId, "USD");
        const openTotals = await tx.position.aggregate({ where: { userId, status: "OPEN" }, _sum: { profit: true, swap: true } });
        const floating = money(openTotals._sum.profit ?? 0).add(openTotals._sum.swap ?? 0);
        const freeMargin = balances.available.add(floating);
        const withdrawable = balances.available.lessThan(freeMargin) ? balances.available : freeMargin;
        if (withdrawable.lessThan(amount)) return { kind: "insufficient" as const };

        const transaction = await tx.transaction.create({
          data: { userId, type: "WITHDRAW", status: "PENDING", amount: amount.neg(), asset: "USD", description: `Manual withdrawal via ${methodLabel}`, reference },
        });
        const paymentRequest = await tx.paymentRequest.create({
          data: {
            userId,
            transactionId: transaction.id,
            type: "WITHDRAWAL",
            amount,
            asset: "USD",
            method: parsed.data.method,
            userReference,
            beneficiaryEncrypted: methodDetails.encrypted,
            beneficiaryFingerprint: methodDetails.fingerprint,
            beneficiarySummary: methodDetails.summary,
            methodDetailsEncrypted: methodDetails.encrypted,
            methodDetailsFingerprint: methodDetails.fingerprint,
            methodDetailsSummary: methodDetails.summary,
            beneficiaryAvailableAt: riskHoldUntil,
            riskHoldUntil,
          },
        });
        await postLedgerTransaction(tx, {
          reference: `WITHDRAWAL_RESERVATION:${paymentRequest.id}`,
          kind: "WITHDRAWAL_RESERVATION",
          description: `Reserve funds for withdrawal ${reference}`,
          userId,
          sourceType: "PaymentRequest",
          sourceId: paymentRequest.id,
          lines: [
            { accountId: balances.accounts.available.id, direction: "DEBIT", amount, asset: "USD" },
            { accountId: balances.accounts.withdrawalPending.id, direction: "CREDIT", amount, asset: "USD" },
          ],
        });
        await refreshLedgerProjections(tx, userId, "USD");
        await tx.paymentEvent.create({
          data: { paymentRequestId: paymentRequest.id, type: "CREATED", actorId: userId, metadata: { type: "WITHDRAWAL", amount: amount.toFixed(8), asset: "USD", method: parsed.data.method, methodSummary: methodDetails.summary, riskHoldUntil: riskHoldUntil?.toISOString() ?? null } },
        });
        const title = riskHoldUntil ? "Withdrawal cooling-off period" : "Withdrawal request created";
        const body = riskHoldUntil ? "This new destination is subject to a cooling-off period before finance review." : "Your withdrawal request has been reserved for finance review.";
        await tx.notification.create({ data: { userId, type: riskHoldUntil ? "WITHDRAWAL_RISK_HOLD" : "PAYMENT_CREATED", title, body, metadata: { paymentRequestId: paymentRequest.id } } });
        await queueUserEmail(tx, {
          userId,
          template: "payment-created",
          variables: { paymentType: "Withdrawal", amount: amount.toFixed(2), asset: "USD", method: methodLabel, reference: userReference ?? reference },
        });
        await appendAuditEvent(tx, {
          actorId: userId,
          action: "PAYMENT_REQUEST_CREATED",
          entityType: "PaymentRequest",
          entityId: paymentRequest.id,
          metadata: { type: "WITHDRAWAL", amount: amount.toFixed(8), asset: "USD", method: parsed.data.method, methodSummary: methodDetails.summary, riskHoldUntil: riskHoldUntil?.toISOString() ?? null },
        });
        return { kind: "ok" as const, transaction, paymentRequest, replayed: false };
      }, { operation: `create withdrawal ${reference}` });

      if (result.kind === "conflict") return NextResponse.json({ error: "Idempotency key is already in use." }, { status: 409 });
      if (result.kind === "blocked") return NextResponse.json({ error: "Withdrawals are blocked while an account discrepancy is under reconciliation review.", code: "RECONCILIATION_BLOCK" }, { status: 403 });
      if (result.kind === "insufficient") return NextResponse.json({ error: "Insufficient withdrawable balance or free margin." }, { status: 400 });
      return NextResponse.json({ ok: true, replayed: result.replayed, transaction: result.transaction.id, paymentRequest: result.paymentRequest?.id, status: result.transaction.status, proofRequired: false }, { status: result.replayed ? 200 : 202 });
    });
  } catch (error) {
    if (error instanceof PaymentError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
}
