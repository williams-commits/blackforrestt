-- CreateTable
CREATE TABLE "CustomObject" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pluralName" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "fields" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomObjectRecord" (
    "id" TEXT NOT NULL,
    "customObjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "assignedTeamId" TEXT,
    "externalId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomObjectRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomObject_key_key" ON "CustomObject"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CustomObjectRecord_externalId_key" ON "CustomObjectRecord"("externalId");

-- CreateIndex
CREATE INDEX "CustomObjectRecord_customObjectId_deletedAt_idx" ON "CustomObjectRecord"("customObjectId", "deletedAt");

-- CreateIndex
CREATE INDEX "CustomObjectRecord_ownerUserId_idx" ON "CustomObjectRecord"("ownerUserId");

-- CreateIndex
CREATE INDEX "CustomObjectRecord_externalId_idx" ON "CustomObjectRecord"("externalId");

-- AddForeignKey
ALTER TABLE "CustomObjectRecord" ADD CONSTRAINT "CustomObjectRecord_customObjectId_fkey" FOREIGN KEY ("customObjectId") REFERENCES "CustomObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomObjectRecord" ADD CONSTRAINT "CustomObjectRecord_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
