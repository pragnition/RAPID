"""FastAPI lifespan smoke test — confirms ``AgentSessionManager`` wiring."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.agents.session_manager import AgentSessionManager


def test_lifespan_starts_and_stops_manager(tmp_path, monkeypatch):
    # Redirect DB + projects file to tmp so the lifespan does not touch
    # ~/.rapid state.
    db_path = tmp_path / "lifespan.db"
    projects_file = tmp_path / "projects.json"
    projects_file.write_text("[]")

    from app import config as app_config
    from app import database as app_database
    from app import main as app_main

    monkeypatch.setattr(app_config.settings, "rapid_web_db_path", db_path)
    monkeypatch.setattr(
        app_config.settings, "rapid_web_projects_file", projects_file
    )
    # Reset cached engine (get_engine memoizes at module scope)
    monkeypatch.setattr(app_database, "_engine", None, raising=False)

    app = app_main.create_app()

    with TestClient(app) as client:
        mgr = client.app.state.agent_manager
        assert isinstance(mgr, AgentSessionManager)
        assert mgr._orphan_sweep_task is not None
        assert mgr._archive_task is not None
        resp = client.get("/api/health")
        assert resp.status_code == 200

    assert mgr._stopping.is_set() is True
