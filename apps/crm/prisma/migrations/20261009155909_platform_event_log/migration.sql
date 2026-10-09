-- CreateTable
CREATE TABLE "PlatformEventLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformEventLog_platformUserId_receivedAt_idx" ON "PlatformEventLog"("platformUserId", "receivedAt");
