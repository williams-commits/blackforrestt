INSERT INTO "Instrument" (
  "symbol", "name", "category", "base", "quote", "digits", "pipSize",
  "pipValue", "contractSize", "marginPerLot", "swapLongPips",
  "swapShortPips", "commissionPerLot", "basePrice", "feedSymbol",
  "active", "createdAt", "updatedAt"
) VALUES
  ('BNBUSD', 'BNB vs US Dollar', 'CRYPTO', 'BNB', 'USD', 2, 0.01, 1, 1, 1000, 5, 2.5, 7, 549.50, 'BINANCE:BNBUSDT', TRUE, NOW(), NOW()),
  ('TRXUSD', 'TRON vs US Dollar', 'CRYPTO', 'TRX', 'USD', 6, 0.000001, 1, 1, 1000, 5, 2.5, 7, 0.307608, 'BINANCE:TRXUSDT', TRUE, NOW(), NOW()),
  ('TONUSD', 'Toncoin vs US Dollar', 'CRYPTO', 'TON', 'USD', 4, 0.0001, 1, 1, 1000, 5, 2.5, 7, 1.6000, 'BINANCE:TONUSDT', TRUE, NOW(), NOW()),
  ('SHIBUSD', 'Shiba Inu vs US Dollar', 'CRYPTO', 'SHIB', 'USD', 8, 0.00000001, 1, 1, 1000, 5, 2.5, 7, 0.00000356, 'BINANCE:SHIBUSDT', TRUE, NOW(), NOW()),
  ('XLMUSD', 'Stellar Lumens vs US Dollar', 'CRYPTO', 'XLM', 'USD', 6, 0.000001, 1, 1, 1000, 5, 2.5, 7, 0.124838, 'BINANCE:XLMUSDT', TRUE, NOW(), NOW()),
  ('ETCUSD', 'Ethereum Classic vs US Dollar', 'CRYPTO', 'ETC', 'USD', 3, 0.001, 1, 1, 1000, 5, 2.5, 7, 5.790, 'BINANCE:ETCUSDT', TRUE, NOW(), NOW()),
  ('FILUSD', 'Filecoin vs US Dollar', 'CRYPTO', 'FIL', 'USD', 6, 0.000001, 1, 1, 1000, 5, 2.5, 7, 0.543001, 'BINANCE:FILUSDT', TRUE, NOW(), NOW()),
  ('ICPUSD', 'Internet Computer vs US Dollar', 'CRYPTO', 'ICP', 'USD', 4, 0.0001, 1, 1, 1000, 5, 2.5, 7, 2.0300, 'BINANCE:ICPUSDT', TRUE, NOW(), NOW()),
  ('NEARUSD', 'NEAR Protocol vs US Dollar', 'CRYPTO', 'NEAR', 'USD', 4, 0.0001, 1, 1, 1000, 5, 2.5, 7, 2.8800, 'BINANCE:NEARUSDT', TRUE, NOW(), NOW()),
  ('APTUSD', 'Aptos vs US Dollar', 'CRYPTO', 'APT', 'USD', 6, 0.000001, 1, 1, 1000, 5, 2.5, 7, 0.373017, 'BINANCE:APTUSDT', TRUE, NOW(), NOW()),
  ('SUIUSD', 'Sui vs US Dollar', 'CRYPTO', 'SUI', 'USD', 6, 0.000001, 1, 1, 1000, 5, 2.5, 7, 0.650045, 'BINANCE:SUIUSDT', TRUE, NOW(), NOW()),
  ('AAVEUSD', 'Aave vs US Dollar', 'CRYPTO', 'AAVE', 'USD', 2, 0.01, 1, 1, 1000, 5, 2.5, 7, 94.42, 'BINANCE:AAVEUSDT', TRUE, NOW(), NOW()),
  ('US2000', 'US Russell 2000 Index', 'INDEX', 'US2000', 'USD', 1, 0.1, 25, 1, 1000, 1.5, 0.5, 7, 2500.0, 'OANDA:US2000_USD', TRUE, NOW(), NOW()),
  ('VIX', 'CBOE Volatility Index', 'INDEX', 'VIX', 'USD', 2, 0.01, 25, 1, 1000, 1.5, 0.5, 7, 20.00, 'CBOE:VIX', TRUE, NOW(), NOW()),
  ('WHEATUSD', 'Wheat vs US Dollar', 'COMMODITY', 'WHEAT', 'USD', 3, 0.001, 1, 1, 1000, 1.5, 0.8, 7, 5.500, 'OANDA:WHEAT_USD', TRUE, NOW(), NOW()),
  ('SUGARUSD', 'Sugar No. 11 vs US Dollar', 'COMMODITY', 'SUGAR', 'USD', 2, 0.01, 1, 1, 1000, 1.5, 0.8, 7, 17.00, 'OANDA:SUGAR_USD', TRUE, NOW(), NOW())
ON CONFLICT ("symbol") DO NOTHING;

UPDATE "Instrument"
SET "category" = 'INDEX',
    "feedSymbol" = 'CBOE:VIX',
    "active" = TRUE,
    "updatedAt" = NOW()
WHERE "symbol" = 'VIX';
