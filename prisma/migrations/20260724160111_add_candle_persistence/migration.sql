-- CreateTable
CREATE TABLE "Candle" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "time" BIGINT NOT NULL,
    "open" DECIMAL(24,8) NOT NULL,
    "high" DECIMAL(24,8) NOT NULL,
    "low" DECIMAL(24,8) NOT NULL,
    "close" DECIMAL(24,8) NOT NULL,
    "volume" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "Candle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Candle_symbol_interval_time_idx" ON "Candle"("symbol", "interval", "time");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_symbol_interval_time_key" ON "Candle"("symbol", "interval", "time");

-- AddForeignKey
ALTER TABLE "Candle" ADD CONSTRAINT "Candle_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Instrument"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
