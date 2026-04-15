# Wave 4 PLAN: HTTP Surface + Integration

**Set:** agent-runtime-foundation
**Wave:** 4 of 4 — HTTP Surface + Integration
**Working root:** `web/backend/`

## Objective

Expose the agent-runtime contract over HTTP/SSE, wire the `AgentSessionManager` into FastAPI lifespan, add the `claude-agent-sdk` and `sse-starlette` dependencies, and prove the end-to-end contract with a dispatch-latency test and an SDK-smoke integration test. This is the final contract freeze for Wave 1 consumers (web-tool-bridge, skill-invocation-ui, kanban-autopilot, agents-chats-tabs): after this wave the POST/GET/SSE surface is stable and additive-only.

## Prerequisite: Waves 1, 2, 3 artifacts must exist

Required symbols imported via `from app.agents import ...`: `AgentSessionManager`, `EventBus`, `build_sdk_options`, `install_agent_error_handlers`, `StateError`, `RunError`, `SdkError`, `RETRYABLE_ERROR_CODES`. Models `AgentRun`, `AgentEvent` must be migrated.

## Tasks

### Task 1 — Add SDK + SSE dependencies to `pyproject.toml`

**File to edit:** `web/backend/pyproject.toml` (OWNED EXCLUSIVELY BY WAVE 4)

**Change:** Append to the `dependencies` list (preserve existing entries and alphabetical order within their section):

```toml
dependencies = [
    "fastapi[standard]>=0.135,<1.0",
    "sqlmodel>=0.0.37,<1.0",
    "alembic>=1.18,<2.0",
    "pydantic-settings>=2.13,<3.0",
    "python-json-logger>=3.0,<4.0",
    "uvicorn[standard]>=0.34,<1.0",
    "watchdog>=6.0,<7.0",
    "tree-sitter>=0.24,<1.0",
    "tree-sitter-python>=0.23,<1.0",
    "tree-sitter-javascript>=0.23,<1.0",
    "tree-sitter-typescript>=0.23,<1.0",
    "tree-sitter-go>=0.23,<1.0",
    "tree-sitter-rust>=0.23,<1.0",
    "claude-agent-sdk>=0.1.59,<0.2",
    "sse-starlette>=2.0,<3.0",
]
```

After editing, run `uv lock` once to refresh `uv.lock`. Both files are committed together.

### Task 2 — Request/response schemas for the agents router

**File to create:** `app/schemas/agents.py`

**Contents:**

```python
from __future__ import annotations
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StartRunRequest(BaseModel):
    project_id: UUID
    skill_name: str = Field(min_length=1, max_length=128)
    skill_args: dict[str, Any] = Field(default_factory=dict)
    prompt: str = Field(min_length=1)
    set_id: str | None = Field(default=None, max_length=128)
    worktree: str | None = Field(default=None)  # absolute path if provided


class AgentRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    set_id: str | None
    skill_name: str
    status: Literal["pending", "running", "waiting", "interrupted", "failed", "completed"]
    pid: int | None
    started_at: datetime
    ended_at: datetime | None
    active_duration_s: float
    total_wall_clock_s: float
    total_cost_usd: float
    max_turns: int
    turn_count: int
    error_code: str | None
    last_seq: int


class SendInputRequest(BaseModel):
    text: str = Field(min_length=1)


class AnswerRequest(BaseModel):
    """POST /{id}/answer body -- used only by the ask_user MCP tool path (Set 2)."""
    tool_use_id: str
    answer: str


class InterruptResponse(BaseModel):
    ok: bool = True
```

### Task 3 — `app/services/agent_service.py` — thin facade

**File to create:** `app/services/agent_service.py`

**Contents:**

