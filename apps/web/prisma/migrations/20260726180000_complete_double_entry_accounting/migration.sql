CREATE TYPE "LedgerTransactionKind" AS ENUM (
  'DEPOSIT',
  'WITHDRAWAL_RESERVATION',
  'WITHDRAWAL',
  'REVERSAL',
  'MARGIN_RESERVATION',
  'COMMISSION',
  'SWAP',
  'TRADING_PNL',
  'BONUS',
  'FEE',
  'ADMIN_ADJUSTMENT',
  'NEGATIVE_BALANCE_PROTECTION',
  'DEMO_FUNDING'
);

ALTER TABLE "LedgerTransaction"
  ADD COLUMN "fingerprint" TEXT,
  ADD COLUMN "kind" "LedgerTransactionKind",
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "sourceType" TEXT,
  ADD COLUMN "sourceId" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Position"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "requestFingerprint" TEXT;

CREATE UNIQUE INDEX "Position_userId_idempotencyKey_key" ON "Position"("userId", "idempotencyKey");

UPDATE "LedgerTransaction"
SET
  "fingerprint" = 'legacy:' || "id",
  "kind" = CASE
    WHEN "reference" LIKE 'PAYMENT:%' AND "description" ILIKE '%withdrawal%'
      THEN 'WITHDRAWAL'::"LedgerTransactionKind"
    WHEN "reference" LIKE 'PAYMENT:%'
      THEN 'DEPOSIT'::"LedgerTransactionKind"
    ELSE 'ADMIN_ADJUSTMENT'::"LedgerTransactionKind"
  END;

ALTER TABLE "LedgerTransaction"
  ALTER COLUMN "fingerprint" SET NOT NULL,
  ALTER COLUMN "kind" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

CREATE UNIQUE INDEX "LedgerTransaction_fingerprint_key" ON "LedgerTransaction"("fingerprint");
CREATE INDEX "LedgerTransaction_userId_effectiveAt_idx" ON "LedgerTransaction"("userId", "effectiveAt");
CREATE INDEX "LedgerTransaction_sourceType_sourceId_idx" ON "LedgerTransaction"("sourceType", "sourceId");
CREATE UNIQUE INDEX "LedgerEntry_transactionId_accountId_key" ON "LedgerEntry"("transactionId", "accountId");
CREATE UNIQUE INDEX "PaymentRequest_asset_externalReference_key" ON "PaymentRequest"("asset", "externalReference");

ALTER TABLE "LedgerTransaction"
  ADD CONSTRAINT "LedgerTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_amount_positive" CHECK ("amount" > 0);

-- Convert pre-ledger wallet state into explicit migration adjustments. Existing
-- payment ledger balances are preserved; only the delta needed to reproduce
-- each cached wallet bucket is posted.
CREATE TEMP TABLE phase1_projection_targets AS
WITH pending_withdrawals AS (
  SELECT "userId", "asset", COALESCE(SUM("amount"), 0)::DECIMAL(36,8) AS amount
  FROM "PaymentRequest"
  WHERE "type" = 'WITHDRAWAL' AND "status" = 'PENDING'
  GROUP BY "userId", "asset"
)
SELECT wallet."userId", wallet."asset", 'AVAILABLE'::TEXT AS bucket, wallet."free" AS target
FROM "Wallet" wallet
UNION ALL
SELECT
  wallet."userId",
  wallet."asset",
  'MARGIN'::TEXT,
  GREATEST(wallet."locked" - COALESCE(pending.amount, 0), 0)::DECIMAL(36,8)
FROM "Wallet" wallet
LEFT JOIN pending_withdrawals pending
  ON pending."userId" = wallet."userId" AND pending."asset" = wallet."asset"
UNION ALL
SELECT
  wallet."userId",
  wallet."asset",
  'WITHDRAWAL_PENDING'::TEXT,
  COALESCE(pending.amount, 0)::DECIMAL(36,8)
FROM "Wallet" wallet
LEFT JOIN pending_withdrawals pending
  ON pending."userId" = wallet."userId" AND pending."asset" = wallet."asset";

