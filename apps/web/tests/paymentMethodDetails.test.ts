import assert from "node:assert/strict";
import test from "node:test";
import { decryptSensitiveString } from "../src/server/security/crypto.js";
import {
  paymentMethodLabel,
  preparePaymentMethodDetails,
} from "../src/server/paymentMethodDetails.js";

process.env.AUTH_SECRET ??= "payment-method-test-secret";
process.env.SECURITY_HASH_PEPPER ??= "payment-method-test-pepper";
process.env.FIELD_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");

test("deposit methods create encrypted, masked, stable metadata", () => {
  const cases = [
    preparePaymentMethodDetails("DEPOSIT", "CARD", {
      cardholderName: "Taylor Client",
      cardBrand: "VISA",
      last4: "4242",
      providerReference: "CARD-SETTLEMENT-100",
    }),
    preparePaymentMethodDetails("DEPOSIT", "BANK_TRANSFER", {
      accountName: "Taylor Client",
      institution: "Example Bank",
      country: "us",
      transferReference: "BANK-SETTLEMENT-100",
    }),
    preparePaymentMethodDetails("DEPOSIT", "CRYPTO", {
      asset: "USDT",
      network: "TRON (TRC20)",
      transactionHash: "0123456789abcdef0123456789abcdef",
      senderAddress: "TExampleSenderWallet123456789",
    }),
  ];

  for (const details of cases) {
    assert.match(details.encrypted, /^v1\./);
    assert.equal(details.fingerprint.length, 64);
    assert.ok(details.summary.length > 3);
    assert.doesNotThrow(() => JSON.parse(decryptSensitiveString(details.encrypted)));
  }
});

test("withdrawal methods require their own destination contract", () => {
  assert.throws(() => preparePaymentMethodDetails("WITHDRAWAL", "BANK_TRANSFER", {
    accountName: "Taylor Client",
    institution: "Example Bank",
    country: "US",
  }));
  // Card withdrawals identify the destination by the card's last four digits;
  // unlike the original spec, no originalDepositReference is required (the
  // withdrawal UI never collects one). The schema must still reject a card
  // withdrawal with no card identifier at all.
  assert.throws(() => preparePaymentMethodDetails("WITHDRAWAL", "CARD", {
    cardholderName: "Taylor Client",
    cardBrand: "VISA",
  }));
  assert.throws(() => preparePaymentMethodDetails("WITHDRAWAL", "CRYPTO", {
    asset: "USDT",
    network: "TRON (TRC20)",
  }));

  const bank = preparePaymentMethodDetails("WITHDRAWAL", "BANK_TRANSFER", {
    accountName: "Taylor Client",
    accountNumber: "US001234567890",
    institution: "Example Bank",
    country: "US",
    routingCode: "EXAMPLE01",
  });
  const card = preparePaymentMethodDetails("WITHDRAWAL", "CARD", {
    cardholderName: "Taylor Client",
    cardBrand: "VISA",
    last4: "4242",
    originalDepositReference: "CARD-SETTLEMENT-100",
  });
  const crypto = preparePaymentMethodDetails("WITHDRAWAL", "CRYPTO", {
    asset: "USDT",
    network: "TRON (TRC20)",
    walletAddress: "TExampleDestinationWallet123456789",
  });

  assert.match(bank.summary, /567890|7890/);
  assert.equal(card.summary, "VISA · •••• 4242");
  assert.match(crypto.summary, /USDT/);
  assert.equal(paymentMethodLabel("BANK_TRANSFER"), "Bank transfer");
});
