# Wave 4 Plan Digest

**Objective:** Final contract freeze — HTTP surface, SSE, lifespan wiring, dispatch-latency + e2e smoke tests.
**Tasks:** Completed — added SDK + sse-starlette deps, FastAPI routes (POST/GET runs, SSE /events, input/interrupt/answer), lifespan wiring, error handlers, integration tests.
**Key files:** app/schemas/agents.py, app/services/agent_service.py, app/routers/agents.py, app/main.py (edit), pyproject.toml (edit), uv.lock (refresh).
**Approach:** Dispatch offloaded to `asyncio.Task` to keep POST `/runs` <200ms (user's CLAUDE.md polling guidance). `sse-starlette` for SSE with `?since=<seq>` replay. Error taxonomy wired via `install_agent_error_handlers` (from Wave 2).
**Deviations:** `sse-starlette` module-level `AppStatus.should_exit_event` binds to whichever loop first touches it — problematic under `TestClient`. Resolved with autouse fixtures that reset the singleton before/after each SSE test.
**Tests:** 19 tests added (122 total in tests/agents/). Dispatch p95 well under 200ms. Forbidden-pattern checks clean. OpenAPI exposes all six routes.
**Status:** Complete (commit e49c287). CONTRACT-FROZEN.md written — downstream sets now unblocked.
