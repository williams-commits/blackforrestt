DROP TABLE "UserLeveragePreference";

UPDATE "RiskRule"
SET
  "name" = 'Leverage default policy',
  "description" = 'Class and instrument defaults and maximum leverage ratios',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'LEVERAGE_POLICY';