```python
"""Thin facade over AgentSessionManager. Keeps routers declarative and service
layer consistent with kanban_service, project_service, etc."""

from __future__ import annotations
import json
import logging
from pathlib import Path
from typing import AsyncIterator
from uuid import UUID

from fastapi import Request

from app.agents import AgentSessionManager, StateError
from app.models.agent_run import AgentRun
from app.schemas.sse_events import SseEvent

logger = logging.getLogger("rapid.agents.service")


def get_manager(request: Request) -> AgentSessionManager:
    mgr = getattr(request.app.state, "agent_manager", None)
    if mgr is None:
        raise StateError("AgentSessionManager not initialized", detail={})
    return mgr


async def start_run(
    mgr: AgentSessionManager,
    project_id: UUID,
    skill_name: str,
    skill_args: dict,
    prompt: str,
    set_id: str | None,
    worktree: str | None,
) -> AgentRun:
    wt_path = Path(worktree).resolve() if worktree else None
    if wt_path is not None and not wt_path.is_absolute():
        raise StateError("worktree must be absolute", detail={"worktree": worktree})
    return await mgr.start_run(
        project_id=project_id,
        skill_name=skill_name,
        skill_args=skill_args,
        prompt=prompt,
        set_id=set_id,
        worktree=wt_path,
    )


async def get_run(mgr: AgentSessionManager, run_id: UUID) -> AgentRun:
    return await mgr.get_run(run_id)


async def send_input(mgr: AgentSessionManager, run_id: UUID, text: str) -> None:
    await mgr.send_input(run_id, text)


async def interrupt(mgr: AgentSessionManager, run_id: UUID) -> None:
    await mgr.interrupt(run_id)


async def stream_events(
    mgr: AgentSessionManager, run_id: UUID, since: int
) -> AsyncIterator[SseEvent]:
    async for evt in mgr.attach_events(run_id, since=since):
        yield evt
```

### Task 4 — `app/routers/agents.py` — HTTP + SSE surface

**File to create:** `app/routers/agents.py`

**Requirements:**

- Prefix: `/api/agents`.
- Endpoints:

  | method | path | body / query | response |
  |---|---|---|---|
  | `POST` | `/runs` | `StartRunRequest` | `AgentRunResponse` (201) |
  | `GET` | `/runs/{run_id}` | — | `AgentRunResponse` (200) |
  | `GET` | `/runs/{run_id}/events` | `?since=<int>`, `Last-Event-ID` header | SSE `EventSourceResponse` |
  | `POST` | `/runs/{run_id}/input` | `SendInputRequest` | 204 |
  | `POST` | `/runs/{run_id}/interrupt` | — | `InterruptResponse` 200 |
  | `POST` | `/runs/{run_id}/answer` | `AnswerRequest` | 204 — **stub returns 501 in Wave 4**; Set 2 (web-tool-bridge) implements the ask_user bridge. This endpoint exists here so the URL is frozen in the contract. |

**Implementation sketch:**

