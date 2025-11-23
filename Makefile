# Makefile for Christmas Wishlist App

.PHONY: help build up down restart logs logs-frontend logs-backend backup restore clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build Docker containers
	docker-compose build

up: ## Start all services in foreground
	docker-compose up --build

up-d: ## Start all services in background
	docker-compose up -d --build

down: ## Stop all services (keeps data)
	docker-compose down

down-v: ## Stop all services and remove volumes (DELETES DATA!)
	@echo "WARNING: This will delete all data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v; \
	fi

restart: ## Restart all services
	docker-compose restart

restart-frontend: ## Restart frontend only
	docker-compose restart frontend

restart-backend: ## Restart backend only
	docker-compose restart backend

logs: ## Show logs from all services
	docker-compose logs -f

logs-frontend: ## Show logs from frontend
	docker-compose logs -f frontend

logs-backend: ## Show logs from backend
	docker-compose logs -f backend

ps: ## Show running containers
	docker-compose ps

backup: ## Backup PocketBase database
	@mkdir -p backups
	docker run --rm \
		-v wishlist_pocketbase-data:/data \
		-v $$(pwd)/backups:/backup \
		alpine tar czf /backup/pb-backup-$$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
	@echo "Backup created in backups/"

restore: ## Restore PocketBase database (set BACKUP_FILE=filename)
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "Error: BACKUP_FILE not set"; \
		echo "Usage: make restore BACKUP_FILE=backups/pb-backup-YYYYMMDD-HHMMSS.tar.gz"; \
		exit 1; \
	fi
	docker run --rm \
		-v wishlist_pocketbase-data:/data \
		-v $$(pwd)/backups:/backup \
		alpine sh -c "cd /data && tar xzf /backup/$$(basename $(BACKUP_FILE))"
	@echo "Restored from $(BACKUP_FILE)"
	docker-compose restart backend

clean: ## Remove all containers, images, and volumes
	@echo "WARNING: This will remove all Docker resources for this project!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v; \
		docker-compose rm -f; \
		docker images | grep wishlist | awk '{print $$3}' | xargs docker rmi -f 2>/dev/null || true; \
	fi

dev: ## Run in development mode (local, no Docker)
	@echo "Starting development servers..."
	@echo "Backend: http://127.0.0.1:8090"
	@echo "Frontend: http://localhost:3000"
	@echo ""
	@echo "In one terminal, run: cd backend && ./pocketbase serve"
	@echo "In another terminal, run: cd frontend && npm run dev"

shell-frontend: ## Open shell in frontend container
	docker-compose exec frontend sh

shell-backend: ## Open shell in backend container
	docker-compose exec backend sh

rebuild: ## Rebuild everything from scratch (no cache)
	docker-compose build --no-cache
	docker-compose up -d

health: ## Check health status of all services
	@docker-compose ps
	@echo ""
	@echo "Backend health:"
	@curl -s http://localhost/_/api/health || echo "Backend not responding"
	@echo ""
	@echo "Frontend health:"
	@curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost/ || echo "Frontend not responding"
