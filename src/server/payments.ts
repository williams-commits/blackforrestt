import { createHash, randomUUID } from "node:crypto";
import {
  type PaymentEventType,
  type PaymentProofStatus,
  type Prisma,
} from "@prisma/client";
import { prisma, withSerializableRetry } from "./db";
import {
  appendAuditEvent,
  ensureCashClearingAccount,
  money,
  postLedgerTransaction,
  refreshLedgerProjections,
  reverseLedgerTransaction,
  userLedgerBalances,
} from "./ledger";
import {
  deleteObject,
  headObject,
  copyPaymentProofToSealed,
  paymentProofQuarantineBucket,
  putPaymentProofQuarantineObject,
  readObjectBuffer,
} from "./storage";
import {
  encryptSensitiveString,
  hashBeneficiaryDetails,
} from "./security/crypto";
import { getScanner, type ScanStatus } from "./security/scanner";
import { queueUserEmail } from "./email/service";
import { resolveUserSettings } from "./userSettings";
import { PAYMENT_PROOF_MAX_BYTES } from "@/lib/paymentProofs";

type Tx = Prisma.TransactionClient;

/** Types a payment proof may resolve to, from magic bytes (see resolveProofMime). */
type AllowedProofMime = "image/jpeg" | "image/png" | "application/pdf";

export interface BeneficiaryDetails {
  accountName: string;
  accountNumber: string;
  institution: string;
  country: string;
  routingCode?: string;
}

export class PaymentError extends Error {
  constructor(message: string, readonly status = 400, readonly code?: string) {
    super(message);
  }
}

function paymentProofMaxBytes(): number {
  const value = Number(process.env.PAYMENT_PROOF_MAX_BYTES ?? PAYMENT_PROOF_MAX_BYTES);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : PAYMENT_PROOF_MAX_BYTES;
}

function beneficiaryCoolingOffHours(): number {
  const value = Number(process.env.PAYMENT_BENEFICIARY_COOLING_OFF_HOURS ?? 24);
  return Number.isFinite(value) && value >= 0 ? value : 24;
}

function passwordChangeCoolingOffHours(): number {
  const value = Number(process.env.PAYMENT_PASSWORD_CHANGE_COOLING_OFF_HOURS ?? 24);
  return Number.isFinite(value) && value >= 0 ? value : 24;
}

function dailyWithdrawalLimit(): Prisma.Decimal {
  const value = process.env.PAYMENT_DAILY_WITHDRAWAL_LIMIT ?? "25000";
  try {
    return money(value);
  } catch {
    return money("25000");
  }
}

function dailyWithdrawalCountLimit(): number {
  const value = Number(process.env.PAYMENT_DAILY_WITHDRAWAL_COUNT ?? 3);
  return Number.isInteger(value) && value > 0 ? value : 3;
}

function strictDualFinanceReview(): boolean {
  return (process.env.PAYMENT_REQUIRE_DUAL_FINANCE_REVIEW ?? "true").toLowerCase() !== "false";
}

/** When true, a single finance reviewer may approve a PENDING request directly,
 *  collapsing the separate Prepare step. Default: false (two-step maker-checker). */
export function simplePaymentApproval(): boolean {
  return (process.env.SIMPLE_PAYMENT_APPROVAL ?? "false").toLowerCase() === "true";
}

function detectMime(bytes: Buffer): AllowedProofMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  return null;
}

/**
 * Resolve a payment proof's type from its magic bytes — the declared MIME is
 * ignored for acceptance. Browsers derive file.type from OS registry mappings,
 * where `.jpeg` files often carry an exotic non-empty type (image/jpx,
 * vendor-specific, …) that would wrongly reject a genuine JPEG, while `.jpg`
 * maps to image/jpeg and passes. Sniffing the content removes any dependency
 * on the client's MIME reporting; finalize re-sniffs the stored object, so
 * storage tampering between receive and finalize is still blocked.
 */
function resolveProofMime(bytes: Buffer): AllowedProofMime {
  const detected = detectMime(bytes);
  if (detected) return detected;
  throw new PaymentError("Only JPEG, PNG, and PDF payment proofs are accepted.");
}

function commandFingerprint(type: PaymentEventType, payload: Record<string, string | null>): string {
  return createHash("sha256")
    .update(JSON.stringify({ type, payload: Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))) }))
    .digest("hex");
}

function assertCommandKey(commandKey: string): void {
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(commandKey)) {
    throw new PaymentError("A valid Idempotency-Key is required.", 400);
  }
}

async function replayedCommand(
  tx: Tx,
  input: {
    paymentRequestId: string;
    type: PaymentEventType;
    commandKey: string;
    payload: Record<string, string | null>;
  },
): Promise<boolean> {
  assertCommandKey(input.commandKey);
  const fingerprint = commandFingerprint(input.type, input.payload);
  const existing = await tx.paymentEvent.findUnique({
    where: {
      paymentRequestId_commandKey: {
        paymentRequestId: input.paymentRequestId,
        commandKey: input.commandKey,
      },
    },
  });
  if (!existing) return false;
  if (existing.type !== input.type || existing.commandFingerprint !== fingerprint) {
    throw new PaymentError("Idempotency key is already in use for a different payment command.", 409);
  }
  return true;
}

