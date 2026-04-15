"""Tests for Criterion 13 — CORS origins configurable from environment."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app import config as app_config
from app import main as app_main
from app.config import Settings


def test_cors_allow_origins_parsed_from_env(monkeypatch):
    """RAPID_WEB_CORS_ALLOW_ORIGINS is JSON-parsed into a list[str]."""
    monkeypatch.setenv(
        "RAPID_WEB_CORS_ALLOW_ORIGINS",
        '["https://a.example.com","https://b.example.com"]',
    )
    s = Settings()
    assert s.rapid_web_cors_allow_origins == [
        "https://a.example.com",
        "https://b.example.com",
    ]


def test_cors_middleware_honors_settings_override(monkeypatch):
    """CORSMiddleware picks up the configured origins at create_app() time."""
    monkeypatch.setattr(
        app_config.settings,
        "rapid_web_cors_allow_origins",
        ["https://app.example.com"],
    )
    app = app_main.create_app()
    with TestClient(app) as client:
        # Allowed origin — preflight must echo it back.
        allowed = client.options(
            "/api/health",
            headers={
                "Origin": "https://app.example.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert allowed.headers.get("access-control-allow-origin") == "https://app.example.com"

        # Disallowed origin (the old default) — header must be absent.
        denied = client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert "access-control-allow-origin" not in denied.headers
