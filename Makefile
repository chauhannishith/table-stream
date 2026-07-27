COMPOSE := docker compose
COMPOSE_DEV := $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_PROD := $(COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml
ENV_FILE := .env

.PHONY: help env check dev dev-sync up down logs ps infra clean bootstrap-admin pairing-code dev-setup

help:
	@echo "Table Stream — Docker targets"
	@echo ""
	@echo "  make check           Typecheck, lint, and test (local, no Docker)"
	@echo "  make env               Copy .env.example → .env if missing"
	@echo "  make dev               Start dev stack (hot reload)"
	@echo "  make dev-sync          Dev stack + PowerSync profile"
	@echo "  make up                Start production-like stack"
	@echo "  make bootstrap-admin   Register CODE + dev ADMIN PIN (CODE=123456)"
	@echo "  make dev-setup         Issue one code, bootstrap admin, print steps"
	@echo "  make pairing-code      Print a 6-digit hub pairing code only"
	@echo "  make down              Stop all services"
	@echo "  make logs      Follow container logs"
	@echo "  make ps        Show running services"
	@echo "  make infra     Postgres + Redis only"
	@echo "  make clean     Stop and remove volumes"

env:
	@test -f $(ENV_FILE) || cp .env.example $(ENV_FILE)
	@echo "Using $(ENV_FILE)"

check:
	pnpm typecheck
	pnpm lint
	pnpm test

dev: env
	$(COMPOSE_DEV) up --build

dev-sync: env
	$(COMPOSE_DEV) --profile sync up --build

bootstrap-admin: env
ifndef CODE
	$(error Usage: make bootstrap-admin CODE=123456 — registers pairing code + dev admin PIN)
endif
	@curl -sf -X POST http://localhost:8443/v1/devices/pairing-codes \
		-H 'Content-Type: application/json' \
		-d '{"pairing_code":"$(CODE)"}' > /dev/null
	$(COMPOSE_DEV) exec -e DEV_ADMIN_PIN=$(CODE) edge-server pnpm --filter @table-stream/edge-server bootstrap-admin $(CODE)

pairing-code: env
	@curl -sf -X POST http://localhost:8443/v1/devices/pairing-codes

dev-setup: env
	@CODE=$$(curl -sf -X POST http://localhost:8443/v1/devices/pairing-codes | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).pairing_code))") && \
	$(COMPOSE_DEV) exec -e DEV_ADMIN_PIN=$$CODE edge-server pnpm --filter @table-stream/edge-server bootstrap-admin $$CODE && \
	echo "" && echo "Use $$CODE on the pairing screen and as Dev Admin PIN (device role: Counter)."

up: env
	$(COMPOSE_PROD) up --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

infra: env
	$(COMPOSE) up postgres redis

clean:
	$(COMPOSE) down -v