async function recordPaymentEvent(
  tx: Tx,
  input: {
    paymentRequestId: string;
    type: PaymentEventType;
    actorId?: string | null;
    commandKey?: string;
    payload?: Record<string, string | null>;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.paymentEvent.create({
    data: {
      paymentRequestId: input.paymentRequestId,
      type: input.type,
      actorId: input.actorId ?? null,
      commandKey: input.commandKey,
      commandFingerprint:
        input.commandKey && input.payload ? commandFingerprint(input.type, input.payload) : null,
      metadata: input.metadata,
    },
  });
}

async function notifyPaymentUser(
  tx: Tx,
  input: {
    userId: string;
    type: string;
    title: string;
    body: string;
    paymentRequestId: string;
  },
): Promise<void> {
  await tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      metadata: { paymentRequestId: input.paymentRequestId },
    },
  });
  const request = await tx.paymentRequest.findUnique({
    where: { id: input.paymentRequestId },
    select: { type: true, amount: true, asset: true, method: true, userReference: true },
  });
  const template = input.type === "PAYMENT_PREPARED" ? "payment-review"
    : input.type === "PAYMENT_APPROVED" ? "payment-approved"
      : input.type === "PAYMENT_REJECTED" ? "payment-rejected"
        : input.type === "PAYMENT_CANCELLED" ? "payment-cancelled"
          : input.type === "PAYMENT_REVERSED" ? "payment-reversed"
            : "generic-notification";
  await queueUserEmail(tx, {
    userId: input.userId,
    template,
    variables: {
      title: input.title,
      message: input.body,
      reason: input.body,
      paymentType: request?.type === "WITHDRAWAL" ? "Withdrawal" : "Deposit",
      amount: request?.amount.toFixed(2) ?? "",
      asset: request?.asset ?? "USD",
      method: request?.method ?? "",
      reference: request?.userReference ?? input.paymentRequestId,
    },
  });
}

export function prepareBeneficiary(details: BeneficiaryDetails): {
  encrypted: string;
  fingerprint: string;
  summary: string;
} {
  const normalized = {
    accountName: details.accountName.trim(),
    accountNumber: details.accountNumber.replace(/\s+/g, ""),
    institution: details.institution.trim(),
    country: details.country.trim().toUpperCase(),
    routingCode: details.routingCode?.replace(/\s+/g, "") || undefined,
  };
  const canonical = JSON.stringify(normalized);
  const lastFour = normalized.accountNumber.slice(-4).padStart(4, "•");
  return {
    encrypted: encryptSensitiveString(canonical),
    fingerprint: hashBeneficiaryDetails(canonical),
    summary: `${normalized.institution} · ••••${lastFour} · ${normalized.country}`,
  };
}

export async function withdrawalRiskHold(
  tx: Tx,
  input: {
    userId: string;
    amount: Prisma.Decimal;
    beneficiaryFingerprint: string;
    now?: Date;
  },
): Promise<Date | null> {
  const now = input.now ?? new Date();
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: { verified: true, passwordChangedAt: true },
  });
  if (!user) {
    throw new PaymentError("Account not found.", 404, "USER_NOT_FOUND");
  }
  // Per-user/group settings, falling back to the .env-derived global defaults
  // for every field (KYC requirement and withdrawal limits alike).
  const settings = await resolveUserSettings(input.userId);
  if (!user.verified && settings.withdrawals.requireKyc) {
    throw new PaymentError("Complete identity verification before withdrawing funds.", 403, "KYC_REQUIRED");
  }
  const passwordThreshold = new Date(now.getTime() - passwordChangeCoolingOffHours() * 3_600_000);
  if (user.passwordChangedAt && user.passwordChangedAt > passwordThreshold) {
    throw new PaymentError("Withdrawals are temporarily paused after a password change.", 403, "PASSWORD_CHANGE_COOLING_OFF");
  }

  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const today = await tx.paymentRequest.findMany({
    where: {
      userId: input.userId,
      type: "WITHDRAWAL",
      createdAt: { gte: dayStart },
      status: { in: ["PENDING", "AWAITING_APPROVAL", "APPROVED"] },
    },
    select: { amount: true },
  });
  const total = today.reduce((sum, request) => sum.add(request.amount), money(0));
  // A per-user/group daily limit OVERRIDES the env velocity cap; unset (null)
  // inherits the env preset.
  const effectiveDailyLimit = settings.withdrawals.dailyLimit ?? dailyWithdrawalLimit();
  if (today.length >= dailyWithdrawalCountLimit() || total.add(input.amount).greaterThan(effectiveDailyLimit)) {
    throw new PaymentError("Withdrawal velocity limit reached. Contact support if this is urgent.", 429, "WITHDRAWAL_VELOCITY_LIMIT");
  }
  // Optional per-user/group monthly cap (no env counterpart — null = no limit).
  const monthlyLimit = settings.withdrawals.monthlyLimit;
  if (monthlyLimit != null) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const month = await tx.paymentRequest.findMany({
      where: {
        userId: input.userId,
        type: "WITHDRAWAL",
        createdAt: { gte: monthStart },
        status: { in: ["PENDING", "AWAITING_APPROVAL", "APPROVED"] },
      },
      select: { amount: true },
    });
    const monthTotal = month.reduce((sum, request) => sum.add(request.amount), money(0));
    if (monthTotal.add(input.amount).greaterThan(monthlyLimit)) {
      throw new PaymentError("Monthly withdrawal limit reached. Contact support if this is urgent.", 429, "WITHDRAWAL_MONTHLY_LIMIT");
    }
  }

  const existing = await tx.paymentRequest.findFirst({
    where: {
      userId: input.userId,
      beneficiaryFingerprint: input.beneficiaryFingerprint,
      beneficiaryAvailableAt: { not: null },
    },
    orderBy: { beneficiaryAvailableAt: "asc" },
    select: { beneficiaryAvailableAt: true },
  });
  if (existing?.beneficiaryAvailableAt && existing.beneficiaryAvailableAt <= now) return null;
  if (existing?.beneficiaryAvailableAt) return existing.beneficiaryAvailableAt;
  const hours = beneficiaryCoolingOffHours();
  return hours === 0 ? null : new Date(now.getTime() + hours * 3_600_000);
}

