#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env.production"
BACKUP_DIR="${1:-}"
[[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]] || { echo "Usage: CONFIRM_RESTORE=YES ./deploy/restore.sh /path/to/backup" >&2; exit 1; }
[[ "${CONFIRM_RESTORE:-}" == "YES" ]] || { echo "Set CONFIRM_RESTORE=YES; restore is destructive." >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
for file in postgres.dump redis-dump.rdb minio-data.tar.gz SHA256SUMS; do
  [[ -f "$BACKUP_DIR/$file" ]] || { echo "Missing $BACKUP_DIR/$file" >&2; exit 1; }
done
(cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS)

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$ROOT/deploy/docker-compose.prod.yml")
REDIS_ID="$("${COMPOSE[@]}" ps -q redis)"
MINIO_ID="$("${COMPOSE[@]}" ps -q minio)"
[[ -n "$REDIS_ID" && -n "$MINIO_ID" ]] || { echo "Redis and MinIO containers must exist before restore." >&2; exit 1; }

"${COMPOSE[@]}" stop caddy app
POSTGRES_USER="$(${COMPOSE[@]} exec -T postgres printenv POSTGRES_USER)"
POSTGRES_DB="$(${COMPOSE[@]} exec -T postgres printenv POSTGRES_DB)"
"${COMPOSE[@]}" exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner < "$BACKUP_DIR/postgres.dump"

"${COMPOSE[@]}" stop redis minio
docker cp "$BACKUP_DIR/redis-dump.rdb" "$REDIS_ID:/data/dump.rdb"
# Clear and restore the private object-store volume while MinIO is stopped.
docker run --rm --volumes-from "$MINIO_ID" alpine:3.20 sh -c 'rm -rf /data/*'
tar -C "$BACKUP_DIR" -xzf "$BACKUP_DIR/minio-data.tar.gz"
docker cp "$BACKUP_DIR/minio-data/." "$MINIO_ID:/data/"
rm -rf "$BACKUP_DIR/minio-data"

"${COMPOSE[@]}" up -d postgres redis minio minio-init
"${COMPOSE[@]}" run --rm app npx prisma migrate deploy
"${COMPOSE[@]}" up -d app caddy
"${COMPOSE[@]}" ps
echo "Restore complete. Run the health and reconciliation checks before reopening traffic."
