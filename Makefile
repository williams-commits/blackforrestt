ROOT := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
DC := docker compose --env-file $(ROOT)/.env.production -f $(ROOT)/deploy/docker-compose.prod.yml

# .PHONY is required: the deploy/ directory would otherwise make Make consider
# the "deploy" target already up to date and silently skip its recipe.
.PHONY: build-no-cache deploy backup only-env

build-no-cache:
	$(DC) build --no-cache app malware-scanner

deploy:
	bash $(ROOT)/deploy/deploy.sh

backup:
	$(ROOT)/deploy/backup.sh

only-env:
	$(DC) up -d --no-deps --force-recreate app
