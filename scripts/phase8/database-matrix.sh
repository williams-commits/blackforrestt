#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

for command in node npm npx psql createdb dropdb pg_dump pg_restore; do
  command -v "$command" >/dev/null 2>&1 || { echo "Missing required command: $command" >&2; exit 2; }
done

ADMIN_URL="${PHASE8_DATABASE_ADMIN_URL:-${DATABASE_URL:-}}"
if [[ -z "$ADMIN_URL" ]]; then
  echo "Set PHASE8_DATABASE_ADMIN_URL (or DATABASE_URL) to a PostgreSQL maintenance connection." >&2
  exit 2
fi

RUN_ID="$(date -u +%Y%m%d%H%M%S)_$$"
EMPTY_DB="phase8_empty_${RUN_ID}"
RESTORE_DB="phase8_restore_${RUN_ID}"
EVIDENCE_DIR="${PHASE8_EVIDENCE_DIR:-artifacts/phase8}"
mkdir -p "$EVIDENCE_DIR"
DUMP_FILE="$EVIDENCE_DIR/database-backup-${RUN_ID}.dump"
RESULT_FILE="$EVIDENCE_DIR/database-matrix.json"

url_for_db() {
  node -e 'const u=new URL(process.argv[1]); u.pathname=`/${process.argv[2]}`; console.log(u.toString())' "$ADMIN_URL" "$1"
}

cleanup() {
  dropdb --if-exists --force --maintenance-db="$ADMIN_URL" "$EMPTY_DB" >/dev/null 2>&1 || true
  dropdb --if-exists --force --maintenance-db="$ADMIN_URL" "$RESTORE_DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

createdb --maintenance-db="$ADMIN_URL" "$EMPTY_DB"
EMPTY_URL="$(url_for_db "$EMPTY_DB")"

# Empty-database replay and seed prove every committed migration is self-contained.
DATABASE_URL="$EMPTY_URL" npx prisma validate
DATABASE_URL="$EMPTY_URL" npx prisma migrate deploy
DATABASE_URL="$EMPTY_URL" npm run db:seed

MIGRATIONS_BEFORE="$(psql "$EMPTY_URL" -Atqc 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')"
TABLES_BEFORE="$(psql "$EMPTY_URL" -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
USERS_BEFORE="$(psql "$EMPTY_URL" -Atqc 'SELECT count(*) FROM "User"')"

# Upgrade/no-op replay proves the current code can start against an already-current database.
DATABASE_URL="$EMPTY_URL" npx prisma migrate deploy
MIGRATIONS_AFTER="$(psql "$EMPTY_URL" -Atqc 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')"
[[ "$MIGRATIONS_BEFORE" == "$MIGRATIONS_AFTER" ]] || { echo "Migration replay changed migration count" >&2; exit 1; }

# Backup and restore to a separate database is the rollback/data-recovery proof.
pg_dump --dbname="$EMPTY_URL" --format=custom --no-owner --no-acl --file="$DUMP_FILE"
createdb --maintenance-db="$ADMIN_URL" "$RESTORE_DB"
RESTORE_URL="$(url_for_db "$RESTORE_DB")"
pg_restore --dbname="$RESTORE_URL" --no-owner --no-acl --exit-on-error "$DUMP_FILE"
MIGRATIONS_RESTORED="$(psql "$RESTORE_URL" -Atqc 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')"
TABLES_RESTORED="$(psql "$RESTORE_URL" -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
USERS_RESTORED="$(psql "$RESTORE_URL" -Atqc 'SELECT count(*) FROM "User"')"
[[ "$MIGRATIONS_AFTER" == "$MIGRATIONS_RESTORED" ]] || { echo "Restored migration count differs" >&2; exit 1; }
[[ "$TABLES_BEFORE" == "$TABLES_RESTORED" ]] || { echo "Restored table count differs" >&2; exit 1; }
[[ "$USERS_BEFORE" == "$USERS_RESTORED" ]] || { echo "Restored user count differs" >&2; exit 1; }

DUMP_SHA256="$(node -e 'const fs=require("fs"),c=require("crypto"); console.log(c.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"))' "$DUMP_FILE")"
node - "$RESULT_FILE" "$MIGRATIONS_AFTER" "$TABLES_RESTORED" "$USERS_RESTORED" "$DUMP_FILE" "$DUMP_SHA256" <<'NODE'
const fs = require("fs");
const [file, migrations, tables, users, dumpFile, sha256] = process.argv.slice(2);
fs.writeFileSync(file, JSON.stringify({
  kind: "database_migration_backup_restore",
  generatedAt: new Date().toISOString(),
  migrations: Number(migrations),
  tables: Number(tables),
  users: Number(users),
  dumpFile,
  dumpSha256: sha256,
  passed: true,
}, null, 2) + "\n");
NODE
cat "$RESULT_FILE"
