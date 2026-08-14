-- CreateTable: ReferralCode
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_userId_key" ON "ReferralCode"("userId");
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE INDEX "ReferralCode_code_idx" ON "ReferralCode"("code");

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED');

-- CreateTable: Referral
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "referrerReward" DECIMAL(65,8) NOT NULL DEFAULT 25,
    "referredReward" DECIMAL(65,8) NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredId_key" ON "Referral"("referredId");
CREATE INDEX "Referral_referrerId_status_idx" ON "Referral"("referrerId", "status");
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey"
    FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredId_fkey"
    FOREIGN KEY ("referredId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
