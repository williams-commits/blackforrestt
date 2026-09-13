ROOT := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
DC := docker compose --env-file $(ROOT)/.env.production -f $(ROOT)/deploy/docker-compose.prod.yml

# .PHONY is required: e.g. the deploy/ directory would otherwise make Make
# consider the "deploy" target already up to date and silently skip its recipe.
.PHONY: help build build-no-cache deploy update restart-app only-env dev dev-agile dev-open-agile stop \
        ps logs log-app log-caddy log-crm health diagnose preflight auth-doctor env-verify \
        psql crm-psql studio migrate crm-migrate seed crm-seed crm-grant promote-admin \
        backup restore test test-fast lint typecheck \
        caddy-render caddy-validate down

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ── Deploy & lifecycle ────────────────────────────────────────────────────────

build: ## Build production images (app + malware-scanner)
	$(DC) build app malware-scanner

build-no-cache: ## Build without Docker layer cache (after big changes)
	$(DC) build --no-cache app malware-scanner

deploy: ## Full deploy: build, migrate, seed, preflight, start (deploy.sh)
	bash $(ROOT)/deploy/deploy.sh

update: ## Routine update: pull code, rebuild app + crm, restart both + caddy
	git pull && $(DC) build app crm && $(DC) up -d app crm caddy

restart-app: ## Restart the app container only (no rebuild, no seed)
	$(DC) restart app

only-env: ## Recreate app from .env.production changes (no rebuild)
	$(DC) up -d --no-deps --force-recreate app

down: ## Stop the whole production stack
	$(DC) down

# ── Local development ─────────────────────────────────────────────────────────

dev: ## Run the Next.js dev server (primary brand at http://localhost:3000)
	npm run dev

dev-agile: ## Dev server + open the AgileFGS brand (http://agilefgs.localhost:3000)
	npm run dev

dev-open-agile: ## Open the AgileFGS local site in your browser (server must be running)
	@echo "AgileFGS  → http://agilefgs.localhost:3000"
	@echo "BlackForest → http://localhost:3000"
	@if command -v open >/dev/null 2>&1; then open http://agilefgs.localhost:3000; fi

stop: ## Stop whatever is running on port 3000
	npm run stop:server

# ── Status & logs ─────────────────────────────────────────────────────────────

ps: ## Status of all services
	$(DC) ps

logs: ## Tail app + caddy logs together
	$(DC) logs -f app caddy

log-app: ## Tail app logs
	$(DC) logs -f app

log-caddy: ## Tail caddy (proxy/TLS) logs
	$(DC) logs -f caddy

log-crm: ## Tail CRM app logs
	$(DC) logs -f crm

diagnose: ## Layer-by-layer outage diagnostic (seed, logs, health, ports)
	@echo "=== 1. Is deploy.sh current (has seed + CRM steps)? ==="
	@grep -q "db:seed" $(ROOT)/deploy/deploy.sh && echo "[OK] seed step present" || echo "[FAIL] OLD deploy.sh — git pull"
	@echo "=== 2. Why is the app failing? (last 40 log lines) ==="
	@$(DC) logs --tail=40 app
	@echo "=== 3. Did instruments get seeded? (expect 45) ==="
	@$(DC) exec -T postgres psql -U $${POSTGRES_USER:-blackforrestt} -d blackforrestt -c 'SELECT COUNT(*) AS instruments FROM "Instrument";'
	@echo "=== 4. App container status (restart-looping?) ==="
	@docker ps -a --filter "name=app" --format '{{.Names}}\t{{.Status}}'
	@echo "=== 5. What does the health endpoint say? ==="
	@$(DC) exec app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log).catch(e=>console.error(e.message))"
	@echo "=== 6. Are 80/443 bound? ==="
	@sudo ss -ltnp | grep -E ':80|:443' || echo "(nothing on 80/443 — Caddy not started)"

preflight: ## Fail-closed production readiness check (same gate deploy.sh runs)
	$(DC) run --rm app npm run production:check

auth-doctor: ## Verify Auth.js origin, DB, identities, admins, Redis
	$(DC) exec app npm run auth:doctor