```python
from __future__ import annotations
import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sse_starlette.sse import EventSourceResponse

from app.agents import StateError, RunError, SdkError, to_http_exception
from app.schemas.agents import (
    AgentRunResponse, AnswerRequest, InterruptResponse, SendInputRequest, StartRunRequest,
)
from app.schemas.sse_events import serialize_event
from app.services import agent_service

logger = logging.getLogger("rapid.routers.agents")

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.post("/runs", response_model=AgentRunResponse, status_code=201)
async def start_run_endpoint(body: StartRunRequest, request: Request):
    mgr = agent_service.get_manager(request)
    try:
        row = await agent_service.start_run(
            mgr,
            project_id=body.project_id,
            skill_name=body.skill_name,
            skill_args=body.skill_args,
            prompt=body.prompt,
            set_id=body.set_id,
            worktree=body.worktree,
        )
    except StateError as e:
        raise to_http_exception(e)
    return AgentRunResponse.model_validate(row)


@router.get("/runs/{run_id}", response_model=AgentRunResponse)
async def get_run_endpoint(run_id: UUID, request: Request):
    mgr = agent_service.get_manager(request)
    try:
        row = await agent_service.get_run(mgr, run_id)
    except StateError as e:
        raise to_http_exception(e)
    return AgentRunResponse.model_validate(row)


@router.get("/runs/{run_id}/events")
async def stream_events_endpoint(run_id: UUID, request: Request):
    mgr = agent_service.get_manager(request)
    # Accept ?since=N query OR Last-Event-ID header; prefer query.
    since_q = request.query_params.get("since")
    since = int(since_q) if since_q is not None else 0
    if since == 0:
        lei = request.headers.get("last-event-id")
        if lei is not None and lei.isdigit():
            since = int(lei)

    async def _gen():
        try:
            async for evt in agent_service.stream_events(mgr, run_id, since=since):
                if await request.is_disconnected():
                    logger.info("client disconnected", extra={"run_id": str(run_id)})
                    break
                yield {
                    "id": str(evt.seq),
                    "event": evt.kind,
                    "data": json.dumps(serialize_event(evt)),
                }
        except Exception:
            logger.exception("SSE stream crashed", extra={"run_id": str(run_id)})
            raise

    return EventSourceResponse(
        _gen(),
        ping=15,
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/runs/{run_id}/input", status_code=204)
async def send_input_endpoint(run_id: UUID, body: SendInputRequest, request: Request):
    mgr = agent_service.get_manager(request)
    try:
        await agent_service.send_input(mgr, run_id, body.text)
    except StateError as e:
        raise to_http_exception(e)
    return Response(status_code=204)


@router.post("/runs/{run_id}/interrupt", response_model=InterruptResponse)
async def interrupt_endpoint(run_id: UUID, request: Request):
    mgr = agent_service.get_manager(request)
    try:
        await agent_service.interrupt(mgr, run_id)
    except StateError as e:
        raise to_http_exception(e)
    return InterruptResponse(ok=True)


@router.post("/runs/{run_id}/answer", status_code=501)
async def answer_endpoint(run_id: UUID, body: AnswerRequest):
    """Stub: implemented in Set 2 (web-tool-bridge). URL is frozen here."""
    raise HTTPException(
        status_code=501,
        detail={
            "error_code": "not_implemented",
            "message": "ask_user answer bridge is owned by set web-tool-bridge (Wave 2 of milestone)",
            "detail": {"run_id": str(run_id), "tool_use_id": body.tool_use_id},
        },
    )
```

### Task 5 — Wire `AgentSessionManager` into FastAPI lifespan

**File to edit:** `app/main.py` (OWNED EXCLUSIVELY BY WAVE 4)

**Changes:**

1. Add imports at the top, grouped with existing router imports:

   ```python
   from app.routers.agents import router as agents_router
   from app.agents import AgentSessionManager, install_agent_error_handlers
   ```

2. In `lifespan()`, after the `watcher = FileWatcherService(engine)` block and its `app.state.file_watcher = watcher` line, **before** the `logger.info("RAPID Web service started", ...)` line, add:

   ```python
   # Start the agent session manager (owns SDK clients + orphan sweeper + archive)
   agent_manager = AgentSessionManager(engine)
   await agent_manager.start()
   app.state.agent_manager = agent_manager
   ```

3. In the shutdown half of `lifespan()` (after the `watcher.stop()` block and before `app.state.engine.dispose()`), add:

   ```python
   if hasattr(app.state, "agent_manager") and app.state.agent_manager:
       await app.state.agent_manager.stop()
   ```

4. In `create_app()`, after the `app.state.engine = None` line and before the CORS `app.add_middleware(...)` call, add:

   ```python
   app.state.agent_manager = None
   ```

5. In `create_app()`, after `app.include_router(notes_router)` line, add:

   ```python
   app.include_router(agents_router)
   ```

6. In `create_app()`, AFTER installing exception handlers for `HTTPException` (the existing block), add:

   ```python
   install_agent_error_handlers(app)
   ```

7. Do NOT modify any other function or block. Preserve existing order and comments.

### Task 6 — Router registry update

**File to edit:** `app/routers/__init__.py` (edit if it exists, create if it does not)

If the file does not exist, create it empty-importable. If it exists, follow its existing convention. The router is already included directly via `app.include_router(agents_router)` in `main.py`; touching `routers/__init__.py` is only required if the project has a convention of re-exporting routers.

**Skip this task** if `routers/__init__.py` is already empty or imports nothing; `main.py` import is sufficient.

### Task 7 — Service registry update

**File to edit:** `app/services/__init__.py` (edit to re-export `agent_service`)

**Change:** if the file re-exports the other services, add `from app.services import agent_service`. Otherwise leave untouched — `app.services.agent_service` is importable by module path.

### Task 8 — Tests

