-- CreateEnum
CREATE TYPE "PositionType" AS ENUM ('CFD', 'STRIKE');

-- CreateEnum
CREATE TYPE "PositionSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "Instrument" (
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "digits" INTEGER NOT NULL DEFAULT 5,
    "pipSize" DECIMAL(18,8) NOT NULL,
    "pipValue" DECIMAL(18,8) NOT NULL,
    "contractSize" DECIMAL(18,4) NOT NULL DEFAULT 100000,
    "marginPerLot" DECIMAL(18,4) NOT NULL,
    "swapLongPips" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "swapShortPips" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "commissionPerLot" DECIMAL(18,4) NOT NULL DEFAULT 7,
    "basePrice" DECIMAL(24,8) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "accountNo" TEXT,
    "isDev" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "free" DECIMAL(36,8) NOT NULL DEFAULT 0,
    "locked" DECIMAL(36,8) NOT NULL DEFAULT 0,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountMetrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(36,8) NOT NULL DEFAULT 0,
    "credit" DECIMAL(36,8) NOT NULL DEFAULT 0,
    "equity" DECIMAL(36,8) NOT NULL DEFAULT 0,
    "margin" DECIMAL(36,8) NOT NULL DEFAULT 0,
    "marginLevel" DECIMAL(18,4),
    "free" DECIMAL(36,8) NOT NULL DEFAULT 0,
    "floatingPl" DECIMAL(36,8) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" "PositionType" NOT NULL,
    "side" "PositionSide" NOT NULL,
    "volume" DECIMAL(18,4) NOT NULL,
    "openRate" DECIMAL(24,8) NOT NULL,
    "strikeRate" DECIMAL(24,8),
    "currentRate" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "stopLoss" DECIMAL(24,8),
    "takeProfit" DECIMAL(24,8),
    "swap" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "commission" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "tradingCommission" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "profit" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "netProfit" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedTill" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Instrument_active_idx" ON "Instrument"("active");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_accountNo_key" ON "User"("accountNo");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_asset_key" ON "Wallet"("userId", "asset");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMetrics_userId_key" ON "AccountMetrics"("userId");

-- CreateIndex
CREATE INDEX "Position_userId_status_idx" ON "Position"("userId", "status");

-- CreateIndex
CREATE INDEX "Position_symbol_status_idx" ON "Position"("symbol", "status");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Instrument"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
