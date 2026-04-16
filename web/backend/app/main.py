"""RAPID Web — FastAPI application factory, health endpoints, and CLI entry point."""

import logging
import socket
import time
import traceback
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.routing import APIRouter
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlmodel import Session, text

from app import __version__
from app.agents import AgentSessionManager, install_agent_error_handlers
from app.routers.agents import router as agents_router
from app.routers.chats import router as chats_router
from app.routers.dashboard import router as dashboard_router
from app.routers.kanban import router as kanban_router
from app.routers.notes import router as notes_router
from app.routers.projects import router as projects_router
from app.routers.skills import router as skills_router
from app.routers.views import router as views_router
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

    # Start file watcher for project monitoring
    from app.services.file_watcher import FileWatcherService

    watcher = FileWatcherService(engine)
    watcher.start()
    app.state.file_watcher = watcher

    # Start the agent session manager (owns SDK clients + orphan sweeper + archive)
    agent_manager = AgentSessionManager(engine)
    await agent_manager.start()
    app.state.agent_manager = agent_manager

    # Start the autopilot worker (polls autopilot-enabled kanban columns)
    from app.agents.autopilot_worker import AutopilotWorker

    autopilot = AutopilotWorker(engine, agent_manager)
    await autopilot.start()
    app.state.autopilot_worker = autopilot

    # Load skill catalog from skills/ directory
    from app.services.skill_catalog_service import SkillCatalogService
    from app.services.skill_catalog_watcher import SkillCatalogWatcher

    skills_root = Path(__file__).resolve().parents[3] / "skills"
    skill_catalog_service = SkillCatalogService()
    skill_catalog_service.load_initial(skills_root)
    app.state.skill_catalog_service = skill_catalog_service

    # Hot-reload watcher (only in dev mode)
    if settings.rapid_dev:
        skill_watcher = SkillCatalogWatcher(skills_root, skill_catalog_service)
        skill_watcher.start()
        app.state.skill_catalog_watcher = skill_watcher

    logger.info(
        "RAPID Web service started",
        extra={"port": settings.rapid_web_port, "db_path": str(settings.rapid_web_db_path)},
    )
    yield
    # Shutdown
    if hasattr(app.state, "skill_catalog_watcher") and app.state.skill_catalog_watcher:
        app.state.skill_catalog_watcher.stop()
    if hasattr(app.state, "file_watcher") and app.state.file_watcher:
        app.state.file_watcher.stop()
    if hasattr(app.state, "autopilot_worker") and app.state.autopilot_worker:
        await app.state.autopilot_worker.stop()
    if hasattr(app.state, "agent_manager") and app.state.agent_manager:
        await app.state.agent_manager.stop()
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
    app.state.agent_manager = None

    # CORS — origins configurable via RAPID_WEB_CORS_ALLOW_ORIGINS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.rapid_web_cors_allow_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
    )

    # Request/response logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000
        path = request.url.path
        if not path.startswith(("/api/health", "/api/ready", "/assets/")):
            logger.info(
                "request",
                extra={
                    "method": request.method,
                    "path": path,
                    "status": response.status_code,
                    "duration_ms": round(duration_ms, 1),
                },
            )
        return response

    # Global exception handler
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception: %s\n%s", exc, traceback.format_exc())
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    # HTTPException handler for structured JSON errors
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    # Install the agent-runtime error taxonomy handlers (StateError -> 409, etc.)
    install_agent_error_handlers(app)

    app.include_router(health_router)
    app.include_router(projects_router)
    app.include_router(views_router)
    app.include_router(kanban_router)
    app.include_router(notes_router)
    app.include_router(agents_router)
    app.include_router(skills_router)
    app.include_router(chats_router)
    app.include_router(dashboard_router)

    # Serve frontend static files if the dist directory exists
    frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
    if frontend_dist.is_dir():
        app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="static")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            """Serve the SPA index.html for all non-API routes."""
            file_path = frontend_dist / full_path
            if file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(frontend_dist / "index.html")

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
