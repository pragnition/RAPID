"""End-to-end smoke tests against a real ``claude`` CLI.

Gated on ``claude`` being present on ``$PATH``. Marked ``slow``; CI is free to
skip. Exercises the full chain: FastAPI route → AgentSessionManager →
AgentSession → claude-agent-sdk subprocess → SSE stream.
"""

from __future__ import annotations

import asyncio
import json
import shutil
import time
from uuid import uuid4

import httpx
import pytest
from sqlmodel import Session

from app.database import Project
from app.main import create_app

pytestmark = [
    pytest.mark.slow,
    pytest.mark.skipif(
        shutil.which("claude") is None,
        reason="claude CLI not on PATH",
    ),
]


@pytest.fixture
def project_dir(tmp_path):
    (tmp_path / "CLAUDE.md").write_text(
        "Say the single word 'pong' when prompted and then stop.\n"
    )
    return tmp_path


@pytest.fixture
async def app(tables, project_dir):
    from app.agents.session_manager import AgentSessionManager

    app = create_app()
    app.state.engine = tables
    mgr = AgentSessionManager(tables)
    await mgr.start()
    app.state.agent_manager = mgr

    with Session(tables) as s:
        proj = Project(id=uuid4(), name="smoke", path=str(project_dir))
        s.add(proj)
        s.commit()
        s.refresh(proj)

    app.state._smoke_project_id = str(proj.id)
    yield app
    await mgr.stop()


@pytest.fixture
async def http_client(app):
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://smoke"
    ) as ac:
        yield ac


@pytest.mark.asyncio
async def test_real_sdk_hello_world(app, http_client):
    body = {
        "project_id": app.state._smoke_project_id,
        "skill_name": "status",
        "skill_args": {},
        "prompt": "Say 'pong'.",
    }
    r = await http_client.post("/api/agents/runs", json=body)
    assert r.status_code == 201, r.text
    run_id = r.json()["id"]

    events: list[dict] = []
    run_complete = None
    deadline = time.monotonic() + 30.0
    async with http_client.stream(
        "GET", f"/api/agents/runs/{run_id}/events"
    ) as sse:
        async for line in sse.aiter_lines():
            if time.monotonic() > deadline:
                break
            if not line.startswith("data:"):
                continue
            payload = json.loads(line[len("data:") :].strip())
            events.append(payload)
            if payload.get("kind") == "run_complete":
                run_complete = payload
                break

    assert any(e.get("kind") == "assistant_text" for e in events), events
    assert run_complete is not None, events
    assert run_complete["status"] == "completed"
    assert run_complete["turn_count"] >= 1
    assert run_complete["total_cost_usd"] > 0

    # Final row reflects completed state
    r2 = await http_client.get(f"/api/agents/runs/{run_id}")
    assert r2.status_code == 200
    assert r2.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_interrupt_mid_run(app, http_client):
    body = {
        "project_id": app.state._smoke_project_id,
        "skill_name": "status",
        "skill_args": {},
        "prompt": "Count slowly from 1 to 20, one number per line.",
    }
    r = await http_client.post("/api/agents/runs", json=body)
    assert r.status_code == 201
    run_id = r.json()["id"]

    # Wait for first assistant_text or 10s
    got_first = False
    deadline = time.monotonic() + 10.0
    async with http_client.stream(
        "GET", f"/api/agents/runs/{run_id}/events"
    ) as sse:
        async for line in sse.aiter_lines():
            if time.monotonic() > deadline:
                break
            if not line.startswith("data:"):
                continue
            payload = json.loads(line[len("data:") :].strip())
            if payload.get("kind") == "assistant_text":
                got_first = True
                break

    assert got_first, "did not receive any assistant_text before interrupt"

    ir = await http_client.post(f"/api/agents/runs/{run_id}/interrupt")
    assert ir.status_code == 200

    # Wait up to 15s for run_complete with status=interrupted
    deadline = time.monotonic() + 15.0
    final = None
    async with http_client.stream(
        "GET", f"/api/agents/runs/{run_id}/events"
    ) as sse:
        async for line in sse.aiter_lines():
            if time.monotonic() > deadline:
                break
            if not line.startswith("data:"):
                continue
            payload = json.loads(line[len("data:") :].strip())
            if payload.get("kind") == "run_complete":
                final = payload
                break

    assert final is not None
    assert final["status"] == "interrupted"
