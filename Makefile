ROOT := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
DC := docker compose --env-file $(ROOT)/.env.production -f $(ROOT)/deploy/docker-compose.prod.yml

# .PHONY is required: e.g. the deploy/ directory would otherwise make Make
# consider the "deploy" target already up to date and silently skip its recipe.
.PHONY: help build build-no-cache deploy update restart-app only-env dev dev-agile dev-open-agile stop \
        ps logs log-app log-caddy health \
        psql studio migrate seed promote-admin \
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

update: ## Routine update: pull code, rebuild app, restart app + caddy
	git pull && $(DC) build app && $(DC) up -d app caddy

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
