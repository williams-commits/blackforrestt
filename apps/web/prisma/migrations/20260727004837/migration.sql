/*
  Warnings:

  - The values [REVERSED] on the enum `LedgerTransactionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LedgerTransactionStatus_new" AS ENUM ('DRAFT', 'POSTED');
ALTER TABLE "public"."LedgerTransaction" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "LedgerTransaction" ALTER COLUMN "status" TYPE "LedgerTransactionStatus_new" USING ("status"::text::"LedgerTransactionStatus_new");
ALTER TYPE "LedgerTransactionStatus" RENAME TO "LedgerTransactionStatus_old";
ALTER TYPE "LedgerTransactionStatus_new" RENAME TO "LedgerTransactionStatus";
DROP TYPE "public"."LedgerTransactionStatus_old";
ALTER TABLE "LedgerTransaction" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;
