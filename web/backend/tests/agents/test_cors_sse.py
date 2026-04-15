"""SSE response header smoke test."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture(autouse=True)
def _reset_sse_starlette_event():
    from sse_starlette import sse as _sse

    _sse.AppStatus.should_exit = False
    _sse.AppStatus.should_exit_event = None
    yield
    _sse.AppStatus.should_exit = False
    _sse.AppStatus.should_exit_event = None


@pytest.fixture
def app(tables):
    app = create_app()
    app.state.engine = tables
    app.state.agent_manager = SimpleNamespace()

    async def _attach(run_id, since=0):
        if False:
            yield

    app.state.agent_manager.attach_events = _attach
    return app


@pytest.fixture
def client(app):
    return TestClient(app)


def test_sse_endpoint_headers(client):
    run_id = uuid4()
    with client.stream("GET", f"/api/agents/runs/{run_id}/events") as resp:
        assert resp.status_code == 200
        # sse-starlette uses text/event-stream
        assert resp.headers["content-type"].startswith("text/event-stream")
        assert resp.headers["cache-control"].lower().startswith("no-cache")
        assert resp.headers["x-accel-buffering"] == "no"
        # drain
        b"".join(resp.iter_bytes())
