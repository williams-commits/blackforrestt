UPDATE "RiskRule"
SET
  "configuration" = jsonb_set("configuration", '{maxAgeMs}', '60000'::jsonb),
  "version" = "version" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'STALE_QUOTE_BLOCK'
  AND "configuration"->>'maxAgeMs' = '15000';
