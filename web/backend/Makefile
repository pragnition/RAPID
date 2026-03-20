.PHONY: install dev test lint fmt check clean

install:
	uv sync

dev:
	RAPID_WEB=true uv run uvicorn app.main:app --host 127.0.0.1 --port 8998 --reload

test:
	uv run pytest -v

lint:
	uv run ruff check .

fmt:
	uv run ruff format .

check: lint test

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache .ruff_cache
