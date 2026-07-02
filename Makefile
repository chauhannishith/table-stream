COMPOSE := docker compose
COMPOSE_DEV := $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_PROD := $(COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml
ENV_FILE := .env

.PHONY: help env dev dev-sync up down logs ps infra clean

help:
	@echo "Table Stream — Docker targets"
	@echo ""
	@echo "  make env       Copy .env.example → .env if missing"
	@echo "  make dev       Start dev stack (hot reload)"
	@echo "  make dev-sync  Dev stack + PowerSync profile"
	@echo "  make up        Start production-like stack"
	@echo "  make down      Stop all services"
	@echo "  make logs      Follow container logs"
	@echo "  make ps        Show running services"
	@echo "  make infra     Postgres + Redis only"
	@echo "  make clean     Stop and remove volumes"

env:
	@test -f $(ENV_FILE) || cp .env.example $(ENV_FILE)
	@echo "Using $(ENV_FILE)"

dev: env
	$(COMPOSE_DEV) up --build

dev-sync: env
	$(COMPOSE_DEV) --profile sync up --build

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
