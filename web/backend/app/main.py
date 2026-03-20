"""RAPID Web — FastAPI application factory, health endpoints, and CLI entry point."""

import logging
import socket
import time
import traceback
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter
from pydantic import BaseModel
from sqlmodel import Session, text

from app import __version__
from app.routers.projects import router as projects_router
from app.config import settings
from app.database import get_engine, run_migrations
from app.logging_config import get_logger, setup_logging

logger = get_logger("main")


# ---------------------------------------------------------------------------
# Health / readiness router
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: str
    version: str
    uptime: float


class ReadyResponse(BaseModel):
    status: str
    database: str


health_router = APIRouter(prefix="/api", tags=["health"])


@health_router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    """Lightweight liveness probe — no DB access."""
    uptime = time.time() - request.app.state.start_time
    return HealthResponse(status="ok", version=__version__, uptime=uptime)


@health_router.get("/ready", response_model=ReadyResponse)
async def ready(request: Request) -> JSONResponse:
    """Readiness probe — verifies database connectivity."""
    try:
        with Session(request.app.state.engine) as session:
            session.exec(text("SELECT 1"))
        return JSONResponse(
            content={"status": "ready", "database": "connected"},
            status_code=200,
        )
    except Exception:
        return JSONResponse(
            content={"status": "not_ready", "database": "disconnected"},
            status_code=503,
        )


# ---------------------------------------------------------------------------
# Request-scoped DB dependency
# ---------------------------------------------------------------------------


def get_db(request: Request):
    """Yield a request-scoped SQLModel session from app.state.engine."""
    engine = request.app.state.engine
    with Session(engine) as session:
        yield session


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging(settings.rapid_web_log_dir, settings.rapid_web_log_level)
    engine = get_engine()
    run_migrations(engine)
    app.state.engine = engine
    app.state.start_time = time.time()
    logger.info(
        "RAPID Web service started",
        extra={"port": settings.rapid_web_port, "db_path": str(settings.rapid_web_db_path)},
    )
    yield
    # Shutdown
    app.state.engine.dispose()
    logger.info("RAPID Web service stopped")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    """Build and return the configured FastAPI application."""
    app = FastAPI(title="RAPID Web", version=__version__, lifespan=lifespan)

    # Provide defaults so endpoints work even before lifespan runs (e.g., in tests)
    app.state.start_time = time.time()
    app.state.engine = None

    # CORS — allow Vite dev server origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
    )

    # Global exception handler
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception: %s\n%s", exc, traceback.format_exc())
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    # HTTPException handler for structured JSON errors
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    app.include_router(health_router)
    app.include_router(projects_router)
    return app


# Module-level app instance for uvicorn import
app = create_app()


# ---------------------------------------------------------------------------
# Port conflict detection
# ---------------------------------------------------------------------------


def check_port_available(host: str, port: int) -> None:
    """Raise SystemExit if the given host:port is already in use."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind((host, port))
    except OSError:
        raise SystemExit(f"Port {port} is already in use. Check with: lsof -i :{port}")
    finally:
        sock.close()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def cli_entry() -> None:
    """Entry point for the ``rapid-web`` console script."""
    if not settings.rapid_web:
        print("RAPID Web is disabled. Set RAPID_WEB=true to enable.")
        raise SystemExit(1)

    check_port_available(settings.rapid_web_host, settings.rapid_web_port)
    uvicorn.run(
        "app.main:app",
        host=settings.rapid_web_host,
        port=settings.rapid_web_port,
        log_level="warning",
    )