export async function receivePaymentProof(input: {
  userId: string;
  paymentRequestId: string;
  bytes: Buffer;
}): Promise<{ proofId: string }> {
  if (input.bytes.length <= 0 || input.bytes.length > paymentProofMaxBytes()) {
    throw new PaymentError(`Payment proof size must be between 1 and ${paymentProofMaxBytes()} bytes.`);
  }
  const declaredMime = resolveProofMime(input.bytes);
  const request = await prisma.paymentRequest.findFirst({
    where: { id: input.paymentRequestId, userId: input.userId, status: "PENDING" },
    select: { id: true, type: true },
  });
  if (!request) throw new PaymentError("Payment request not found or no longer accepts proofs.", 404);

  const proofId = randomUUID();
  const storageKey = `payment-proof/${input.paymentRequestId}/${proofId}`;
  await putPaymentProofQuarantineObject({
    key: storageKey,
    contentType: declaredMime,
    bytes: input.bytes,
  });
  try {
    await withSerializableRetry(async (tx) => {
      await tx.paymentProof.create({
        data: {
          id: proofId,
          paymentRequestId: input.paymentRequestId,
          storageKey,
          bucket: paymentProofQuarantineBucket(),
          declaredMime,
          sizeBytes: input.bytes.length,
          sha256: "pending",
          uploadedBy: input.userId,
        },
      });
      await recordPaymentEvent(tx, {
        paymentRequestId: input.paymentRequestId,
        type: "PROOF_RECEIVED",
        actorId: input.userId,
        metadata: { declaredMime, sizeBytes: input.bytes.length },
      });
      await appendAuditEvent(tx, {
        actorId: input.userId,
        action: "PAYMENT_PROOF_RECEIVED",
        entityType: "PaymentProof",
        entityId: proofId,
        metadata: { paymentRequestId: input.paymentRequestId, declaredMime, sizeBytes: input.bytes.length },
      });
    });
  } catch (error) {
    await deleteObject({ key: storageKey, bucket: paymentProofQuarantineBucket() }).catch(() => undefined);
    throw error;
  }
  return { proofId };
}

