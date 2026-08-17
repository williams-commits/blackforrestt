import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  approvePayment,
  cancelPayment,
  finalizePaymentProof,
  prepareBeneficiary,
  preparePayment,
  receivePaymentProof,
  reconcilePayment,
  rejectPayment,
  reversePayment,
} from "../src/server/payments.js";
import {
  ensureSystemAccount,
  ensureUserLedgerAccount,
  money,
  postLedgerTransaction,
  refreshLedgerProjections,
  verifyUserAccountingProjection,
} from "../src/server/ledger.js";
import { closeStorage, deleteObject } from "../src/server/storage.js";
import { PAYMENT_PROOF_MAX_BYTES } from "../src/lib/paymentProofs.js";

const prisma = new PrismaClient();
const PDF_FIXTURE = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(96, 0x41)]);

process.env.PAYMENT_BENEFICIARY_COOLING_OFF_HOURS = "0";
process.env.PAYMENT_PASSWORD_CHANGE_COOLING_OFF_HOURS = "0";
process.env.PAYMENT_DAILY_WITHDRAWAL_LIMIT = "1000000";
process.env.PAYMENT_DAILY_WITHDRAWAL_COUNT = "100";

async function createUser(label: string, verified = true) {
  const suffix = randomUUID();
  return prisma.user.create({
    data: {
      email: `${label}-${suffix}@example.invalid`,
      accountNo: suffix.replaceAll("-", "").slice(0, 12),
      verified,
      emailVerifiedAt: new Date(),
      isAdmin: label.startsWith("finance"),
    },
  });
}

async function createDepositRequest(userId: string, amount = "50") {
  const suffix = randomUUID();
  const transaction = await prisma.transaction.create({
    data: {
      userId,
      type: "DEPOSIT",
      status: "PENDING",
      amount: money(amount),
      asset: "USD",
      description: "Integration test deposit",
      reference: `TEST-DEPOSIT-${suffix}`,
    },
  });
  return prisma.paymentRequest.create({
    data: {
      userId,
      transactionId: transaction.id,
      type: "DEPOSIT",
      amount: money(amount),
      asset: "USD",
      method: "Bank transfer",
    },
  });
}

async function createWithdrawalRequest(userId: string, amount = "50") {
  const suffix = randomUUID();
  const beneficiary = prepareBeneficiary({
    accountName: "Test Recipient",
    accountNumber: `US${suffix.replaceAll("-", "").slice(0, 20)}`,
    institution: "Test Bank",
    country: "US",
    routingCode: "TESTUS01",
  });
  return prisma.$transaction(async (tx) => {
    const available = await ensureUserLedgerAccount(tx, userId, "AVAILABLE");
    const funding = await ensureSystemAccount(tx, "DEMO_FUNDING_EXPENSE");
    const requested = money(amount);
    await postLedgerTransaction(tx, {
      reference: `TEST-WITHDRAWAL-FUNDING-${suffix}`,
      kind: "DEMO_FUNDING",
      description: "Integration test withdrawal funding",
      userId,
      lines: [
        { accountId: funding.id, direction: "DEBIT", amount: money("100"), asset: "USD" },
        { accountId: available.id, direction: "CREDIT", amount: money("100"), asset: "USD" },
      ],
    });
    const transaction = await tx.transaction.create({
      data: {
        userId,
        type: "WITHDRAW",
        status: "PENDING",
        amount: requested.neg(),
        asset: "USD",
        description: "Integration test withdrawal",
        reference: `TEST-WITHDRAWAL-${suffix}`,
      },
    });
    const request = await tx.paymentRequest.create({
      data: {
        userId,
        transactionId: transaction.id,
        type: "WITHDRAWAL",
        amount: requested,
        asset: "USD",
        method: "Bank transfer",
        beneficiaryEncrypted: beneficiary.encrypted,
        beneficiaryFingerprint: beneficiary.fingerprint,
        beneficiarySummary: beneficiary.summary,
      },
    });
    const pending = await ensureUserLedgerAccount(tx, userId, "WITHDRAWAL_PENDING");
    await postLedgerTransaction(tx, {
      reference: `WITHDRAWAL_RESERVATION:${request.id}`,
      kind: "WITHDRAWAL_RESERVATION",
      description: "Integration test withdrawal reservation",
      userId,
      lines: [
        { accountId: available.id, direction: "DEBIT", amount: requested, asset: "USD" },
        { accountId: pending.id, direction: "CREDIT", amount: requested, asset: "USD" },
      ],
    });
    await refreshLedgerProjections(tx, userId);
    return request;
  }, { isolationLevel: "Serializable" });
}

