#!/usr/bin/env bash
# Grants the CRM's EMAILS_VIEW / EMAILS_SEND permissions to the email-capable
# system roles — idempotently and additively. Never removes anything, so
# permission customizations made through the Roles UI always survive.
#
# Run by deploy.sh after the CRM migrations; also available as:
#   make crm-grant
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose --env-file "$ROOT/.env.production" -f "$ROOT/deploy/docker-compose.prod.yml")

[[ -f "$ROOT/.env.production" ]] || { echo "Missing $ROOT/.env.production" >&2; exit 1; }

POSTGRES_USER="$("${COMPOSE[@]}" exec -T postgres printenv POSTGRES_USER)"

"${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d blckforest_crm -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO "RolePermission" ("id", "roleId", "permission")
SELECT gen_random_uuid()::text, r."id", p.perm
FROM "Role" r
CROSS JOIN (VALUES ('EMAILS_VIEW'), ('EMAILS_SEND')) AS p(perm)
WHERE r."key" IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TEAM_LEAD', 'REP')
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permission" = p.perm
  );
SQL

echo "CRM role permissions are up to date (email-capable roles hold EMAILS_VIEW + EMAILS_SEND)."
