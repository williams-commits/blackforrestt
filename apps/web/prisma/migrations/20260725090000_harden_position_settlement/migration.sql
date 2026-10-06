-- Persist swap accrual cursor and close reason for restart-safe, auditable settlement.
ALTER TABLE "Position"
  ADD COLUMN "swapAccruedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "closeReason" TEXT;

-- Add explicit trade settlement transactions.
ALTER TYPE "TxnType" ADD VALUE IF NOT EXISTS 'TRADE_PNL';

CREATE INDEX "Transaction_userId_type_createdAt_idx"
  ON "Transaction"("userId", "type", "createdAt");

-- Older seeds could insert the same non-null reference more than once. Keep the
-- newest row so the idempotency constraint can be applied to existing data.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "reference"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS row_number
  FROM "Transaction"
  WHERE "reference" IS NOT NULL
)
DELETE FROM "Transaction"
WHERE "id" IN (SELECT "id" FROM ranked WHERE row_number > 1);

CREATE UNIQUE INDEX "Transaction_userId_reference_key"
  ON "Transaction"("userId", "reference");
