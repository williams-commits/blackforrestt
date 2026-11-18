import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { adjustUserBalance } from "../src/server/adminBalance.js";
import {
  approvePayment,
  listCustomerPayments,
  PaymentError,
  reversePayment,
} from "../src/server/payments.js";

const prisma = new PrismaClient();

test("admin balance actions create linked confirmed payment history exactly once", async () => {
  const suffix = randomUUID();
  const actor = await prisma.user.create({
    data: {
      email: `admin-adjustment-actor-${suffix}@example.invalid`,
      accountNo: `a${suffix.replaceAll("-", "").slice(0, 11)}`,
    },
  });
  const customer = await prisma.user.create({
    data: {
      email: `admin-adjustment-user-${suffix}@example.invalid`,
      accountNo: `u${suffix.replaceAll("-", "").slice(0, 11)}`,
    },
  });
  const actions = [
    { action: "CREDIT" as const, amount: "100", reason: "Approved balance credit" },
    { action: "DEBIT" as const, amount: "15", reason: "Correct duplicate allocation" },
    { action: "ADVANCE" as const, amount: "40", reason: "Approved advance credit" },
    { action: "REPAY_ADVANCE" as const, amount: "10", reason: "Partial advance repayment" },
  ];
  const commandKeys = actions.map(() => `admin-${randomUUID()}`);

  for (const [index, action] of actions.entries()) {
    const result = await adjustUserBalance({
      actorId: actor.id,
      userId: customer.id,
      ...action,
      commandKey: commandKeys[index],
    });
    assert.equal(result.replayed, false);
  }

  const replay = await adjustUserBalance({
    actorId: actor.id,
    userId: customer.id,
    ...actions[0],
    commandKey: commandKeys[0],
  });
  assert.equal(replay.replayed, true);

  const requests = await prisma.paymentRequest.findMany({
    where: { userId: customer.id },
    include: { transaction: true, events: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(requests.length, actions.length);
  assert.deepEqual(
    requests.map((request) => request.transaction.amount.toFixed(8)),
    ["100.00000000", "-15.00000000", "40.00000000", "-10.00000000"],
  );
  for (const [index, request] of requests.entries()) {
    assert.equal(request.type, "ADMIN_ADJUSTMENT");
    assert.equal(request.status, "APPROVED");
    assert.equal(request.reconciliationStatus, "NOT_REQUIRED");
    assert.equal(request.amount.toFixed(8), Number(actions[index].amount).toFixed(8));
    assert.equal(request.reviewedBy, actor.id);
    assert.match(request.transaction.description ?? "", new RegExp(actions[index].reason));
    assert.deepEqual(request.events.map((event) => event.type), ["CREATED", "APPROVED"]);
    assert.ok(request.events[0].createdAt < request.events[1].createdAt);
    assert.equal(
      await prisma.ledgerTransaction.count({ where: { reference: `PAYMENT_SETTLEMENT:${request.id}` } }),
      0,
    );
  }

  const history = await listCustomerPayments(customer.id);
  assert.equal(history.length, actions.length);
  assert.ok(history.every((request) => request.transaction.description?.length));
  for (const action of actions) {
    assert.ok(history.some((request) => request.transaction.description?.includes(action.reason)));
  }
  await assert.rejects(
    approvePayment({
      paymentRequestId: requests[0].id,
      actorId: actor.id,
      commandKey: `approve-${suffix}`,
      externalReference: "ADMIN-ADJUSTMENT-TEST",
    }),
    (error: unknown) => error instanceof PaymentError && error.code === "INTERNAL_ADJUSTMENT",
  );
  await assert.rejects(
    reversePayment({
      paymentRequestId: requests[0].id,
      actorId: actor.id,
      commandKey: `reverse-${suffix}`,
      note: "Admin adjustment must not use external reversal.",
    }),
    (error: unknown) => error instanceof PaymentError && error.code === "INTERNAL_ADJUSTMENT",
  );
  assert.equal(
    await prisma.ledgerTransaction.count({ where: { userId: customer.id, kind: "ADMIN_ADJUSTMENT" } }),
    actions.length,
  );
});

test.after(async () => {
  await prisma.$disconnect();
});