export async function finalizePaymentProof(input: {
  userId: string;
  proofId: string;
}): Promise<{ proofId: string; status: PaymentProofStatus; sha256: string; detectedMime: string; sizeBytes: number }> {
  const proof = await prisma.paymentProof.findFirst({
    where: { id: input.proofId, paymentRequest: { userId: input.userId } },
    include: { paymentRequest: { select: { id: true, userId: true, type: true, amount: true, asset: true, method: true } } },
  });
  if (!proof) throw new PaymentError("Payment proof not found.", 404);
  if (proof.status !== "PENDING_SCAN") throw new PaymentError("This payment proof has already been finalized.", 409);

  let head: { sizeBytes: number };
  try {
    head = await headObject({ key: proof.storageKey, bucket: proof.bucket });
  } catch {
    throw new PaymentError("Uploaded payment proof was not found. Please upload it again.", 409);
  }
  if (head.sizeBytes !== proof.sizeBytes) {
    return blockPaymentProof(proof, "UPLOADED_SIZE_MISMATCH");
  }
  const bytes = await readObjectBuffer({ key: proof.storageKey, bucket: proof.bucket });
  const detectedMime = detectMime(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (!detectedMime || detectedMime !== proof.declaredMime) {
    return blockPaymentProof(proof, "MIME_MISMATCH", sha256, detectedMime);
  }
  const scan = await getScanner().scan({ key: proof.storageKey, sizeBytes: bytes.length, sha256, bytes });
  if (scan.status !== "CLEAN") {
    return blockPaymentProof(proof, scan.reason, sha256, detectedMime, scan.status);
  }

  const sealed = await copyPaymentProofToSealed({ key: proof.storageKey });
  await withSerializableRetry(async (tx) => {
    const updated = await tx.paymentProof.updateMany({
      where: { id: proof.id, status: "PENDING_SCAN", bucket: proof.bucket },
      data: { status: "CLEAN", detectedMime, sha256, finalizedAt: new Date(), bucket: sealed.bucket },
    });
    if (updated.count !== 1) {
      throw new PaymentError("Payment proof state changed while finalizing. Refresh and retry.", 409);
    }
    await recordPaymentEvent(tx, {
      paymentRequestId: proof.paymentRequestId,
      type: "PROOF_FINALIZED",
      actorId: input.userId,
      metadata: { proofId: proof.id, detectedMime, sizeBytes: bytes.length },
    });
    await appendAuditEvent(tx, {
      actorId: input.userId,
      action: "PAYMENT_PROOF_FINALIZED",
      entityType: "PaymentProof",
      entityId: proof.id,
      metadata: { paymentRequestId: proof.paymentRequestId, detectedMime, sizeBytes: bytes.length },
    });
    await queueUserEmail(tx, {
      userId: input.userId,
      template: "payment-proof-received",
      variables: {
        paymentType: proof.paymentRequest.type === "WITHDRAWAL" ? "Withdrawal" : "Deposit",
        amount: proof.paymentRequest.amount.toFixed(2),
        asset: proof.paymentRequest.asset,
        method: proof.paymentRequest.method,
      },
    });
  }, { operation: `finalize payment proof ${proof.id}` });
  await deleteObject({ key: proof.storageKey, bucket: proof.bucket }).catch((error) => {
    console.warn(`Unable to remove finalized payment-proof quarantine copy ${proof.id}:`, error);
  });
  return { proofId: proof.id, status: "CLEAN", sha256, detectedMime, sizeBytes: bytes.length };
}

async function blockPaymentProof(
  proof: { id: string; paymentRequestId: string; storageKey: string; bucket: string; paymentRequest: { userId: string } },
  reason: string,
  sha256 = "",
  detectedMime: string | null = null,
  status: ScanStatus = "BLOCKED",
): Promise<{ proofId: string; status: PaymentProofStatus; sha256: string; detectedMime: string; sizeBytes: number }> {
  const terminal: PaymentProofStatus = status === "QUARANTINED" ? "QUARANTINED" : "BLOCKED";
  await withSerializableRetry(async (tx) => {
    await tx.paymentProof.update({
      where: { id: proof.id },
      data: { status: terminal, sha256: sha256 || "rejected", detectedMime, finalizedAt: new Date() },
    });
    await recordPaymentEvent(tx, {
      paymentRequestId: proof.paymentRequestId,
      type: "PROOF_BLOCKED",
      actorId: proof.paymentRequest.userId,
      metadata: { proofId: proof.id, reason },
    });
    await appendAuditEvent(tx, {
      actorId: proof.paymentRequest.userId,
      action: "PAYMENT_PROOF_BLOCKED",
      entityType: "PaymentProof",
      entityId: proof.id,
      metadata: { paymentRequestId: proof.paymentRequestId, reason },
    });
  });
  await deleteObject({ key: proof.storageKey, bucket: proof.bucket }).catch(() => undefined);
  return { proofId: proof.id, status: terminal, sha256, detectedMime: detectedMime ?? "", sizeBytes: 0 };
}

export async function preparePayment(input: {
  paymentRequestId: string;
  actorId: string;
  commandKey: string;
  note?: string;
}): Promise<{ status: string; replayed: boolean }> {
  return withSerializableRetry(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment:${input.paymentRequestId}`}))`;
    const request = await tx.paymentRequest.findUnique({
      where: { id: input.paymentRequestId },
      include: { proofs: { where: { deletedAt: null }, select: { status: true } } },
    });
    if (!request) throw new PaymentError("Payment request not found.", 404);
    const payload = { note: input.note?.trim() || null };
    if (await replayedCommand(tx, { paymentRequestId: request.id, type: "PREPARED", commandKey: input.commandKey, payload })) {
      return { status: request.status, replayed: true };
    }
    if (request.userId === input.actorId) throw new PaymentError("A payment maker cannot prepare their own request.", 403);
    if (request.status !== "PENDING") throw new PaymentError(`Payment request is already ${request.status.toLowerCase()}.`, 409);
    // Proof-of-payment receipts are required for bank and crypto deposits —
    // those settle against free-form transfer references. Card deposits are
    // verified against the card processor's transaction reference instead, so
    // a receipt is optional supporting material for them.
    if (request.type === "DEPOSIT" && request.method !== "CARD" && !request.proofs.some((proof) => proof.status === "CLEAN")) {
      throw new PaymentError("A clean payment proof is required before a deposit can be prepared.", 409);
    }
    if (request.type === "WITHDRAWAL") {
      const block = await tx.reconciliationBlock.findFirst({
        where: { userId: request.userId, scope: "WITHDRAW", releasedAt: null },
        select: { id: true },
      });
      if (block) {
        throw new PaymentError(
          "Withdrawals are blocked while an account discrepancy is under reconciliation review.",
          403,
          "RECONCILIATION_BLOCK",
        );
      }
      if (!request.beneficiaryEncrypted) throw new PaymentError("Encrypted beneficiary details are required before a withdrawal can be prepared.", 409);
      if (request.riskHoldUntil && request.riskHoldUntil > new Date()) {
        throw new PaymentError("This withdrawal is in its beneficiary cooling-off period.", 409, "BENEFICIARY_COOLING_OFF");
      }
    }
    const preparedAt = new Date();
    await tx.paymentRequest.update({
      where: { id: request.id },
      data: { status: "AWAITING_APPROVAL", preparedBy: input.actorId, preparedAt, reviewerNote: input.note?.trim() || null },
    });
    await recordPaymentEvent(tx, {
      paymentRequestId: request.id,
      type: "PREPARED",
      actorId: input.actorId,
      commandKey: input.commandKey,
      payload,
      metadata: { type: request.type },
    });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: "PAYMENT_REQUEST_PREPARED",
      entityType: "PaymentRequest",
      entityId: request.id,
      metadata: { type: request.type, amount: request.amount.toFixed(8), asset: request.asset },
    });
    await notifyPaymentUser(tx, {
      userId: request.userId,
      type: "PAYMENT_PREPARED",
      title: "Payment under finance review",
      body: "Your payment request has passed initial finance review and awaits approval.",
      paymentRequestId: request.id,
    });
    return { status: "AWAITING_APPROVAL", replayed: false };
  });
}

