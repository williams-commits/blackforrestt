ALTER TYPE "TxnStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "TxnStatus" ADD VALUE IF NOT EXISTS 'REVERSED';
ALTER TYPE "PaymentRequestStatus" ADD VALUE IF NOT EXISTS 'AWAITING_APPROVAL';
ALTER TYPE "PaymentRequestStatus" ADD VALUE IF NOT EXISTS 'REVERSED';

CREATE TYPE "PaymentReconciliationStatus" AS ENUM ('PENDING', 'MATCHED', 'MISMATCHED');
CREATE TYPE "PaymentProofStatus" AS ENUM ('PENDING_SCAN', 'CLEAN', 'BLOCKED', 'QUARANTINED');
CREATE TYPE "PaymentEventType" AS ENUM (
  'CREATED', 'PROOF_RECEIVED', 'PROOF_FINALIZED', 'PROOF_BLOCKED', 'PREPARED',
  'APPROVED', 'REJECTED', 'CANCELLED', 'REVERSED', 'RECONCILED', 'RISK_REJECTED'
);

ALTER TABLE "PaymentRequest"
  ADD COLUMN "beneficiaryEncrypted" TEXT,
  ADD COLUMN "beneficiaryFingerprint" TEXT,
  ADD COLUMN "beneficiarySummary" TEXT,
  ADD COLUMN "beneficiaryAvailableAt" TIMESTAMP(3),
  ADD COLUMN "riskHoldUntil" TIMESTAMP(3),
  ADD COLUMN "preparedBy" TEXT,
  ADD COLUMN "preparedAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationStatus" "PaymentReconciliationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reconciliationReference" TEXT,
  ADD COLUMN "reconciledAmount" DECIMAL(36,8),
  ADD COLUMN "reconciledBy" TEXT,
  ADD COLUMN "reconciledAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationNote" TEXT;

CREATE UNIQUE INDEX "PaymentRequest_asset_reconciliationReference_key"
  ON "PaymentRequest"("asset", "reconciliationReference");
CREATE INDEX "PaymentRequest_reconciliationStatus_createdAt_idx"
  ON "PaymentRequest"("reconciliationStatus", "createdAt");

CREATE TABLE "PaymentProof" (
  "id" TEXT NOT NULL,
  "paymentRequestId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "declaredMime" TEXT NOT NULL,
  "detectedMime" TEXT,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "status" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING_SCAN',
  "uploadedBy" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalizedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentProof_storageKey_key" ON "PaymentProof"("storageKey");
CREATE INDEX "PaymentProof_paymentRequestId_createdAt_idx" ON "PaymentProof"("paymentRequestId", "createdAt");
CREATE INDEX "PaymentProof_status_idx" ON "PaymentProof"("status");

CREATE TABLE "PaymentEvent" (
  "id" TEXT NOT NULL,
  "paymentRequestId" TEXT NOT NULL,
  "type" "PaymentEventType" NOT NULL,
  "actorId" TEXT,
  "commandKey" TEXT,
  "commandFingerprint" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentEvent_paymentRequestId_createdAt_idx" ON "PaymentEvent"("paymentRequestId", "createdAt");
CREATE UNIQUE INDEX "PaymentEvent_paymentRequestId_commandKey_key"
  ON "PaymentEvent"("paymentRequestId", "commandKey");

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

ALTER TABLE "PaymentProof"
  ADD CONSTRAINT "PaymentProof_paymentRequestId_fkey"
  FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentEvent"
  ADD CONSTRAINT "PaymentEvent_paymentRequestId_fkey"
  FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