async function cleanProof(paymentRequestId: string, userId: string) {
  const proof = await receivePaymentProof({
    userId,
    paymentRequestId,
    declaredMime: "application/pdf",
    bytes: PDF_FIXTURE,
  });
  const finalized = await finalizePaymentProof({ userId, proofId: proof.proofId });
  assert.equal(finalized.status, "CLEAN");
  return proof.proofId;
}

test("clean proof, maker-checker approval, and ledger settlement are atomic", async () => {
  const customer = await createUser("payment-customer");
  const maker = await createUser("finance-maker");
  const checker = await createUser("finance-checker");
  const request = await createDepositRequest(customer.id);
  await cleanProof(request.id, customer.id);

  const prepared = await preparePayment({ paymentRequestId: request.id, actorId: maker.id, commandKey: randomUUID() });
  assert.equal(prepared.status, "AWAITING_APPROVAL");
  await assert.rejects(
    approvePayment({ paymentRequestId: request.id, actorId: maker.id, commandKey: randomUUID(), externalReference: `BANK-${randomUUID()}` }),
  );
  const approved = await approvePayment({ paymentRequestId: request.id, actorId: checker.id, commandKey: randomUUID(), externalReference: `BANK-${randomUUID()}` });
  assert.equal(approved.status, "APPROVED");

  const invariant = await verifyUserAccountingProjection(customer.id);
  assert.equal(invariant.valid, true, invariant.violations.join(", "));
  assert.equal(invariant.balances.available.toFixed(8), "50.00000000");
  const stored = await prisma.paymentRequest.findUniqueOrThrow({ where: { id: request.id }, include: { proofs: true, events: true } });
  assert.equal(stored.status, "APPROVED");
  assert.equal(stored.proofs[0]?.status, "CLEAN");
  assert.ok(stored.events.some((event) => event.type === "PREPARED"));
  assert.ok(stored.events.some((event) => event.type === "APPROVED"));
});

test("external references are unique and rejected commands do not post money", async () => {
  const customer = await createUser("payment-ref-customer");
  const maker = await createUser("finance-maker");
  const checker = await createUser("finance-checker");
  const first = await createDepositRequest(customer.id, "10");
  const second = await createDepositRequest(customer.id, "11");
  await Promise.all([cleanProof(first.id, customer.id), cleanProof(second.id, customer.id)]);
  await preparePayment({ paymentRequestId: first.id, actorId: maker.id, commandKey: randomUUID() });
  await preparePayment({ paymentRequestId: second.id, actorId: maker.id, commandKey: randomUUID() });
  const reference = `UNIQUE-${randomUUID()}`;
  await approvePayment({ paymentRequestId: first.id, actorId: checker.id, commandKey: randomUUID(), externalReference: reference });
  await assert.rejects(
    approvePayment({ paymentRequestId: second.id, actorId: checker.id, commandKey: randomUUID(), externalReference: reference }),
  );
  const stored = await prisma.paymentRequest.findUniqueOrThrow({ where: { id: second.id } });
  assert.equal(stored.status, "AWAITING_APPROVAL");
});

test("customer cancellation reverses a withdrawal reservation exactly and replays safely", async () => {
  const customer = await createUser("payment-cancel-customer");
  const request = await createWithdrawalRequest(customer.id, "40");
  const commandKey = randomUUID();
  const cancelled = await cancelPayment({ paymentRequestId: request.id, userId: customer.id, commandKey });
  assert.equal(cancelled.status, "CANCELLED");
  const replay = await cancelPayment({ paymentRequestId: request.id, userId: customer.id, commandKey });
  assert.equal(replay.replayed, true);
  const invariant = await verifyUserAccountingProjection(customer.id);
  assert.equal(invariant.valid, true, invariant.violations.join(", "));
  assert.equal(invariant.balances.available.toFixed(8), "100.00000000");
  assert.equal(invariant.balances.withdrawalPending.toFixed(8), "0.00000000");
});