**File to create:** `tests/agents/test_agents_router.py`

**Fixtures:** use the project's existing `engine` + `tables` fixtures from `tests/conftest.py`. Add a local client fixture:

```python
import pytest
from fastapi.testclient import TestClient
from app.main import create_app

@pytest.fixture
def client(tables, monkeypatch):
    app = create_app()
    app.state.engine = tables
    # Mock the AgentSessionManager so tests do not spawn real SDK subprocesses.
    # Individual tests set their own mock via app.state.agent_manager = ...
    return TestClient(app)
```

**Tests:**

- `test_post_runs_dispatches_and_returns_201(client, monkeypatch)` — mock `AgentSessionManager.start_run` to return a prebuilt `AgentRun`; POST `/api/agents/runs` with valid body; assert 201, `id` echoes the mock's id, `status=="pending"`, `skill_name` echoes.
- `test_post_runs_409_on_state_error(client, monkeypatch)` — mock `start_run` to raise `StateError`; POST returns 409 with envelope `{"error_code":"state_error", ...}`.
- `test_post_runs_missing_project_fields_422(client)` — POST with empty body; returns 422 Pydantic validation error.
- `test_get_run_404_on_state_error(client, monkeypatch)` — mock `get_run` to raise `StateError("Run not found")`; GET returns 409 (StateError maps to 409 not 404 per taxonomy; test asserts envelope; this is documented behavior).

  *Note to executor:* per CONTEXT, "not found" conceptually would be 404 but the taxonomy assigns `StateError → 409`. Keep the mapping; downstream consumers have been told the taxonomy. If a stricter 404 is later desired, add a `NotFoundError(UserError)` subclass in a future ticket.

- `test_post_interrupt_returns_200(client, monkeypatch)` — mock `interrupt`; assert 200 + `{"ok": true}`.
- `test_post_answer_returns_501(client)` — stub is wired; returns 501 with envelope `error_code="not_implemented"`.
- `test_sse_endpoint_replays_backfill(client, monkeypatch)` — mock `stream_events` to yield two events then a `run_complete`; open a streaming request; assert SSE wire format `id:`, `event:`, `data:` lines for each event.
- `test_sse_endpoint_accepts_since_query(client, monkeypatch)` — mock attach_events to capture the `since` arg; GET `/events?since=42`; assert the mock was called with `since=42`.
- `test_sse_endpoint_accepts_last_event_id_header(client, monkeypatch)` — GET `/events` with header `Last-Event-ID: 17`; assert `since=17` propagated.
- `test_sse_query_wins_over_last_event_id(client, monkeypatch)` — both present; `?since=5` + `Last-Event-ID: 17` → `since=5`.

**File to create:** `tests/agents/test_dispatch_latency.py`

- `test_dispatch_under_200ms_p95(client, monkeypatch)`:

  ```python
  import time, asyncio
  from unittest.mock import AsyncMock, patch
  # Install a real manager but mock AgentSession so no SDK spawn happens.
  with patch("app.agents.session.AgentSession.__aenter__", new=AsyncMock(return_value=None)), \
       patch("app.agents.session.AgentSession.__aexit__", new=AsyncMock(return_value=None)), \
       patch("app.agents.session.AgentSession.run", new=AsyncMock(return_value=None)):
      latencies = []
      for _ in range(20):
          t0 = time.monotonic()
          r = client.post("/api/agents/runs", json={...})
          latencies.append((time.monotonic() - t0) * 1000.0)
      latencies.sort()
      p95 = latencies[int(len(latencies) * 0.95)]
      assert p95 < 200, f"p95 dispatch {p95:.1f}ms exceeds 200ms budget"
  ```

  Include a real `Project` row seeded in the test DB fixture so the manager can resolve the project.

**File to create:** `tests/agents/test_smoke_end_to_end.py`

