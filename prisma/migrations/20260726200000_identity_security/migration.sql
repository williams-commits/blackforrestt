CREATE TYPE "SecurityTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

ALTER TABLE "User"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3),
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN "mfaSecretEncrypted" TEXT,
  ADD COLUMN "mfaEnabledAt" TIMESTAMP(3),
  ADD COLUMN "mfaLastUsedStep" BIGINT;

UPDATE "User"
SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", "createdAt")
WHERE "isDev" = true OR "isAdmin" = true;

ALTER TABLE "User"
  ADD CONSTRAINT "User_failedLoginCount_nonnegative"
    CHECK ("failedLoginCount" >= 0),
  ADD CONSTRAINT "User_mfa_enabled_requires_secret"
    CHECK ("mfaEnabledAt" IS NULL OR "mfaSecretEncrypted" IS NOT NULL),
  ADD CONSTRAINT "User_mfa_step_nonnegative"
    CHECK ("mfaLastUsedStep" IS NULL OR "mfaLastUsedStep" >= 0);

CREATE TABLE "SecurityToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "SecurityTokenType" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecurityToken_tokenHash_key" ON "SecurityToken"("tokenHash");
CREATE INDEX "SecurityToken_userId_type_createdAt_idx" ON "SecurityToken"("userId", "type", "createdAt");
CREATE INDEX "SecurityToken_type_expiresAt_idx" ON "SecurityToken"("type", "expiresAt");
ALTER TABLE "SecurityToken"
  ADD CONSTRAINT "SecurityToken_expiry_after_creation"
  CHECK ("expiresAt" > "createdAt");

CREATE TABLE "MfaRecoveryCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MfaRecoveryCode_codeHash_key" ON "MfaRecoveryCode"("codeHash");
CREATE INDEX "MfaRecoveryCode_userId_usedAt_idx" ON "MfaRecoveryCode"("userId", "usedAt");

CREATE TABLE "SecuritySession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "deviceName" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipHash" TEXT,
  "mfaVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "SecuritySession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecuritySession_userId_revokedAt_expiresAt_idx"
  ON "SecuritySession"("userId", "revokedAt", "expiresAt");
CREATE INDEX "SecuritySession_userId_deviceId_idx"
  ON "SecuritySession"("userId", "deviceId");
ALTER TABLE "SecuritySession"
  ADD CONSTRAINT "SecuritySession_expiry_after_creation"
  CHECK ("expiresAt" > "createdAt");

ALTER TABLE "SecurityToken"
  ADD CONSTRAINT "SecurityToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MfaRecoveryCode"
  ADD CONSTRAINT "MfaRecoveryCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecuritySession"
  ADD CONSTRAINT "SecuritySession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
