-- Phase 5 reconciliation hardening: persistent scheduling metadata, one block
-- per discrepancy, and an explicit case/block foreign key.

CREATE TYPE "ReconciliationRunTrigger" AS ENUM ('SCHEDULED', 'MANUAL', 'RETRY', 'STARTUP_CATCHUP');

ALTER TABLE "ReconciliationRun"
  ADD COLUMN "trigger" "ReconciliationRunTrigger" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "windowStart" TIMESTAMP(3),
  ADD COLUMN "windowEnd" TIMESTAMP(3),
  ADD COLUMN "requestedBy" TEXT,
  ADD COLUMN "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "ReconciliationRun_status_startedAt_idx"
  ON "ReconciliationRun"("status", "startedAt");

DROP INDEX IF EXISTS "ReconciliationBlock_userId_scope_active_key";
DROP INDEX IF EXISTS "ReconciliationBlock_userId_releasedAt_idx";
DROP INDEX IF EXISTS "ReconciliationBlock_caseId_key";

CREATE INDEX "ReconciliationBlock_userId_scope_releasedAt_idx"
  ON "ReconciliationBlock"("userId", "scope", "releasedAt");
CREATE INDEX "ReconciliationBlock_caseId_idx"
  ON "ReconciliationBlock"("caseId");


ALTER TABLE "ReconciliationCase"
  ADD CONSTRAINT "ReconciliationCase_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReconciliationBlock"
  ADD CONSTRAINT "ReconciliationBlock_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "ReconciliationCase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