- Marked with `@pytest.mark.slow` and `@pytest.mark.skipif(not shutil.which("claude"), reason="claude CLI not on PATH")`.
- `test_real_sdk_hello_world(tmp_path, monkeypatch)`:
  - Create a project at `tmp_path` with a trivial `CLAUDE.md` containing `Say the single word 'pong' when prompted.`
  - Seed a `Project` row pointing at `tmp_path`.
  - Start a FastAPI app with real `AgentSessionManager`.
  - POST `/api/agents/runs` with `skill_name="status"` (low max_turns), `prompt="ping"`, no set_id.
  - GET `/api/agents/runs/{id}/events` with streaming, collect events for up to 30s or until `run_complete`.
  - Assert at least one `AssistantTextEvent` received, `RunCompleteEvent.status=="completed"`, `turn_count >= 1`, `total_cost_usd > 0`.
  - Assert the final `GET /api/agents/runs/{id}` shows `status="completed"`.

- `test_interrupt_mid_run(tmp_path, monkeypatch)`:
  - Same setup. POST a long-running prompt (`"Count to 20 slowly"`).
  - Wait for first `AssistantTextEvent`.
  - POST `/interrupt`; assert 200.
  - Subscribe/attach events; within 15s a `RunCompleteEvent(status="interrupted")` is received.

**File to create:** `tests/agents/test_cors_sse.py`

- `test_sse_endpoint_headers(client, monkeypatch)` — OPTIONS + GET; assert `Cache-Control: no-cache` and `X-Accel-Buffering: no` headers on the SSE response.

### Task 9 — Lifespan smoke test

**File to create:** `tests/agents/test_main_lifespan.py`

- `test_lifespan_starts_and_stops_manager(monkeypatch)`:
  - Use `fastapi.testclient.TestClient` with `with TestClient(app) as client:` (TestClient runs lifespan).
  - Inside the with-block: `client.app.state.agent_manager` is a `AgentSessionManager` instance and `agent_manager._orphan_sweep_task` is not None.
  - After with-block: `agent_manager._stopping.is_set() is True`.

### Task 10 — WAVE-4-COMPLETE.md + contract freeze note

**File to create:** `.planning/sets/agent-runtime-foundation/WAVE-4-COMPLETE.md`

- Record: deps added (claude-agent-sdk, sse-starlette), files created, test counts, dispatch latency p95, smoke test outcome.

**File to create:** `.planning/sets/agent-runtime-foundation/CONTRACT-FROZEN.md`

- Confirms the following are stable and MUST NOT be changed without coordinated multi-set release:
  - SSE event schema (kinds + payload shapes)
  - `AgentRun` / `AgentEvent` column shape
  - `build_sdk_options()` signature
  - HTTP paths and verbs
- Includes a "breaking change process" paragraph: additive-only by default; breaking requires explicit milestone decision.

## What NOT to do