test("a finance correction uses compensating ledger reversals and preserves the original settlement", async () => {
  const customer = await createUser("payment-reversal-customer");
  const maker = await createUser("finance-maker");
  const checker = await createUser("finance-checker");
  const reverser = await createUser("finance-reverser");
  const request = await createDepositRequest(customer.id, "25");
  await cleanProof(request.id, customer.id);
  await preparePayment({ paymentRequestId: request.id, actorId: maker.id, commandKey: randomUUID() });
  await approvePayment({ paymentRequestId: request.id, actorId: checker.id, commandKey: randomUUID(), externalReference: `REV-${randomUUID()}` });
  const reversed = await reversePayment({ paymentRequestId: request.id, actorId: reverser.id, commandKey: randomUUID(), note: "Bank settlement was returned." });
  assert.equal(reversed.status, "REVERSED");
  const postings = await prisma.ledgerTransaction.findMany({ where: { reference: { in: [`PAYMENT_SETTLEMENT:${request.id}`, `PAYMENT_SETTLEMENT_REVERSAL:${request.id}`] } }, include: { entries: true } });
  assert.equal(postings.length, 2);
  assert.equal(postings[0].entries.length, 2);
  const invariant = await verifyUserAccountingProjection(customer.id);
  assert.equal(invariant.valid, true, invariant.violations.join(", "));
  assert.equal(invariant.balances.available.toFixed(8), "0.00000000");
});

test("separate finance reconciliation records a mismatch without a balance mutation", async () => {
  const customer = await createUser("payment-reconcile-customer");
  const maker = await createUser("finance-maker");
  const checker = await createUser("finance-checker");
  const reconciler = await createUser("finance-reconciler");
  const request = await createDepositRequest(customer.id, "75");
  await cleanProof(request.id, customer.id);
  await preparePayment({ paymentRequestId: request.id, actorId: maker.id, commandKey: randomUUID() });
  await approvePayment({ paymentRequestId: request.id, actorId: checker.id, commandKey: randomUUID(), externalReference: `MATCH-${randomUUID()}` });
  const result = await reconcilePayment({
    paymentRequestId: request.id,
    actorId: reconciler.id,
    commandKey: randomUUID(),
    reconciliationReference: `STATEMENT-${randomUUID()}`,
    settledAmount: money("74.99"),
    note: "Bank statement amount differs by one cent.",
  });
  assert.equal(result.status, "MISMATCHED");
  const stored = await prisma.paymentRequest.findUniqueOrThrow({ where: { id: request.id } });
  assert.equal(stored.reconciliationStatus, "MISMATCHED");
  const invariant = await verifyUserAccountingProjection(customer.id);
  assert.equal(invariant.valid, true, invariant.violations.join(", "));
  assert.equal(invariant.balances.available.toFixed(8), "75.00000000");
});

test("finance can reject a prepared withdrawal and release its reserved funds", async () => {
  const customer = await createUser("payment-reject-customer");
  const finance = await createUser("finance-rejector");
  const request = await createWithdrawalRequest(customer.id, "30");
  await preparePayment({ paymentRequestId: request.id, actorId: finance.id, commandKey: randomUUID() });
  const rejected = await rejectPayment({ paymentRequestId: request.id, actorId: finance.id, commandKey: randomUUID(), note: "Beneficiary verification did not pass." });
  assert.equal(rejected.status, "REJECTED");
  const invariant = await verifyUserAccountingProjection(customer.id);
  assert.equal(invariant.valid, true, invariant.violations.join(", "));
  assert.equal(invariant.balances.available.toFixed(8), "100.00000000");
});

test("payment proofs above the configured size cap are rejected before storage", async () => {
  const customer = await createUser("payment-oversize-customer");
  const request = await createDepositRequest(customer.id);
  const oversized = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(PAYMENT_PROOF_MAX_BYTES, 0x41)]);
  await assert.rejects(
    receivePaymentProof({ userId: customer.id, paymentRequestId: request.id, declaredMime: "application/pdf", bytes: oversized }),
    /size must be between/,
  );
});

test.after(async () => {
  const proofs = await prisma.paymentProof.findMany({ select: { storageKey: true, bucket: true } });
  await Promise.all(proofs.map((proof) => deleteObject({ key: proof.storageKey, bucket: proof.bucket }).catch(() => undefined)));
  await closeStorage();
  await prisma.$disconnect();
});
