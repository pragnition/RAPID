"""Dispatch-latency test for ``POST /api/agents/runs``.

Contract: the HTTP handler returns in <200ms p95 even though the SDK work is
still running — the session runs on ``asyncio.Task`` and is not awaited inside
the handler.

We mock ``AgentSession`` itself so no real subprocess is spawned; we keep the
real ``AgentSessionManager`` so that the production ``start_run`` codepath
(lock acquisition + DB insert + task dispatch) is what we measure.
"""

from __future__ import annotations

import asyncio
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.agents.session_manager import AgentSessionManager
from app.database import Project
from app.main import create_app


@pytest.fixture
def project(tables):
    proj = Project(id=uuid4(), name="t", path="/tmp/testproj")
    with Session(tables) as s:
        s.add(proj)
        s.commit()
        s.refresh(proj)
    return proj


@pytest.fixture
def app(tables, project):
    app = create_app()
    app.state.engine = tables
    # Real manager — lifespan background tasks are NOT started here because we
    # only care about the start_run dispatch path.
    app.state.agent_manager = AgentSessionManager(tables)
    return app


@pytest.fixture
def client(app):
    return TestClient(app)


def test_dispatch_under_200ms_p95(app, client, project):
    # Patch AgentSession to a no-op async context manager so the task that the
    # manager dispatches returns immediately without spawning the SDK.
    class _FakeSession:
        def __init__(self, *a, **kw):
            self.run_id = kw.get("run_id")

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def run(self):
            return None

        async def interrupt(self):
            return None

        async def send_input(self, text):
            return None

    latencies: list[float] = []
    with patch("app.agents.session_manager.AgentSession", _FakeSession):
        for _ in range(20):
            body = {
                "project_id": str(project.id),
                "skill_name": "status",
                "skill_args": {},
                "prompt": "ping",
            }
            t0 = time.monotonic()
            r = client.post("/api/agents/runs", json=body)
            elapsed_ms = (time.monotonic() - t0) * 1000.0
            assert r.status_code == 201, r.text
            latencies.append(elapsed_ms)

    latencies.sort()
    # p95 at N=20 is the 19th (0-indexed 18) sample.
    p95 = latencies[int(0.95 * len(latencies)) - 1]
    assert p95 < 200.0, (
        f"p95 dispatch {p95:.1f}ms exceeds 200ms budget "
        f"(samples={latencies})"
    )