INSERT INTO "LedgerAccount" ("id", "code", "name", "type", "asset", "userId", "createdAt")
SELECT
  md5('phase1-account:' || target."userId" || ':' || target.bucket || ':' || target."asset"),
  CASE
    WHEN target.bucket = 'AVAILABLE'
      THEN 'USER:' || target."userId" || ':CLIENT_FUNDS:' || target."asset"
    ELSE 'USER:' || target."userId" || ':' || target.bucket || ':' || target."asset"
  END,
  target."asset" || ' migrated ' || lower(target.bucket) || ' liability',
  'LIABILITY'::"LedgerAccountType",
  target."asset",
  target."userId",
  CURRENT_TIMESTAMP
FROM phase1_projection_targets target
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "LedgerAccount" ("id", "code", "name", "type", "asset", "createdAt")
SELECT
  md5('phase1-adjustment:' || target."asset"),
  'SYSTEM:ADJUSTMENT_EQUITY:' || target."asset",
  target."asset" || ' migration adjustment clearing',
  'EQUITY'::"LedgerAccountType",
  target."asset",
  CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "asset" FROM phase1_projection_targets) target
ON CONFLICT ("code") DO NOTHING;

CREATE TEMP TABLE phase1_projection_deltas AS
SELECT
  target."userId",
  target."asset",
  target.bucket,
  target.target,
  target.target - COALESCE(SUM(
    CASE entry."direction"
      WHEN 'CREDIT' THEN entry."amount"
      ELSE -entry."amount"
    END
  ) FILTER (WHERE transaction."status" = 'POSTED'), 0) AS delta,
  user_account."id" AS user_account_id,
  adjustment_account."id" AS adjustment_account_id,
  md5('phase1-transaction:' || target."userId" || ':' || target.bucket || ':' || target."asset") AS transaction_id
FROM phase1_projection_targets target
JOIN "LedgerAccount" user_account
  ON user_account."code" = CASE
    WHEN target.bucket = 'AVAILABLE'
      THEN 'USER:' || target."userId" || ':CLIENT_FUNDS:' || target."asset"
    ELSE 'USER:' || target."userId" || ':' || target.bucket || ':' || target."asset"
  END
JOIN "LedgerAccount" adjustment_account
  ON adjustment_account."code" = 'SYSTEM:ADJUSTMENT_EQUITY:' || target."asset"
LEFT JOIN "LedgerEntry" entry ON entry."accountId" = user_account."id"
LEFT JOIN "LedgerTransaction" transaction ON transaction."id" = entry."transactionId"
GROUP BY
  target."userId",
  target."asset",
  target.bucket,
  target.target,
  user_account."id",
  adjustment_account."id";

INSERT INTO "LedgerTransaction" (
  "id",
  "reference",
  "fingerprint",
  "kind",
  "description",
  "status",
  "userId",
  "sourceType",
  "sourceId",
  "effectiveAt",
  "createdAt"
)
SELECT
  delta.transaction_id,
  'MIGRATION:PHASE1:' || delta."userId" || ':' || delta.bucket || ':' || delta."asset",
  'migration:' || delta.transaction_id,
  'ADMIN_ADJUSTMENT'::"LedgerTransactionKind",
  'Phase 1 opening projection balance',
  'POSTED'::"LedgerTransactionStatus",
  delta."userId",
  'Migration',
  '20260726180000_complete_double_entry_accounting',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM phase1_projection_deltas delta
WHERE delta.delta <> 0;

INSERT INTO "LedgerEntry" (
  "id",
  "transactionId",
  "accountId",
  "direction",
  "amount",
  "asset",
  "createdAt"
)
SELECT
  md5(delta.transaction_id || ':user'),
  delta.transaction_id,
  delta.user_account_id,
  CASE WHEN delta.delta > 0 THEN 'CREDIT' ELSE 'DEBIT' END::"LedgerDirection",
  ABS(delta.delta),
  delta."asset",
  CURRENT_TIMESTAMP
