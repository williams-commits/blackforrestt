UPDATE "RiskRule"
SET
  "configuration" = jsonb_set("configuration", '{maxAgeMs}', '300000'::jsonb),
  "version" = "version" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'STALE_QUOTE_BLOCK'
  AND "configuration"->>'maxAgeMs' = '60000';