export async function approvePayment(input: {
  paymentRequestId: string;
  actorId: string;
  commandKey: string;
  externalReference?: string;
  note?: string;
}): Promise<{ status: string; replayed: boolean }> {
  return withSerializableRetry(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment:${input.paymentRequestId}`}))`;
    const request = await tx.paymentRequest.findUnique({ where: { id: input.paymentRequestId }, include: { transaction: true } });
    if (!request) throw new PaymentError("Payment request not found.", 404);
    // In simple mode, auto-generate a unique settlement reference so the admin
    // doesn't have to invent one. This avoids the (asset, externalReference)
    // unique-constraint collision when approving many payments quickly.
    const externalReference = input.externalReference?.trim()
      || (simplePaymentApproval() ? `AUTO-${request.id.slice(-12).toUpperCase()}` : "");
    if (externalReference.length < 3) {
      throw new PaymentError("A settlement reference is required to approve this payment.", 409, "REFERENCE_REQUIRED");
    }
    const payload = { externalReference, note: input.note?.trim() || null };
    if (await replayedCommand(tx, { paymentRequestId: request.id, type: "APPROVED", commandKey: input.commandKey, payload })) {
      return { status: request.status, replayed: true };
    }
    // Maker-checker segregation applies only in strict dual-review mode. In
    // simple/single-reviewer deployments the admin is often also a customer,
    // and must be able to approve their own account's payment request.
    if (strictDualFinanceReview() && request.userId === input.actorId) {
      throw new PaymentError("A payment maker cannot approve their own request.", 403);
    }
    if (strictDualFinanceReview() && request.preparedBy === input.actorId) {
      throw new PaymentError("A second finance reviewer must approve this payment.", 403);
    }
    // Simple mode collapses Prepare→Approve: a PENDING request may be approved
    // directly by a finance reviewer. Default mode still requires AWAITING_APPROVAL.
    const approvableStatuses = simplePaymentApproval() ? ["PENDING", "AWAITING_APPROVAL"] : ["AWAITING_APPROVAL"];
    if (!approvableStatuses.includes(request.status)) {
      throw new PaymentError(`Payment request is ${request.status.toLowerCase()} and cannot be approved.`, 409);
    }
    const amount = money(request.amount);
    const cash = await ensureCashClearingAccount(tx, request.asset);
    const balances = await userLedgerBalances(tx, request.userId, request.asset);
    if (request.type === "DEPOSIT") {
      await postLedgerTransaction(tx, {
        reference: `PAYMENT_SETTLEMENT:${request.id}`,
        kind: "DEPOSIT",
        description: `Approved manual deposit ${request.transaction.reference ?? request.id}`,
        createdBy: input.actorId,
        userId: request.userId,
        sourceType: "PaymentRequest",
        sourceId: request.id,
        metadata: { externalReference },
        lines: [
          { accountId: cash.id, direction: "DEBIT", amount, asset: request.asset },
          { accountId: balances.accounts.available.id, direction: "CREDIT", amount, asset: request.asset },
        ],
      });
    } else {
      const block = await tx.reconciliationBlock.findFirst({
        where: { userId: request.userId, scope: "WITHDRAW", releasedAt: null },
        select: { id: true },
      });
      if (block) {
        throw new PaymentError(
          "Withdrawals are blocked while an account discrepancy is under reconciliation review.",
          403,
          "RECONCILIATION_BLOCK",
        );
      }
      if (balances.withdrawalPending.lessThan(amount)) throw new PaymentError("Reserved withdrawal funds are inconsistent.", 409);
      await postLedgerTransaction(tx, {
        reference: `PAYMENT_SETTLEMENT:${request.id}`,
        kind: "WITHDRAWAL",
        description: `Approved manual withdrawal ${request.transaction.reference ?? request.id}`,
        createdBy: input.actorId,
        userId: request.userId,
        sourceType: "PaymentRequest",
        sourceId: request.id,
        metadata: { externalReference },
        lines: [
          { accountId: balances.accounts.withdrawalPending.id, direction: "DEBIT", amount, asset: request.asset },
          { accountId: cash.id, direction: "CREDIT", amount, asset: request.asset },
        ],
      });
    }
    await refreshLedgerProjections(tx, request.userId, request.asset);
    const reviewedAt = new Date();
    await tx.paymentRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", externalReference, reviewerNote: input.note?.trim() || request.reviewerNote, reviewedBy: input.actorId, reviewedAt },
    });
    await tx.transaction.update({ where: { id: request.transactionId }, data: { status: "COMPLETED" } });
    await recordPaymentEvent(tx, { paymentRequestId: request.id, type: "APPROVED", actorId: input.actorId, commandKey: input.commandKey, payload, metadata: { type: request.type, externalReference } });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: "PAYMENT_REQUEST_APPROVED",
      entityType: "PaymentRequest",
      entityId: request.id,
      metadata: { type: request.type, amount: amount.toFixed(8), asset: request.asset, externalReference },
    });
    await notifyPaymentUser(tx, {
      userId: request.userId,
      type: "PAYMENT_APPROVED",
      title: `${request.type === "DEPOSIT" ? "Deposit" : "Withdrawal"} approved`,
      body: "Your payment request has been approved by finance.",
      paymentRequestId: request.id,
    });
    return { status: "APPROVED", replayed: false };
  });
}

