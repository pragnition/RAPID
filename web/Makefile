.PHONY: dev dev-backend dev-frontend install install-backend install-frontend build

install: install-backend install-frontend

install-backend:
	cd backend && uv sync

install-frontend:
	cd frontend && npm install

dev:
	@echo "Starting backend (port 8998) and frontend (port 5173)..."
	@trap 'kill 0' EXIT; \
	cd backend && RAPID_WEB=true uv run uvicorn app.main:app --host 0.0.0.0 --port 8998 --reload & \
	cd frontend && npm run dev & \
	wait

dev-backend:
	cd backend && RAPID_WEB=true uv run uvicorn app.main:app --host 0.0.0.0 --port 8998 --reload

dev-frontend:
	cd frontend && npm run dev

build:
	cd frontend && npm run build