env-verify: ## Check .env.production for leftover placeholders
	@grep -nE "replace-with|resend_api_key_goes_here|ChangeMe" $(ROOT)/.env.production && { echo "[FAIL] placeholders remain — fix before deploying"; exit 1; } || echo "[OK] no placeholders found

health: ## Hit the public health endpoint
	curl -sS https://$(shell grep -E '^DOMAIN=' $(ROOT)/.env.production | head -1 | cut -d= -f2)/api/health; echo

# ── Database & admin operations ──────────────────────────────────────────────

psql: ## Interactive PostgreSQL shell in the postgres container
	$(DC) exec postgres psql -U $${POSTGRES_USER:-blckforest} -d $${POSTGRES_DB:-blckforest}

studio: ## Prisma Studio on 127.0.0.1:5555 (SSH-tunnel: ssh -L 5555:localhost:5555 host)
	$(DC) run --rm --no-deps -p 127.0.0.1:5555:5555 app npx prisma studio --hostname 0.0.0.0 --port 5555

migrate: ## Apply pending Prisma migrations (same step deploy.sh runs)
	$(DC) run --rm app npx prisma migrate deploy

seed: ## (Re)seed tradeable instruments — idempotent
	$(DC) run --rm app npm run db:seed

promote-admin: ## Promote an admin: make promote-admin E=user@example.com
	@if [ -z "$(E)" ]; then echo "Usage: make promote-admin E=<email>"; exit 1; fi
	$(DC) exec app node --import tsx scripts/promote-admin.ts $(E)

# ── CRM module operations (blckforest_crm database) ──────────────────────────

crm-psql: ## Interactive PostgreSQL shell in the CRM database
	$(DC) exec postgres psql -U $${POSTGRES_USER:-blackforrestt} -d blckforest_crm

crm-migrate: ## Apply pending CRM Prisma migrations (deploy.sh runs this too)
	$(DC) run --rm crm npx prisma migrate deploy

crm-grant: ## Roll out new CRM role permissions additively (idempotent)
	bash $(ROOT)/deploy/crm-grant-permissions.sh

crm-seed: ## Bootstrap the CRM database (roles + first demo users) — change passwords after!
	docker build --target builder -t blckforest-crm-seed:tmp $(ROOT)/crm
	NET=$$(docker network ls --filter label=com.docker.compose.project=$(notdir $(ROOT)) --format '{{.Name}}' | grep backend | head -1); \
	CRM_DB=$$(sed -n 's/^CRM_DATABASE_URL=//p' $(ROOT)/.env.production | head -1); \
	PGPWD=$$(sed -n 's/^POSTGRES_PASSWORD=//p' $(ROOT)/.env.production | head -1); \
	docker run --rm --network $$NET \
	  -e DATABASE_URL="$${CRM_DB:-postgresql://blackforrestt:$${PGPWD}@postgres:5432/blckforest_crm}" \
	  blckforest-crm-seed:tmp node --import tsx prisma/seed.ts

# ── Backup & restore ─────────────────────────────────────────────────────────

backup: ## Backup database + volumes (deploy/backup.sh)
	$(ROOT)/deploy/backup.sh

restore: ## Restore from backup (DESTRUCTIVE — deploy/restore.sh)
	$(ROOT)/deploy/restore.sh

# ── Validation ───────────────────────────────────────────────────────────────

test: ## Full test matrix: unit + integration
	npm run test:unit && npm run test:integration

test-fast: ## Quick suites: multibrand + admin + payments + email
	npm run test:multibrand && npm run test:admin && npm run test:payments && npm run test:email-templates

lint: ## ESLint (zero warnings enforced)
	npm run lint

typecheck: ## TypeScript strict check
	npm run typecheck

# ── Multi-brand / proxy helpers ──────────────────────────────────────────────

caddy-render: ## Re-render Caddyfile.rendered from .env.production
	bash $(ROOT)/deploy/render-caddy.sh $(ROOT)/.env.production

caddy-validate: ## Validate the rendered Caddy config with the official image
	docker run --rm -v $(ROOT)/deploy/Caddyfile.rendered:/etc/caddy/Caddyfile:ro \
		caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile

# Simple nano 
clear-env-production:
	: > .env.production

# Git 