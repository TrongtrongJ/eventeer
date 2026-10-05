.PHONY: help install infra up down logs reset seed test e2e

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-12s %s\n", $$1, $$2}'

install: ## Install dependencies (Yarn 4 via Corepack)
	corepack enable && yarn install

infra: ## Start Postgres + Redis only (run the apps natively with `yarn dev`)
	docker compose up -d postgres redis

up: ## Start everything in containers (API + web + Postgres + Redis)
	docker compose --profile app up --build

down: ## Stop containers
	docker compose --profile app down

reset: ## Stop containers and DELETE all data volumes
	docker compose --profile app down -v

logs: ## Tail container logs
	docker compose --profile app logs -f

seed: ## Load demo users, events and coupons
	yarn seed:demo

test: ## Unit tests
	yarn test

e2e: ## Backend integration tests (needs `make infra`)
	yarn test:e2e