export async function rejectPayment(input: {
  paymentRequestId: string;
  actorId: string;
  commandKey: string;
  note: string;
}): Promise<{ status: string; replayed: boolean }> {
  const note = input.note.trim();
  if (note.length < 3 || note.length > 1_000) throw new PaymentError("A payment rejection reason is required.");
  return withSerializableRetry(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment:${input.paymentRequestId}`}))`;
    const request = await tx.paymentRequest.findUnique({ where: { id: input.paymentRequestId }, include: { transaction: true } });
    if (!request) throw new PaymentError("Payment request not found.", 404);
    const payload = { note };
    if (await replayedCommand(tx, { paymentRequestId: request.id, type: "REJECTED", commandKey: input.commandKey, payload })) {
      return { status: request.status, replayed: true };
    }
    // No self-rejection block here, unlike prepare/approve: rejection moves no
    // money (a rejected withdrawal just releases the customer's own reserved
    // funds — the same outcome the customer can already trigger via cancel),
    // and admins legitimately reject their own test requests. The segregation
    // controls live on the money-moving actions.
    if (request.status !== "PENDING" && request.status !== "AWAITING_APPROVAL") {
      throw new PaymentError(`Payment request is already ${request.status.toLowerCase()}.`, 409);
    }
    if (request.type === "WITHDRAWAL") {
      await reverseLedgerTransaction(tx, {
        originalReference: `WITHDRAWAL_RESERVATION:${request.id}`,
        reversalReference: `WITHDRAWAL_REJECTION:${request.id}`,
        description: `Release funds for rejected withdrawal ${request.transaction.reference ?? request.id}`,
        createdBy: input.actorId,
        metadata: { reason: note },
      });
      await refreshLedgerProjections(tx, request.userId, request.asset);
    }
    await tx.paymentRequest.update({
      where: { id: request.id },
      data: { status: "REJECTED", reviewerNote: note, reviewedBy: input.actorId, reviewedAt: new Date() },
    });
    await tx.transaction.update({ where: { id: request.transactionId }, data: { status: "REJECTED" } });
    await recordPaymentEvent(tx, { paymentRequestId: request.id, type: "REJECTED", actorId: input.actorId, commandKey: input.commandKey, payload, metadata: { type: request.type } });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: "PAYMENT_REQUEST_REJECTED",
      entityType: "PaymentRequest",
      entityId: request.id,
      metadata: { type: request.type, amount: request.amount.toFixed(8), asset: request.asset, note },
    });
    await notifyPaymentUser(tx, {
      userId: request.userId,
      type: "PAYMENT_REJECTED",
      title: `${request.type === "DEPOSIT" ? "Deposit" : "Withdrawal"} rejected`,
      body: note,
      paymentRequestId: request.id,
    });
    return { status: "REJECTED", replayed: false };
  });
}

