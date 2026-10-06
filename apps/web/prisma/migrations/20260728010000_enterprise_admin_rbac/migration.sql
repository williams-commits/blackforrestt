-- Enterprise Phase 6: seven-role administration, full-domain audit metadata,
-- support operations, risk controls, and maker-checker change requests.

CREATE TYPE "AdminRole" AS ENUM (
  'SUPER_ADMIN', 'COMPLIANCE', 'FINANCE', 'DEALER', 'RISK', 'SUPPORT', 'AUDITOR'
);
CREATE TYPE "AuditDomain" AS ENUM (
  'SECURITY', 'KYC', 'PAYMENT', 'LEDGER', 'EXECUTION', 'RECONCILIATION',
  'CONFIGURATION', 'SUPPORT', 'ADMIN', 'SYSTEM'
);
CREATE TYPE "SupportCaseStatus" AS ENUM (
  'OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'
);
CREATE TYPE "SupportCasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "RiskRuleSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKING');
CREATE TYPE "AdminChangeDomain" AS ENUM ('ACCESS', 'RISK', 'INSTRUMENT', 'CONFIGURATION');
CREATE TYPE "AdminChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELLED');

ALTER TABLE "AuditEvent"
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "domain" "AuditDomain" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "requestId" TEXT;
ALTER TABLE "AuditEvent" ALTER COLUMN "schemaVersion" SET DEFAULT 2;
CREATE INDEX "AuditEvent_domain_createdAt_idx" ON "AuditEvent"("domain", "createdAt");
CREATE INDEX "AuditEvent_requestId_idx" ON "AuditEvent"("requestId");

CREATE TABLE "AdminRoleAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "AdminRole" NOT NULL,
  "assignedById" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "reason" TEXT,
  CONSTRAINT "AdminRoleAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminRoleAssignment_userId_role_key" ON "AdminRoleAssignment"("userId", "role");
CREATE INDEX "AdminRoleAssignment_role_revokedAt_idx" ON "AdminRoleAssignment"("role", "revokedAt");
CREATE INDEX "AdminRoleAssignment_userId_revokedAt_idx" ON "AdminRoleAssignment"("userId", "revokedAt");
ALTER TABLE "AdminRoleAssignment" ADD CONSTRAINT "AdminRoleAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SupportCase" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "userId" TEXT,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "priority" "SupportCasePriority" NOT NULL DEFAULT 'NORMAL',
  "status" "SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
  "createdById" TEXT NOT NULL,
  "assignedToId" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupportCase_reference_key" ON "SupportCase"("reference");
CREATE INDEX "SupportCase_status_priority_createdAt_idx" ON "SupportCase"("status", "priority", "createdAt");
CREATE INDEX "SupportCase_userId_createdAt_idx" ON "SupportCase"("userId", "createdAt");
CREATE INDEX "SupportCase_assignedToId_status_idx" ON "SupportCase"("assignedToId", "status");

CREATE TABLE "RiskRule" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "RiskRuleSeverity" NOT NULL DEFAULT 'WARNING',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "configuration" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiskRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RiskRule_code_key" ON "RiskRule"("code");
CREATE INDEX "RiskRule_enabled_severity_idx" ON "RiskRule"("enabled", "severity");

CREATE TABLE "AdminChangeRequest" (
  "id" TEXT NOT NULL,
  "commandKey" TEXT NOT NULL,
  "domain" "AdminChangeDomain" NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "payload" JSONB NOT NULL,
  "status" "AdminChangeStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "requestNote" TEXT,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "AdminChangeRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminChangeRequest_commandKey_key" ON "AdminChangeRequest"("commandKey");
CREATE INDEX "AdminChangeRequest_status_domain_createdAt_idx" ON "AdminChangeRequest"("status", "domain", "createdAt");
CREATE INDEX "AdminChangeRequest_requestedById_createdAt_idx" ON "AdminChangeRequest"("requestedById", "createdAt");
CREATE INDEX "AdminChangeRequest_reviewedById_reviewedAt_idx" ON "AdminChangeRequest"("reviewedById", "reviewedAt");

-- Preserve existing administrator access while moving authorization to RBAC.
INSERT INTO "AdminRoleAssignment" (
  "id", "userId", "role", "assignedById", "assignedAt", "reason"
)
SELECT
  'phase6_' || substr(md5("id" || ':SUPER_ADMIN'), 1, 24),
  "id",
  'SUPER_ADMIN'::"AdminRole",
  "id",
  CURRENT_TIMESTAMP,
  'Migrated from legacy isAdmin flag'
FROM "User"
WHERE "isAdmin" = true
ON CONFLICT ("userId", "role") DO NOTHING;

-- Baseline risk controls are explicit, versioned, and simulation-safe.
INSERT INTO "RiskRule" (
  "id", "code", "name", "description", "severity", "enabled",
  "configuration", "version", "createdAt", "updatedAt"
) VALUES
  ('risk_max_order_volume', 'MAX_ORDER_VOLUME', 'Maximum order volume',
   'Blocks a single simulation order above the approved volume.', 'BLOCKING', true,
   '{"maxLots":"100.00000000"}'::jsonb, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('risk_stale_quote', 'STALE_QUOTE_BLOCK', 'Stale quote protection',
   'Blocks new exposure when the selected quote exceeds the approved age.', 'BLOCKING', true,
   '{"maxAgeMs":15000}'::jsonb, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('risk_margin_floor', 'MARGIN_LEVEL_WARNING', 'Margin-level warning',
   'Surfaces elevated account risk before the existing stop-out threshold.', 'WARNING', true,
   '{"warningPercent":"125.00000000"}'::jsonb, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
