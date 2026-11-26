ALTER TABLE "Instrument"
  ADD COLUMN "leverageEnabled" BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE "Position"
  ADD COLUMN "appliedContractSize" DECIMAL(18,4),
  ADD COLUMN "lastQuoteToAccountRate" DECIMAL(24,12),
  ADD COLUMN "appliedPipSize" DECIMAL(18,8),
  ADD COLUMN "appliedPipValue" DECIMAL(18,8);

UPDATE "Position" AS position
SET
  "appliedPipSize" = instrument."pipSize",
  "appliedPipValue" = instrument."pipValue"
FROM "Instrument" AS instrument
WHERE position."symbol" = instrument."symbol"
  AND position."status" = 'OPEN';

UPDATE "RiskRule"
SET
  "description" = 'Class-level defaults and maximum leverage ratios. CFD exposure uses the approved instrument contract size and live quote-currency conversion.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'LEVERAGE_POLICY';
