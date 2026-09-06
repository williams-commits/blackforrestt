-- Accounts use the same administrator-managed status registry as leads,
-- contacts, and customers.
-- IF NOT EXISTS makes this migration recoverable if a previous deploy added
-- the account schema successfully but stopped at a later statement.
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "statusId" TEXT;

CREATE INDEX IF NOT EXISTS "Account_statusId_idx" ON "Account"("statusId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Account_statusId_fkey'
      AND conrelid = '"Account"'::regclass
  ) THEN
    ALTER TABLE "Account"
      ADD CONSTRAINT "Account_statusId_fkey"
      FOREIGN KEY ("statusId") REFERENCES "RecordStatus"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Existing installations receive the two administrator-only capabilities
-- immediately; the seed keeps system roles aligned on future runs.
-- RolePermission.id has a Prisma-side CUID default, not a database default.
-- Raw SQL migrations must therefore supply the primary key themselves.
INSERT INTO "RolePermission" ("id", "roleId", "permission")
SELECT 'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24), "id", 'RECORDS_ASSIGN'
FROM "Role" WHERE "key" IN ('ADMIN', 'SUPER_ADMIN')
ON CONFLICT ("roleId", "permission") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permission")
SELECT 'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24), "id", 'RECORDS_CLASSIFY'
FROM "Role" WHERE "key" IN ('ADMIN', 'SUPER_ADMIN')
ON CONFLICT ("roleId", "permission") DO NOTHING;

DELETE FROM "RolePermission" WHERE "permission" = 'LEADS_ASSIGN';