FROM phase1_projection_deltas delta
WHERE delta.delta <> 0
UNION ALL
SELECT
  md5(delta.transaction_id || ':contra'),
  delta.transaction_id,
  delta.adjustment_account_id,
  CASE WHEN delta.delta > 0 THEN 'DEBIT' ELSE 'CREDIT' END::"LedgerDirection",
  ABS(delta.delta),
  delta."asset",
  CURRENT_TIMESTAMP
FROM phase1_projection_deltas delta
WHERE delta.delta <> 0;

DROP TRIGGER IF EXISTS ledger_entry_immutable ON "LedgerEntry";

CREATE OR REPLACE FUNCTION assert_ledger_transaction_balanced(transaction_id TEXT)
RETURNS void AS $$
BEGIN
  IF (SELECT COUNT(*) FROM "LedgerEntry" WHERE "transactionId" = transaction_id) < 2 THEN
    RAISE EXCEPTION 'ledger transaction % requires at least two entries', transaction_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "LedgerEntry" entry
    JOIN "LedgerAccount" account ON account."id" = entry."accountId"
    WHERE entry."transactionId" = transaction_id
      AND account."asset" <> entry."asset"
  ) THEN
    RAISE EXCEPTION 'ledger transaction % contains an account/asset mismatch', transaction_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "LedgerEntry"
    WHERE "transactionId" = transaction_id
    GROUP BY "asset"
    HAVING
      COALESCE(SUM("amount") FILTER (WHERE "direction" = 'DEBIT'), 0) <>
      COALESCE(SUM("amount") FILTER (WHERE "direction" = 'CREDIT'), 0)
  ) THEN
    RAISE EXCEPTION 'ledger transaction % is not balanced per asset', transaction_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION guard_ledger_transaction_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'LedgerTransaction is immutable; append a compensating reversal';
  END IF;

  IF OLD."status" = 'DRAFT'
     AND NEW."status" = 'POSTED'
     AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN
    PERFORM assert_ledger_transaction_balanced(OLD."id");
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'LedgerTransaction is immutable after creation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_transaction_immutable
BEFORE UPDATE OR DELETE ON "LedgerTransaction"
FOR EACH ROW EXECUTE FUNCTION guard_ledger_transaction_mutation();

CREATE OR REPLACE FUNCTION guard_ledger_entry_mutation()
RETURNS trigger AS $$
DECLARE
  parent_status "LedgerTransactionStatus";
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'LedgerEntry is immutable; append a compensating reversal';
  END IF;

  SELECT "status" INTO parent_status
  FROM "LedgerTransaction"
  WHERE "id" = NEW."transactionId";

  IF parent_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'entries can only be added to a draft ledger transaction';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entry_immutable
BEFORE INSERT OR UPDATE OR DELETE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION guard_ledger_entry_mutation();

CREATE OR REPLACE FUNCTION guard_wallet_projection_write()
RETURNS trigger AS $$
BEGIN
  IF COALESCE(current_setting('app.ledger_projection_write', true), '') <> '1' THEN
    RAISE EXCEPTION 'Wallet is a ledger-derived projection';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_projection_only
BEFORE INSERT OR UPDATE OR DELETE ON "Wallet"
FOR EACH ROW EXECUTE FUNCTION guard_wallet_projection_write();

CREATE OR REPLACE FUNCTION guard_account_metrics_base_write()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(current_setting('app.ledger_projection_write', true), '') <> '1' THEN
      RAISE EXCEPTION 'AccountMetrics base values are ledger-derived';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW."balance" IS DISTINCT FROM OLD."balance"
     OR NEW."credit" IS DISTINCT FROM OLD."credit" THEN
    IF COALESCE(current_setting('app.ledger_projection_write', true), '') <> '1' THEN
      RAISE EXCEPTION 'AccountMetrics base values are ledger-derived';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER account_metrics_ledger_base
BEFORE INSERT OR UPDATE OR DELETE ON "AccountMetrics"
FOR EACH ROW EXECUTE FUNCTION guard_account_metrics_base_write();
