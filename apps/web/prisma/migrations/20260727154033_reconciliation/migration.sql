-- CreateEnum
CREATE TYPE "ReconciliationRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReconciliationCaseStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReconciliationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReconciliationBlockScope" AS ENUM ('TRADE', 'WITHDRAW');

-- CreateEnum
CREATE TYPE "ReconciliationFeedKind" AS ENUM ('LEDGER_TRIAL_BALANCE', 'USER_PROJECTION', 'WALLET_PROJECTION', 'ACCOUNT_METRICS', 'POSITION_PNL', 'PAYMENT_SETTLEMENT');

-- CreateTable
CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "usersChecked" INTEGER NOT NULL DEFAULT 0,
    "caseCount" INTEGER NOT NULL DEFAULT 0,
    "blockCount" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationCase" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT,
    "feedKind" "ReconciliationFeedKind" NOT NULL,
    "severity" "ReconciliationSeverity" NOT NULL,
    "status" "ReconciliationCaseStatus" NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "expectedValue" TEXT,
    "actualValue" TEXT,
    "ownerAssignee" TEXT,
    "resolutionNote" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReconciliationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "ReconciliationBlockScope" NOT NULL,
    "reason" TEXT NOT NULL,
    "caseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "releasedBy" TEXT,
    "releaseNote" TEXT,

    CONSTRAINT "ReconciliationBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationRun_reference_key" ON "ReconciliationRun"("reference");

-- CreateIndex
CREATE INDEX "ReconciliationRun_startedAt_idx" ON "ReconciliationRun"("startedAt");

-- CreateIndex
CREATE INDEX "ReconciliationCase_runId_idx" ON "ReconciliationCase"("runId");

-- CreateIndex
CREATE INDEX "ReconciliationCase_userId_status_idx" ON "ReconciliationCase"("userId", "status");

-- CreateIndex
CREATE INDEX "ReconciliationCase_severity_status_idx" ON "ReconciliationCase"("severity", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationBlock_caseId_key" ON "ReconciliationBlock"("caseId");

-- CreateIndex
CREATE INDEX "ReconciliationBlock_userId_releasedAt_idx" ON "ReconciliationBlock"("userId", "releasedAt");

-- Only one *active* (unreleased) block per (userId, scope). Released/historical
-- blocks are excluded so the same scope can be blocked again after a release.
CREATE UNIQUE INDEX "ReconciliationBlock_userId_scope_active_key"
  ON "ReconciliationBlock"("userId", "scope")
  WHERE "releasedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "ReconciliationCase" ADD CONSTRAINT "ReconciliationCase_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationBlock" ADD CONSTRAINT "ReconciliationBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
