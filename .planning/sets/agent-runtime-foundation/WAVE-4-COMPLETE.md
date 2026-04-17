# Wave 4 Complete — HTTP Surface + Integration

**Set:** agent-runtime-foundation
**Wave:** 4 of 4 — HTTP Surface + Integration
**Commit:** (recorded after commit creation)

## Deliverables

### Dependencies added
- `claude-agent-sdk>=0.1.59,<0.2`
- `sse-starlette>=2.0,<3.0` (resolved 2.4.1)

Both added to `web/backend/pyproject.toml`; `uv.lock` refreshed.

### New files
- `app/schemas/agents.py` — `StartRunRequest`, `AgentRunResponse`, `SendInputRequest`, `AnswerRequest`, `InterruptResponse`.
- `app/services/agent_service.py` — thin facade over `AgentSessionManager` (`get_manager`, `start_run`, `get_run`, `send_input`, `interrupt`, `stream_events`).
- `app/routers/agents.py` — `/api/agents` router with 6 endpoints.
- `tests/agents/test_agents_router.py` — 14 router + SSE tests.
- `tests/agents/test_dispatch_latency.py` — p95 dispatch-latency test (20 samples).
- `tests/agents/test_main_lifespan.py` — lifespan wiring smoke test.
- `tests/agents/test_cors_sse.py` — SSE response-header test.
- `tests/agents/test_smoke_end_to_end.py` — gated e2e tests (require `claude` CLI).

### Edits
- `app/main.py` — added `AgentSessionManager` lifespan startup/shutdown, `install_agent_error_handlers(app)`, `app.include_router(agents_router)`, and `app.state.agent_manager` default.

### HTTP surface (frozen, additive-only)
| Method | Path | Status | Notes |
|---|---|---|---|
| POST | `/api/agents/runs` | 201 | `<200ms` dispatch via `asyncio.Task` |
| GET  | `/api/agents/runs/{run_id}` | 200 | |
| GET  | `/api/agents/runs/{run_id}/events` | 200 | SSE, `?since=N` or `Last-Event-ID` |
| POST | `/api/agents/runs/{run_id}/input` | 204 | |
| POST | `/api/agents/runs/{run_id}/interrupt` | 200 | `{"ok": true}` |
| POST | `/api/agents/runs/{run_id}/answer` | 501 | Stub; Set 2 owns the real impl |

OpenAPI confirmed: all six routes present.

## Test counts
- Agent-wave tests (Waves 1–4): **122 passed**.
- Router subset (Wave 4 only): **15 passed** (14 in `test_agents_router.py` + 1 in `test_cors_sse.py`).
- Dispatch-latency: **1 passed** (p95 well under 200ms with real manager + mocked session).
- Lifespan: **1 passed** (`AgentSessionManager` starts, background tasks spawned, `_stopping` set after teardown).
- E2E smoke (`test_smoke_end_to_end.py`): gated on `claude` CLI; not executed as part of the default sweep.

## Dispatch latency
Measured via `tests/agents/test_dispatch_latency.py` with real `AgentSessionManager` + patched `AgentSession` (no subprocess spawn). 20 samples, p95 < 200ms — well under the contract budget.

## Verification
- `! grep bypassPermissions app/` — clean.
- `! grep BackgroundTasks app/agents/ app/routers/agents.py app/services/agent_service.py` — clean (dispatch uses `asyncio.Task` exclusively, per contract).
- `! grep ANTHROPIC_API_KEY app/agents/ app/routers/ app/services/` — clean.
- Migration chain: `0003 -> 0004 (head)`, intact.
- OpenAPI surface: all six required routes registered.
- Full `tests/agents/` suite: 122 passed, 0 failures.
- Pre-existing backend failures in `test_sync_engine.py` / `test_database.py` / a handful in `test_main.py`, `test_config.py`, `test_init.py`, `test_migrations.py` are NOT introduced by Wave 4 (confirmed via stash-revert diff on baseline).

## Contract freeze

With Wave 4 complete, the following are frozen for consumers (web-tool-bridge, skill-invocation-ui, kanban-autopilot, agents-chats-tabs):

- SSE event schema (kinds + payload shapes).
- `AgentRun` / `AgentEvent` column shape.
- `build_sdk_options()` signature.
- HTTP paths, verbs, and status codes (see table above).

Additive-only evolution by default; breaking changes require coordinated multi-set release. See `CONTRACT-FROZEN.md`.
