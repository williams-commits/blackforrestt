ALTER TABLE "PaymentRequest"
  ADD COLUMN "methodDetailsEncrypted" TEXT,
  ADD COLUMN "methodDetailsFingerprint" TEXT,
  ADD COLUMN "methodDetailsSummary" TEXT;

CREATE TABLE "EmailDelivery" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "recipient" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "variables" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailDelivery_status_nextAttemptAt_idx" ON "EmailDelivery"("status", "nextAttemptAt");
CREATE INDEX "EmailDelivery_userId_createdAt_idx" ON "EmailDelivery"("userId", "createdAt");
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
