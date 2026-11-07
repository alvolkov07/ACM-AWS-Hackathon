# Common developer commands for this monorepo.

.PHONY: up down seed reset-db test lint deploy

## up: Start local MongoDB (replica set) and wait until healthy
up:
	docker compose up -d --wait

## down: Stop local Docker Compose services
down:
	docker compose down

## seed: Load fictional agri-supply catalog data into MongoDB
seed:
	npm --prefix web run seed

## reset-db: Drop the app database, then re-seed catalog data
reset-db:
	npm --prefix web run reset-db

## test: Run the web app test suite
test:
	npm --prefix web run test

## lint: Run web lint and TypeScript checks
lint:
	npm --prefix web run lint
	npm --prefix web run typecheck

## deploy: Deploy the app (CI/CD or documented release steps)
deploy:
	@echo "not implemented yet"