export async function cancelPayment(input: {
  paymentRequestId: string;
  userId: string;
  commandKey: string;
}): Promise<{ status: string; replayed: boolean }> {
  const result = await withSerializableRetry(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment:${input.paymentRequestId}`}))`;
    const request = await tx.paymentRequest.findUnique({
      where: { id: input.paymentRequestId },
      include: { transaction: true, proofs: { where: { deletedAt: null }, select: { storageKey: true, bucket: true } } },
    });
    if (!request || request.userId !== input.userId) throw new PaymentError("Payment request not found.", 404);
    const payload: Record<string, string | null> = {};
    if (await replayedCommand(tx, { paymentRequestId: request.id, type: "CANCELLED", commandKey: input.commandKey, payload })) {
      return { status: request.status, replayed: true, proofs: [] as Array<{ storageKey: string; bucket: string }> };
    }
    if (request.status !== "PENDING" && request.status !== "AWAITING_APPROVAL") {
      throw new PaymentError("Only unapproved payment requests can be cancelled.", 409);
    }
    if (request.type === "WITHDRAWAL") {
      await reverseLedgerTransaction(tx, {
        originalReference: `WITHDRAWAL_RESERVATION:${request.id}`,
        reversalReference: `WITHDRAWAL_CANCELLATION:${request.id}`,
        description: `Release funds for cancelled withdrawal ${request.transaction.reference ?? request.id}`,
        createdBy: input.userId,
        metadata: { reason: "CUSTOMER_CANCELLED" },
      });
      await refreshLedgerProjections(tx, request.userId, request.asset);
    }
    const cancelledAt = new Date();
    await tx.paymentRequest.update({ where: { id: request.id }, data: { status: "CANCELLED" } });
    await tx.transaction.update({ where: { id: request.transactionId }, data: { status: "CANCELLED" } });
    await tx.paymentProof.updateMany({ where: { paymentRequestId: request.id, deletedAt: null }, data: { deletedAt: cancelledAt } });
    await recordPaymentEvent(tx, { paymentRequestId: request.id, type: "CANCELLED", actorId: input.userId, commandKey: input.commandKey, payload, metadata: { type: request.type } });
    await appendAuditEvent(tx, {
      actorId: input.userId,
      action: "PAYMENT_REQUEST_CANCELLED",
      entityType: "PaymentRequest",
      entityId: request.id,
      metadata: { type: request.type, amount: request.amount.toFixed(8), asset: request.asset },
    });
    await notifyPaymentUser(tx, {
      userId: request.userId,
      type: "PAYMENT_CANCELLED",
      title: "Payment request cancelled",
      body: "Your payment request was cancelled before settlement.",
      paymentRequestId: request.id,
    });
    return { status: "CANCELLED", replayed: false, proofs: request.proofs };
  });
  await Promise.all(
    result.proofs.map((proof) =>
      deleteObject({ key: proof.storageKey, bucket: proof.bucket }).catch(() => undefined),
    ),
  );
  return { status: result.status, replayed: result.replayed };
}

