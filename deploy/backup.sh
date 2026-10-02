#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env.production"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }
command -v tar >/dev/null || { echo "tar is required." >&2; exit 1; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${1:-$ROOT/backups/$STAMP}"
mkdir -p "$DEST"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$ROOT/deploy/docker-compose.prod.yml")

POSTGRES_USER="$(${COMPOSE[@]} exec -T postgres printenv POSTGRES_USER)"
POSTGRES_DB="$(${COMPOSE[@]} exec -T postgres printenv POSTGRES_DB)"
"${COMPOSE[@]}" exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$DEST/postgres.dump"

"${COMPOSE[@]}" exec -T redis redis-cli SAVE >/dev/null
REDIS_ID="$(${COMPOSE[@]} ps -q redis)"
docker cp "$REDIS_ID:/data/dump.rdb" "$DEST/redis-dump.rdb"

MINIO_ID="$(${COMPOSE[@]} ps -q minio)"
mkdir -p "$DEST/minio-data"
docker cp "$MINIO_ID:/data/." "$DEST/minio-data/"
tar -C "$DEST" -czf "$DEST/minio-data.tar.gz" minio-data
rm -rf "$DEST/minio-data"

# MinIO removed its community images from public registries (see the pull
# guard in deploy.sh) — a fresh host can ONLY restore the pinned images from
# this archive: gunzip -c minio-images.tgz | docker load. Same extraction as
# deploy.sh's guard so the names always match.
MINIO_SERVER_IMAGE="$(grep -E '^  minio:' -A1 "$ROOT/deploy/docker-compose.prod.yml" | grep 'image:' | head -1 | sed -E 's/.*image: *//;s/[" ]//g')"
MINIO_MC_IMAGE="$(grep -E '^  minio-init:' -A1 "$ROOT/deploy/docker-compose.prod.yml" | grep 'image:' | head -1 | sed -E 's/.*image: *//;s/[" ]//g')"
docker save "$MINIO_SERVER_IMAGE" "$MINIO_MC_IMAGE" | gzip > "$DEST/minio-images.tgz"

# CRM attachments are a separate named volume, so include them in every
# backup instead of relying on the lifecycle of the CRM application image.
CRM_ID="$(${COMPOSE[@]} ps -q crm)"
[[ -n "$CRM_ID" ]] || { echo "CRM container must be running for attachment backup." >&2; exit 1; }
mkdir -p "$DEST/crm-attachments"
docker cp "$CRM_ID:/app/uploads/attachments/." "$DEST/crm-attachments/"
tar -C "$DEST" -czf "$DEST/crm-attachments.tar.gz" crm-attachments
rm -rf "$DEST/crm-attachments"

sha256sum "$DEST/postgres.dump" "$DEST/redis-dump.rdb" "$DEST/minio-data.tar.gz" "$DEST/minio-images.tgz" "$DEST/crm-attachments.tar.gz" > "$DEST/SHA256SUMS"
printf '%s\n' "created_at=$STAMP" "postgres_db=$POSTGRES_DB" > "$DEST/METADATA"
echo "Backup written to $DEST"
