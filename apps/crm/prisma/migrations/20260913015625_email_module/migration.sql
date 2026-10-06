-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('RECEIVED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "direction" "EmailDirection" NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "ccAddress" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "subjectType" "SubjectType",
    "subjectId" TEXT,
    "threadKey" TEXT NOT NULL,
    "messageId" TEXT,
    "readAt" TIMESTAMP(3),
    "sentById" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_messageId_key" ON "EmailMessage"("messageId");

-- CreateIndex
CREATE INDEX "EmailMessage_direction_readAt_createdAt_idx" ON "EmailMessage"("direction", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "EmailMessage_subjectType_subjectId_createdAt_idx" ON "EmailMessage"("subjectType", "subjectId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailMessage_threadKey_createdAt_idx" ON "EmailMessage"("threadKey", "createdAt");

-- CreateIndex
CREATE INDEX "EmailMessage_fromAddress_idx" ON "EmailMessage"("fromAddress");

-- CreateIndex
CREATE INDEX "EmailMessage_toAddress_idx" ON "EmailMessage"("toAddress");

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

