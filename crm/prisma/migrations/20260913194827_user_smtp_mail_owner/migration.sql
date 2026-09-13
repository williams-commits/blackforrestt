-- AlterTable
ALTER TABLE "EmailMessage" ADD COLUMN     "bccAddress" TEXT,
ADD COLUMN     "ownerUserId" TEXT;

-- CreateTable
CREATE TABLE "UserSmtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT true,
    "username" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "fromName" TEXT,
    "fromAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSmtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSmtp_userId_key" ON "UserSmtp"("userId");

-- CreateIndex
CREATE INDEX "EmailMessage_ownerUserId_direction_createdAt_idx" ON "EmailMessage"("ownerUserId", "direction", "createdAt");

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSmtp" ADD CONSTRAINT "UserSmtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

