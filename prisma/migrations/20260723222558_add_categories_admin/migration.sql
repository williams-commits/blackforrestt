-- CreateEnum
CREATE TYPE "InstrumentCategory" AS ENUM ('FOREX', 'COMMODITY', 'INDEX', 'CRYPTO');

-- AlterTable
ALTER TABLE "Instrument" ADD COLUMN     "category" "InstrumentCategory" NOT NULL DEFAULT 'FOREX';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;
