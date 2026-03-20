"""Tests for app/main.py — app factory, endpoints, port check, CLI entry."""

import socket
import time
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, SQLModel, create_engine, text

from app import __version__
from app.main import check_port_available, cli_entry, create_app, health_router


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def test_engine(tmp_path):
    """In-memory SQLite engine with tables created."""
    db_path = tmp_path / "test.db"
    eng = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(eng)
    return eng


@pytest.fixture()
def test_app(test_engine):
    """A FastAPI app with engine and start_time set (no lifespan)."""
    app = create_app()
    app.state.engine = test_engine
    app.state.start_time = time.time()
    return app


@pytest.fixture()
def async_client(test_app):
    """httpx AsyncClient wired to the test app via ASGITransport."""
    transport = httpx.ASGITransport(app=test_app, raise_app_exceptions=False)
    return httpx.AsyncClient(transport=transport, base_url="http://testserver")


# ---------------------------------------------------------------------------
# App factory tests
# ---------------------------------------------------------------------------

class TestCreateApp:
    def test_returns_fastapi(self):
        app = create_app()
        assert isinstance(app, FastAPI)

    def test_has_cors_middleware(self):
        app = create_app()
        # CORSMiddleware wraps the app in middleware stack
        middleware_classes = [m.cls for m in app.user_middleware]
        assert CORSMiddleware in middleware_classes

    def test_includes_health_router(self):
        app = create_app()
        paths = [route.path for route in app.routes]
        assert "/api/health" in paths
        assert "/api/ready" in paths


# ---------------------------------------------------------------------------
# Endpoint tests (async)
# ---------------------------------------------------------------------------

class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_endpoint_200(self, async_client):
        resp = await async_client.get("/api/health")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_health_response_version_matches(self, async_client):
        resp = await async_client.get("/api/health")
        data = resp.json()
        assert data["version"] == __version__

    @pytest.mark.asyncio
    async def test_health_response_uptime_positive(self, async_client):
        resp = await async_client.get("/api/health")
        data = resp.json()
        assert data["uptime"] >= 0


class TestReadyEndpoint:
    @pytest.mark.asyncio
    async def test_ready_endpoint_connected(self, async_client):
        resp = await async_client.get("/api/ready")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ready"
        assert data["database"] == "connected"

    @pytest.mark.asyncio
    async def test_ready_endpoint_disconnected(self, test_app):
        """When the engine is broken, /ready returns 503."""
        # Create a mock engine whose Session raises
        mock_engine = MagicMock()
        mock_engine.connect.side_effect = Exception("no db")
        # Make Session(mock_engine) raise
        test_app.state.engine = None  # Session(None) will raise
        transport = httpx.ASGITransport(app=test_app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp = await client.get("/api/ready")
        assert resp.status_code == 503
        data = resp.json()
        assert data["status"] == "not_ready"


# ---------------------------------------------------------------------------
# Exception handler tests
# ---------------------------------------------------------------------------

class TestExceptionHandlers:
    @pytest.mark.asyncio
    async def test_unhandled_exception_returns_500(self, test_app):
        @test_app.get("/raise-unhandled")
        async def _raise():
            raise RuntimeError("boom")

        transport = httpx.ASGITransport(app=test_app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp = await client.get("/raise-unhandled")
        assert resp.status_code == 500
        assert "boom" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_http_exception_returns_structured_json(self, test_app):
        from fastapi import HTTPException

        @test_app.get("/raise-http")
        async def _raise():
            raise HTTPException(status_code=404, detail="not found")

        transport = httpx.ASGITransport(app=test_app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp = await client.get("/raise-http")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "not found"


# ---------------------------------------------------------------------------
# Port availability tests
# ---------------------------------------------------------------------------

class TestCheckPortAvailable:
    def test_succeeds_on_free_port(self):
        # Find a free port by binding to 0
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            free_port = s.getsockname()[1]
        # Port is now free again
        check_port_available("127.0.0.1", free_port)  # should not raise

    def test_raises_on_busy_port(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(("127.0.0.1", 0))
            busy_port = s.getsockname()[1]
            s.listen(1)
            with pytest.raises(SystemExit):
                check_port_available("127.0.0.1", busy_port)

    def test_error_message_actionable(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(("127.0.0.1", 0))
            busy_port = s.getsockname()[1]
            s.listen(1)
            with pytest.raises(SystemExit, match=f"Port {busy_port}.*lsof"):
                check_port_available("127.0.0.1", busy_port)


# ---------------------------------------------------------------------------
# CLI entry tests
# ---------------------------------------------------------------------------

class TestCliEntry:
    def test_cli_entry_disabled_raises_system_exit(self):
        with patch("app.main.settings") as mock_settings:
            mock_settings.rapid_web = False
            with pytest.raises(SystemExit):
                cli_entry()

    def test_cli_entry_calls_uvicorn_when_enabled(self):
        with (
            patch("app.main.settings") as mock_settings,
            patch("app.main.check_port_available"),
            patch("app.main.uvicorn") as mock_uvicorn,
        ):
            mock_settings.rapid_web = True
            mock_settings.rapid_web_host = "127.0.0.1"
            mock_settings.rapid_web_port = 8998
            cli_entry()
            mock_uvicorn.run.assert_called_once_with(
                "app.main:app",
                host="127.0.0.1",
                port=8998,
                log_level="warning",
            )
