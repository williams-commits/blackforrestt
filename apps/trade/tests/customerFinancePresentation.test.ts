import assert from "node:assert/strict";
import test from "node:test";
import {
  customerFinanceDescription,
  customerFinanceReference,
  customerPaymentType,
  customerTransactionType,
} from "../src/lib/customerFinancePresentation.js";

test("admin balance entries use deposit and withdrawal labels by signed amount", () => {
  assert.equal(customerTransactionType("ADJUSTMENT", 25), "DEPOSIT");
  assert.equal(customerTransactionType("ADJUSTMENT", -25), "WITHDRAW");
  assert.equal(customerPaymentType("ADMIN_ADJUSTMENT", 25), "DEPOSIT");
  assert.equal(customerPaymentType("ADMIN_ADJUSTMENT", -25), "WITHDRAWAL");
  assert.equal(customerTransactionType("BONUS", 25), "BONUS");
  assert.equal(customerPaymentType("DEPOSIT", 25), "DEPOSIT");
});

test("customer history shows the reason without internal action prefixes", () => {
  const examples = [
    "Administrative balance top-up: Account correction",
    "Administrative balance deduction: Duplicate credit",
    "Administrative advance credit: Approved advance",
    "Advance credit repayment: Scheduled repayment",
  ];

  for (const description of examples) {
    assert.equal(customerFinanceDescription("ADJUSTMENT", description), description.slice(description.indexOf(":") + 1).trim());
    assert.equal(customerFinanceDescription("ADMIN_ADJUSTMENT", description), description.slice(description.indexOf(":") + 1).trim());
  }
  assert.equal(customerFinanceDescription("DEPOSIT", "Customer transfer"), "Customer transfer");
  assert.equal(customerFinanceDescription("ADJUSTMENT", null), null);
});

test("customer history replaces internal adjustment references with transaction references", () => {
  assert.equal(customerFinanceReference("ADJUSTMENT", "ADMIN-CREDIT-command-key", "transaction123"), "TXN-transaction123");
  assert.equal(customerFinanceReference("ADMIN_ADJUSTMENT", "ADMIN-CREDIT-command-key", "transaction123"), "TXN-transaction123");
  assert.equal(customerFinanceReference("DEPOSIT", "BANK-REF-123", "transaction123"), "BANK-REF-123");
});
