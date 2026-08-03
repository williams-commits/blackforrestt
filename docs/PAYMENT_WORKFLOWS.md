# Deposit and withdrawal workflows

## Scope

The application implements an audited, maker-checker payment-request workflow for card, bank-transfer, and cryptocurrency methods. It records customer instructions, verifies uploaded evidence, reserves or credits the internal double-entry ledger, and exposes the request to finance staff.

External movement of money remains a finance/provider operation. The application does not claim that it directly charges a card, sends a bank transfer, or broadcasts a blockchain transaction without a configured payment-provider adapter.

## Deposit methods

### Card

The customer provides:

- cardholder name
- card brand
- final four digits only
- processor transaction reference
- JPEG, PNG, or PDF receipt

The form never requests or stores the full PAN, CVV, or CVC. Finance matches the processor reference and masked card details before approval.

### Bank transfer

The customer provides:

- sender account name
- institution
- two-letter country code
- bank transfer reference
- JPEG, PNG, or PDF receipt

### Cryptocurrency

The customer provides:

- asset
- network
- transaction hash
- optional sender address
- JPEG, PNG, or PDF evidence

Finance must independently verify the network, confirmations, amount, and destination before approval.

## Withdrawal methods

### Bank transfer

The customer provides the beneficiary name, account number or IBAN, institution, country, and optional routing/SWIFT/BIC code.

### Card refund

Card withdrawals are refund requests, not arbitrary card payouts. The customer must provide a reference for an approved card deposit plus matching cardholder, brand, and final-four details. The API rejects requests that do not match an approved card deposit for that user.

### Cryptocurrency

The customer provides the asset, network, destination wallet, and optional destination tag or memo.

A supporting document may be uploaded for any withdrawal. It is optional because the primary withdrawal evidence is the destination instruction and the finance/provider settlement record.

## Upload pipeline

1. The customer creates a payment request with an idempotency key.
2. The browser uploads the proof to the same-origin API.
3. The object is written to the private quarantine bucket.
4. The server normalizes common browser MIME variants and verifies the file signature.
5. The configured scanner checks the file.
6. Clean evidence is moved to sealed private storage.
7. Audit and payment events are appended.
8. The customer receives in-app and email notifications.

Maximum upload size is controlled by `PAYMENT_PROOF_MAX_BYTES`.

## Finance workflow

1. A finance maker reviews the method details and evidence and selects **Prepare**.
2. A different finance checker confirms the external settlement and selects **Approve** with the provider/bank/blockchain reference.
3. Approval posts the internal ledger settlement and updates the customer transaction.
4. Rejection or cancellation releases reserved withdrawal funds.
5. Reversal posts compensating entries; original financial records remain immutable.
6. Reconciliation compares the internal request with the independent provider statement.

## Local verification

```bash
npm ci
npm run db:generate
npm run db:deploy
npm run test:payment-methods
npm run test:payments
npm run e2e:install
npm run e2e:test
```