export async function reversePayment(input: {
  paymentRequestId: string;
  actorId: string;
  commandKey: string;
  note: string;
}): Promise<{ status: string; replayed: boolean }> {
  const note = input.note.trim();
  if (note.length < 3 || note.length > 1_000) throw new PaymentError("A payment reversal reason is required.");
  return withSerializableRetry(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment:${input.paymentRequestId}`}))`;
    const request = await tx.paymentRequest.findUnique({ where: { id: input.paymentRequestId }, include: { transaction: true } });
    if (!request) throw new PaymentError("Payment request not found.", 404);
    const payload = { note };
    if (await replayedCommand(tx, { paymentRequestId: request.id, type: "REVERSED", commandKey: input.commandKey, payload })) {
      return { status: request.status, replayed: true };
    }
    if (request.userId === input.actorId || request.reviewedBy === input.actorId) {
      throw new PaymentError("A second finance reviewer must reverse this payment.", 403);
    }
    if (request.status !== "APPROVED") throw new PaymentError("Only approved payments can be reversed.", 409);
    const amount = money(request.amount);
    const balances = await userLedgerBalances(tx, request.userId, request.asset);
    if (request.type === "DEPOSIT" && balances.available.lessThan(amount)) {
      throw new PaymentError("The deposit cannot be reversed while the funds are reserved, withdrawn, or traded.", 409);
    }
    await reverseLedgerTransaction(tx, {
      originalReference: `PAYMENT_SETTLEMENT:${request.id}`,
      reversalReference: `PAYMENT_SETTLEMENT_REVERSAL:${request.id}`,
      description: `Reverse settled ${request.type.toLowerCase()} ${request.transaction.reference ?? request.id}`,
      createdBy: input.actorId,
      metadata: { reason: note },
    });
    if (request.type === "WITHDRAWAL") {
      await reverseLedgerTransaction(tx, {
        originalReference: `WITHDRAWAL_RESERVATION:${request.id}`,
        reversalReference: `WITHDRAWAL_RESERVATION_REVERSAL:${request.id}`,
        description: `Restore reversed withdrawal ${request.transaction.reference ?? request.id}`,
        createdBy: input.actorId,
        metadata: { reason: note },
      });
    }
    await refreshLedgerProjections(tx, request.userId, request.asset);
    await tx.paymentRequest.update({ where: { id: request.id }, data: { status: "REVERSED", reviewerNote: note } });
    await tx.transaction.update({ where: { id: request.transactionId }, data: { status: "REVERSED" } });
    await recordPaymentEvent(tx, { paymentRequestId: request.id, type: "REVERSED", actorId: input.actorId, commandKey: input.commandKey, payload, metadata: { type: request.type } });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: "PAYMENT_REQUEST_REVERSED",
      entityType: "PaymentRequest",
      entityId: request.id,
      metadata: { type: request.type, amount: amount.toFixed(8), asset: request.asset, note },
    });
    await notifyPaymentUser(tx, {
      userId: request.userId,
      type: "PAYMENT_REVERSED",
      title: "Payment reversed",
      body: "Finance reversed a settled payment and recorded the correction in the ledger.",
      paymentRequestId: request.id,
    });
    return { status: "REVERSED", replayed: false };
  });
}

export async function reconcilePayment(input: {
  paymentRequestId: string;
  actorId: string;
  commandKey: string;
  reconciliationReference: string;
  settledAmount: Prisma.Decimal;
  note?: string;
}): Promise<{ status: "MATCHED" | "MISMATCHED"; replayed: boolean }> {
  return withSerializableRetry(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment:${input.paymentRequestId}`}))`;
    const request = await tx.paymentRequest.findUnique({ where: { id: input.paymentRequestId } });
    if (!request) throw new PaymentError("Payment request not found.", 404);
    const payload = {
      reconciliationReference: input.reconciliationReference,
      settledAmount: input.settledAmount.toFixed(8),
      note: input.note?.trim() || null,
    };
    if (await replayedCommand(tx, { paymentRequestId: request.id, type: "RECONCILED", commandKey: input.commandKey, payload })) {
      return { status: request.reconciliationStatus === "MATCHED" ? "MATCHED" : "MISMATCHED", replayed: true };
    }
    if (request.reviewedBy === input.actorId) throw new PaymentError("A separate finance reviewer must reconcile a settled payment.", 403);
    if (request.status !== "APPROVED" && request.status !== "REVERSED") throw new PaymentError("Only settled payments can be reconciled.", 409);
    const status = money(request.amount).equals(input.settledAmount) ? "MATCHED" : "MISMATCHED";
    await tx.paymentRequest.update({
      where: { id: request.id },
      data: {
        reconciliationStatus: status,
        reconciliationReference: input.reconciliationReference,
        reconciledAmount: input.settledAmount,
        reconciledBy: input.actorId,
        reconciledAt: new Date(),
        reconciliationNote: input.note?.trim() || null,
      },
    });
    await recordPaymentEvent(tx, { paymentRequestId: request.id, type: "RECONCILED", actorId: input.actorId, commandKey: input.commandKey, payload, metadata: { status } });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: status === "MATCHED" ? "PAYMENT_RECONCILED" : "PAYMENT_RECONCILIATION_MISMATCH",
      entityType: "PaymentRequest",
      entityId: request.id,
      metadata: { settlementAmount: input.settledAmount.toFixed(8), reconciliationReference: input.reconciliationReference },
    });
    await notifyPaymentUser(tx, {
      userId: request.userId,
      type: status === "MATCHED" ? "PAYMENT_RECONCILED" : "PAYMENT_RECONCILIATION_MISMATCH",
      title: status === "MATCHED" ? "Payment reconciled" : "Payment reconciliation needs review",
      body: status === "MATCHED" ? "Finance matched your payment settlement." : "Finance found a settlement mismatch and will review it.",
      paymentRequestId: request.id,
    });
    return { status, replayed: false };
  });
}

export async function listCustomerPayments(userId: string) {
  return prisma.paymentRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      proofs: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}
