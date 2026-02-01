.PHONY: dev lint test

dev:
	docker compose up -d

lint:
	ruff check services/ shared/

lint-fix:
	ruff check --fix services/ shared/

test:
	pytest services/ shared/ -v
