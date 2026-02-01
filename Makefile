.PHONY: help install dev build clean stop logs

help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

install: ## Install dependencies
	pnpm install

dev: ## Start all services in development mode
	docker-compose up

dev-detached: ## Start all services in background
	docker-compose up -d

build: ## Build all Docker images
	docker-compose build

stop: ## Stop all services
	docker-compose down

clean: ## Stop services and remove volumes
	docker-compose down -v

logs: ## View logs from all services
	docker-compose logs -f

logs-backend: ## View backend logs only
	docker-compose logs -f backend

logs-frontend: ## View frontend logs only
	docker-compose logs -f frontend

restart: ## Restart all services
	docker-compose restart

restart-backend: ## Restart backend only
	docker-compose restart backend

restart-frontend: ## Restart frontend only
	docker-compose restart frontend

shell-backend: ## Open shell in backend container
	docker-compose exec backend sh

shell-frontend: ## Open shell in frontend container
	docker-compose exec frontend sh

ps: ## Show running containers
	docker-compose ps

setup-db: ## Setup local PostgreSQL database
	@echo "Creating database..."
	psql -U postgres -c "CREATE DATABASE event_management;" || true
	@echo "Database ready!"

seed: ## Seed demo data (requires backend to be running)
	docker-compose exec backend npx ts-node scripts/seed-db.ts