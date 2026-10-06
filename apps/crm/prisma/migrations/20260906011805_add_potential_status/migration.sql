-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "potentialStatusId" TEXT;

-- CreateTable
CREATE TABLE "PotentialStatus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PotentialStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PotentialStatus_sortOrder_idx" ON "PotentialStatus"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PotentialStatus_name_key" ON "PotentialStatus"("name");

-- CreateIndex
CREATE INDEX "Lead_potentialStatusId_idx" ON "Lead"("potentialStatusId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_potentialStatusId_fkey" FOREIGN KEY ("potentialStatusId") REFERENCES "PotentialStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
