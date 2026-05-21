.PHONY: help install dev build test lint format clean

help:
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

install: ## Install all dependencies
	pnpm install

PORT := 5090

dev: ## Start web dev server (kill port if occupied, then open browser)
	@lsof -ti:$(PORT) | xargs kill -9 2>/dev/null || true
	@pnpm --filter @llm-observability/web dev & sleep 3 && open http://localhost:$(PORT)

build: ## Build all packages
	pnpm -r run build

build-shared: ## Build shared package only
	pnpm --filter @llm-observability/shared build

test: ## Run all tests
	vitest run

test-watch: ## Interactive test watch
	vitest

lint: ## Lint all packages
	pnpm -r run lint

format: ## Format all files
	prettier --write "**/*.{ts,tsx,json,md}"

clean: ## Clean all build artifacts
	pnpm -r run clean