- Do NOT modify any file owned by Waves 1, 2, or 3 (see each wave's ownership list). If a router test needs a model tweak, stop and report BLOCKED — contract must not drift.
- Do NOT implement the `/answer` endpoint logic here. That is Set 2 (web-tool-bridge). Wave 4 freezes the URL with a 501 stub.
- Do NOT register any new alembic migration here. Migration 0004 (Wave 1) is the only one this set ships.
- Do NOT read or write `.env` credentials in router code. The SDK options construction (Wave 2) already handles env.
- Do NOT bypass the `AgentSessionManager` by instantiating `AgentSession` directly in a router. Always go through the manager.
- Do NOT add `BackgroundTasks` anywhere. The dispatch contract is `asyncio.Task` only.
- Do NOT add a global `/api/runs` alias. The canonical prefix is `/api/agents/runs`.

## Verification

Run from `web/backend/`:

```bash
# 1. Dep sync
uv sync

# 2. All agent tests pass (Waves 1-4)
uv run pytest tests/agents/ -v

# 3. Full backend test suite still green (non-regression)
uv run pytest tests/ -v --ignore=tests/agents/test_smoke_end_to_end.py

# 4. Dispatch latency test
uv run pytest tests/agents/test_dispatch_latency.py -v

# 5. Router smoke against in-process TestClient
uv run pytest tests/agents/test_agents_router.py -v

# 6. Lifespan wiring
uv run pytest tests/agents/test_main_lifespan.py -v

# 7. OpenAPI surface is complete (sanity check)
uv run python -c "
from app.main import create_app
app = create_app()
paths = set(app.openapi()['paths'].keys())
required = {
    '/api/agents/runs',
    '/api/agents/runs/{run_id}',
    '/api/agents/runs/{run_id}/events',
    '/api/agents/runs/{run_id}/input',
    '/api/agents/runs/{run_id}/interrupt',
    '/api/agents/runs/{run_id}/answer',
}
missing = required - paths
assert not missing, f'missing routes: {missing}'
print('OpenAPI surface OK')
"

# 8. No forbidden patterns anywhere under app/
! grep -RIn "bypassPermissions" app/
! grep -RIn "BackgroundTasks" app/agents/ app/routers/agents.py app/services/agent_service.py
! grep -RIn "ANTHROPIC_API_KEY" app/agents/ app/routers/ app/services/

# 9. Smoke test (optional, gated on `claude` CLI on PATH)
if command -v claude >/dev/null 2>&1; then
  uv run pytest tests/agents/test_smoke_end_to_end.py -v
else
  echo 'claude CLI not installed; skipping e2e smoke'
fi

# 10. Migration chain still coherent
uv run alembic history | grep -E '0003 -> 0004' && echo 'migration chain OK'

# 11. Commit touches are Wave 4 scope only
git diff --name-only HEAD~1 HEAD
# Expected diff set (roughly):
#   pyproject.toml uv.lock
#   app/main.py
#   app/routers/agents.py
#   app/services/agent_service.py
#   app/schemas/agents.py
#   tests/agents/test_agents_router.py
#   tests/agents/test_dispatch_latency.py
#   tests/agents/test_smoke_end_to_end.py
#   tests/agents/test_cors_sse.py
#   tests/agents/test_main_lifespan.py
#   .planning/sets/agent-runtime-foundation/WAVE-4-COMPLETE.md
#   .planning/sets/agent-runtime-foundation/CONTRACT-FROZEN.md
```

## Success Criteria

- [ ] `uv sync` succeeds with `claude-agent-sdk` and `sse-starlette` installed.
- [ ] `uv run pytest tests/agents/ -v` passes with all waves' tests.
- [ ] `POST /api/agents/runs` p95 latency under 200ms with mocked session (measured in `test_dispatch_latency.py`).
- [ ] `POST /api/agents/runs/{id}/interrupt` returns 200 + `{"ok": true}`.
- [ ] `POST /api/agents/runs/{id}/answer` returns 501 (stub, Set 2 implements).
- [ ] `GET /api/agents/runs/{id}/events` yields SSE with `id:`, `event:`, `data:` lines and accepts both `?since=N` query and `Last-Event-ID` header.
- [ ] FastAPI lifespan starts `AgentSessionManager` at startup and stops it on shutdown.
- [ ] Error handlers installed via `install_agent_error_handlers(app)` map the full taxonomy.
- [ ] OpenAPI schema contains all six agent routes.
- [ ] `test_smoke_end_to_end.py` passes when `claude` CLI is available (gated; CI may skip).
- [ ] No `BackgroundTasks` import in the agent runtime codepath.
- [ ] No Wave-4 commit touches files owned by Waves 1-3 (enforced by ownership diff check).
- [ ] Wave 4 artifacts committed as `feat(agent-runtime-foundation): wave 4 http surface + integration — routers, lifespan, deps`.

## Files Owned Exclusively by Wave 4

- `web/backend/pyproject.toml` (EDIT: add 2 deps)
- `web/backend/uv.lock` (REFRESH via `uv lock`)
- `app/main.py` (EDIT: add lifespan wiring + include_router + exception handler install)
- `app/routers/agents.py`
- `app/routers/__init__.py` (EDIT only if pre-existing convention requires)
- `app/services/agent_service.py`
- `app/services/__init__.py` (EDIT only if pre-existing convention requires)
- `app/schemas/agents.py`
- `tests/agents/test_agents_router.py`
- `tests/agents/test_dispatch_latency.py`
- `tests/agents/test_smoke_end_to_end.py`
- `tests/agents/test_cors_sse.py`
- `tests/agents/test_main_lifespan.py`
- `.planning/sets/agent-runtime-foundation/WAVE-4-COMPLETE.md`
- `.planning/sets/agent-runtime-foundation/CONTRACT-FROZEN.md`

No other wave may modify any of the above files.
