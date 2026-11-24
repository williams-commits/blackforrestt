ALTER TABLE "Instrument"
  ADD COLUMN "leverageNotionalFactor" DECIMAL(24,12),
  ADD COLUMN "leverageDefault" DECIMAL(12,4),
  ADD COLUMN "leverageMax" DECIMAL(12,4);

ALTER TABLE "Position"
  ADD COLUMN "marginUsed" DECIMAL(24,8) NOT NULL DEFAULT 0,
  ADD COLUMN "appliedLeverage" DECIMAL(12,4);

UPDATE "Position" AS position
SET "marginUsed" = position."volume" * instrument."marginPerLot"
FROM "Instrument" AS instrument
WHERE position."symbol" = instrument."symbol"
  AND position."status" = 'OPEN';

CREATE TABLE "UserLeveragePreference" (
  "userId" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "leverage" DECIMAL(12,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserLeveragePreference_pkey" PRIMARY KEY ("userId", "scopeKey"),
  CONSTRAINT "UserLeveragePreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "RiskRule" (
  "id", "code", "name", "description", "severity", "enabled", "configuration",
  "version", "createdAt", "updatedAt"
) VALUES (
  'leverage-policy-default',
  'LEVERAGE_POLICY',
  'User-selectable leverage',
  'Class-level default and maximum leverage ratios. An asset remains on legacy margin until its notional factor has been verified and approved.',
  'INFO',
  TRUE,
  '{
    "defaults": {
      "FOREX": "1",
      "CRYPTO": "1",
      "COMMODITY": "1",
      "INDEX": "1",
      "STOCK": "1"
    },
    "maximums": {
      "FOREX": "100",
      "CRYPTO": "100",
      "COMMODITY": "25",
      "INDEX": "25",
      "STOCK": "100"
    }
  }'::jsonb,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
