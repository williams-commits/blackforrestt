CREATE TYPE "PaymentRequestType" AS ENUM ('DEPOSIT', 'WITHDRAWAL');
CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "LedgerTransactionStatus" AS ENUM ('POSTED', 'REVERSED');

CREATE TABLE "PaymentRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "type" "PaymentRequestType" NOT NULL,
  "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(36,8) NOT NULL,
  "asset" TEXT NOT NULL DEFAULT 'USD',
  "method" TEXT NOT NULL,
  "userReference" TEXT,
  "externalReference" TEXT,
  "reviewerNote" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentRequest_transactionId_key" ON "PaymentRequest"("transactionId");
CREATE INDEX "PaymentRequest_status_createdAt_idx" ON "PaymentRequest"("status", "createdAt");
CREATE INDEX "PaymentRequest_userId_createdAt_idx" ON "PaymentRequest"("userId", "createdAt");

CREATE TABLE "LedgerAccount" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "LedgerAccountType" NOT NULL,
  "asset" TEXT NOT NULL DEFAULT 'USD',
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LedgerAccount_code_key" ON "LedgerAccount"("code");
CREATE INDEX "LedgerAccount_userId_asset_idx" ON "LedgerAccount"("userId", "asset");

CREATE TABLE "LedgerTransaction" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "LedgerTransactionStatus" NOT NULL DEFAULT 'POSTED',
  "createdBy" TEXT,
  "reversalOfId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LedgerTransaction_reference_key" ON "LedgerTransaction"("reference");
CREATE UNIQUE INDEX "LedgerTransaction_reversalOfId_key" ON "LedgerTransaction"("reversalOfId");
CREATE INDEX "LedgerTransaction_createdAt_idx" ON "LedgerTransaction"("createdAt");

CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "direction" "LedgerDirection" NOT NULL,
  "amount" DECIMAL(36,8) NOT NULL,
  "asset" TEXT NOT NULL DEFAULT 'USD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");
CREATE INDEX "LedgerEntry_accountId_createdAt_idx" ON "LedgerEntry"("accountId", "createdAt");

CREATE TABLE "AuditEvent" (
  "sequence" BIGSERIAL NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "previousHash" TEXT,
  "eventHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("sequence")
);
CREATE UNIQUE INDEX "AuditEvent_eventHash_key" ON "AuditEvent"("eventHash");
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Compliance and accounting history are append-only. Corrections use compensating entries/events.
CREATE OR REPLACE FUNCTION prevent_immutable_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable; append a compensating record instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entry_immutable BEFORE UPDATE OR DELETE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
CREATE TRIGGER audit_event_immutable BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
