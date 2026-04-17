# CONTEXT: agent-runtime-foundation

**Set:** agent-runtime-foundation
**Generated:** 2026-04-15
**Mode:** interactive

<domain>
## Set Boundary

Wave 1 keystone of milestone v7.0.0 (Mission Control Autopilot). A Python backend runtime that wraps the Claude Agent SDK and exposes a safe, observable, long-lived agent-run lifecycle over HTTP/SSE. Gates every downstream set (web-tool-bridge, skill-invocation-ui, kanban-autopilot, agents-chats-tabs) via frozen contracts: the SSE event schema, the `AgentRun` SQLite shape, and the `build_sdk_options()` signature.

In-scope: `app/agents/` package (session_manager, session, event_bus, permissions, budget, errors, correlation, mcp_registration), `agent_run` + `agent_event` SQLModels + Alembic migration, task-queue dispatch endpoints, destructive-command firewall, credential scrub, per-project semaphore + per-set mutex, orphan sweeper, `run_id` correlation, centralized SDK option construction, per-skill permission policy, budget tracking, error taxonomy.

Out-of-scope: MCP ask_user tools (Set 2), skill launcher UI (Set 3), kanban autopilot worker (Set 4), Agents/Chats tabs (Set 5).
</domain>

<decisions>
## Implementation Decisions

### SSE schema enforcement — Pydantic discriminated union
- Every SSE event kind (`assistant_text`, `thinking`, `tool_use`, `tool_result`, `ask_user`, `permission_req`, `status`, `run_complete`, and the new `replay_truncated` — see below) has a strict Pydantic model under `app/api/schemas/sse_events.py`. The kind field is the discriminator; OpenAPI auto-generates the schema and downstream TS types via codegen.
- **Rationale:** Schema churn after downstream sets ship is a high-impact risk. Static typing catches drift at test time; the cost of per-kind migrations is acceptable for a load-bearing 2-year contract.

### SSE schema evolution — Additive-only, no version field
- New fields are always `Optional`; old consumers ignore unknowns. Fields are never removed without a coordinated breaking change (which would live in a future `/api/v2/...` path).
- **Rationale:** Zero per-event overhead; matches existing RAPID JSON envelope conventions; the cost of a future `/v2` path is acceptable because breaking changes should be rare.

### EventBus write cadence — Hybrid (critical sync, chatty batched)
- `permission_req`, `ask_user`, `run_complete`, `status`, and `tool_use` (for destructive-blocked cases) are flushed synchronously to `agent_events`. `assistant_text`, `thinking`, and `tool_result` for non-critical tools are batched at ~1s cadence. Ring buffer (1000 events) serves live SSE subscribers; SQLite serves replay.
- **Rationale:** Actionable UI state (pending prompts, completion) must survive a crash. Token-stream chatter does not; batching prevents SQLite write contention with kanban + agent_runs tables.

### EventBus replay fallback — SQLite backfill on ring miss
- When client requests `?since=N` and the ring has evicted events below that seq, the SSE endpoint reads missing events from `agent_events` (SQLite), streams them, then switches to the live ring. Single SSE stream, two sources.
- **Rationale:** Long-running execute-set runs emit 10K+ events; unbounded ring causes OOM; 410 Gone ruins UX. SQLite backfill preserves correctness with bounded RAM.

### `waiting` status triggers — permission_req + ask_user/free-text MCP prompts
- Run transitions to `waiting` whenever user input is required to continue: a `permission_req` event OR an `ask_user`/free-text MCP tool call (to be wired by Set 2). Network stalls and rate-limit backoff stay as `running`.
- **Rationale:** Consistent UI signal — `waiting` means "you must act now." Anything less clear makes the Agents tab misleading. Foundation must emit the transition even for MCP tools it doesn't own yet; Set 2 registers its tools into the existing hook.

### Budget telemetry during `waiting` — Active-only duration
- `AgentRun` exposes two fields: `active_duration_s` (ticks only during `running`) and `total_wall_clock_s` (ticks always). Dashboard defaults to `active_duration_s`. Cost tracking is unaffected (always zero during `waiting`).
- **Rationale:** A run paused overnight showing "14h" is alarming and inaccurate about real work. Keep the headline number honest; expose the full wall-clock for debugging.

### Error taxonomy → HTTP mapping — Fine-grained status + JSON envelope
- `SdkError` → 502, `RunError` → 500, `StateError` → 409, `ToolError` → 422, `UserError` → 400. Envelope shape: `{error_code, message, detail}`. OpenAPI documents the mapping per endpoint.
- **Rationale:** HTTP-aware monitoring (logs, dashboards) distinguishes 502 (SDK network blip) from 409 (state conflict) from 422 (tool denied) without parsing bodies. RFC 7807 is overkill for an internal API; uniform 400 loses signal.

### Retryability — Only `SdkError` retryable, with `Retry-After` header on rate-limit
- `SdkError` responses include `Retry-After` (seconds) on 429-class failures. UI's Retry button appears only on `SdkError`. All other error classes terminate the run.
- **Rationale:** Matches reality — SDK transient failures can recover; StateError/ToolError/UserError indicate bad state or input where retry is semantically wrong.

### Per-set mutex — Layered (Python asyncio.Lock registry + SQLite partial unique index)
- `AgentSessionManager` holds a per-`(project_id, set_id)` asyncio.Lock dict for fast-fail 409s in-process. SQLite has a partial unique index `(project_id, set_id) WHERE status='running'` as the race-proof safety net. Python layer catches 99% cleanly; DB catches crash-recovery and future multi-worker races.
- **Rationale:** Belt + suspenders. Python gives a friendly 409 without a DB round-trip for every reject; SQLite ensures correctness even if lock state is lost (restart mid-race).

### Mutex contention behavior — 409 reject immediately
- No grace period, no queue. Second run on the same `(project_id, set_id)` while one is running returns HTTP 409 with `error_code=run_already_active`.
- **Rationale:** Deterministic; matches the spec's sub-200ms dispatch budget. Autopilot's per-card N=3 retry handles benign race; UI-side dedupe on double-click is a UI concern.

### Orphan reaping — Startup + periodic 60s sweep
- Lifespan startup sweep reconciles `agent_runs WHERE status IN ('running','waiting')` against live PIDs and marks orphans `interrupted`. Additionally, a background asyncio task re-runs the same reconciliation every 60 seconds.
- **Rationale:** Startup-only misses in-session drift (uvicorn dev reload, worker SIGKILL without restart). 60s sweep is cheap (PID check is syscall-fast) and caps the zombie window. Heartbeat-based detection is over-engineering for our single-process single-user topology.

### Reap policy — Mark interrupted + SIGTERM the PID
- When an orphan is detected, the row flips to `status='interrupted'` AND the backend sends SIGTERM to the tracked `pid` (if still live). SIGTERM lets the SDK flush; no SIGKILL ladder in Wave 1 (may revisit if SIGTERM wedges in practice).
- **Rationale:** Immediate token reclamation is the primary concern. SIGTERM is graceful enough for most cases; the small risk of a wedged SDK surviving SIGTERM is acceptable for v1.

### can_use_tool policy — Trust every tool except the destructive firewall (SPEC REVISION)
- **This deviates from the original CONTRACT.json spec.** The spec proposed a per-skill allowlist with "ambiguous" tools routed to the browser via `permission_req`. User directive: "let the agents use every tool so we can ignore this problem completely." The revised policy:
  - `DESTRUCTIVE_PATTERNS` regex list is the ONLY hard gate (`rm -rf /`, `git push --force`, `branch -D`, `env*`, `cat .env*`, etc.) — always denied, never overridable.
  - Everything else is allowed unconditionally. No per-skill allowlist enforcement at runtime. No browser-routed permission prompts for ambiguous cases.
  - `permission_req` SSE event kind remains in the schema for destructive-block notifications (info-only; not a prompt awaiting answer), but the `/api/agents/runs/{id}/answer` endpoint is not used for tool permissions.
- **Rationale:** User explicitly wants friction-free agent autonomy. The destructive firewall is sufficient protection because the true dangerous operations are enumerated; everything else is recoverable. Simplifies the frontend (no approval modal for permissions) and eliminates timeout complexity for tool gating.

### Tool answer timeout — No timeout on user-input prompts (SPEC REVISION)
- For `ask_user` / free-text MCP tool prompts (which arrive via Set 2's custom tools), the run waits indefinitely in `waiting` status. Only `/interrupt` cancels.
- **Rationale:** User directive: "no timeout should be enforced" for AskUserQuestion-like prompts. Paired with the trust-all-tools policy above, there is no permission-timeout concern. For closed-tab/abandoned-prompt cases, the orphan sweeper (startup + periodic) reconciles via PID tracking, not timeout.

### agent_events retention — Per-run cap (50K events) + 30-day time archive
- SQLite `agent_events` is capped at 50,000 rows per `run_id`. Runs approaching the cap emit a `retention_warning` status event (new kind). After 30 days, completed runs' event rows are moved to an archive format (JSONL files under `~/.rapid/archive/<project_id>/<run_id>.jsonl`) and the SQLite rows are deleted.
- **Rationale:** Prevents a single runaway run from bloating the hot DB; time-based archive preserves historical transcripts for post-hoc analysis without keeping them in the query path.

### Replay truncation — `replay_truncated` event + resume from current tail
- When a client reconnects with `?since=N` older than retention bounds (ring evicted AND SQLite pruned), the server emits a `replay_truncated` event containing `{oldest_available_seq, missed_count}`, then streams from the current tail. UI can render a "some events missed" marker.
- **Rationale:** Graceful degradation beats hard failure. Clients must handle the new kind, but it's strictly additive (fits the additive-only evolution rule).
</decisions>

<specifics>
## Specific Ideas

- **Trust-all-tools directive** reshapes Set 2 (web-tool-bridge): the `can_use_tool` interception-for-ambiguous-approval flow is effectively removed. Set 2's scope narrows to just the `mcp__rapid__webui_ask_user` / `ask_free_text` MCP tools (for structured user input questions), NOT tool-permission approval modals.
- The `/api/agents/runs/{id}/answer` endpoint is still needed for `ask_user` MCP tool responses (Set 2), but it is NOT used for tool-permission answers.
- `permission_req` SSE event kind remains in the schema but shifts from "prompt awaiting answer" to "info notification that a destructive tool was blocked" — UI renders a toast, not a modal.
- `retention_warning` is a new SSE event kind introduced for the 50K-event cap; included in the frozen schema so downstream sets can consume it without churn.
- `replay_truncated` is a new SSE event kind for gap signaling on reconnect after retention pruning.
- `active_duration_s` + `total_wall_clock_s` dual-field pattern means `AgentRun` SQLModel needs both; dashboard queries default to `active_duration_s`.
- Per-skill permission policy still exists in `permissions.py::PERMISSION_POLICY`, but its scope shrinks to: per-skill `max_turns`, per-skill `permission_mode` (`default` vs `acceptEdits`), and optional `disallowed_tools` overrides (for future tightening of specific skills). No `allowed_tools` enforcement.
</specifics>

<code_context>
## Existing Code Insights

- FastAPI app factory lives at `web/backend/app/main.py`; lifespan is already a context manager hook (currently just wires `FileWatcherService`). The `AgentSessionManager` lifecycle slots into the existing lifespan.
- Database engine + SQLModel pattern established at `web/backend/app/database.py`. SQLite with WAL mode, `PRAGMA busy_timeout=5000`, `foreign_keys=ON`. Naming convention fixtures for Alembic batch mode are already in place.
- Alembic migrations numbered sequentially under `web/backend/alembic/versions/` — next migration for `agent_run` + `agent_event` tables will be `0004_agent_runtime.py`.
- Existing SQLModels (`Project`, `KanbanColumn`, `KanbanCard`, `SyncState`, `AppConfig`) use `datetime = Field(default_factory=_utcnow)` and `UUID = Field(default_factory=uuid4, primary_key=True)` patterns — `AgentRun` follows suit.
- Router pattern: `APIRouter(prefix="/api/...", tags=[...])`, separate file per resource, `Depends(get_db)` for session. `app/routers/agents.py` + `app/services/agent_service.py` fit this convention.
- CORS is currently hardcoded to Vite dev origins (`http://127.0.0.1:5173`, `http://localhost:5173`). SSE reconnect through the Vite proxy is a Set 5 concern, but the CORS surface must allow `text/event-stream` responses — no change needed (allow_methods=*).
- Project-relative paths and `~` over `$HOME` per CLAUDE.md; Python scripts use `uv` for venv.
- Existing logging substrate at `app/logging_config.py` — the `run_id` `contextvars.ContextVar` logger filter registers here.
- The backend lives at `web/backend/`, not `mission-control/backend/` as SET-OVERVIEW.md abbreviates. All file paths in CONTRACT.json (`app/agents/...`, `app/models/...`, `app/api/...`) are relative to `web/backend/`.
- FastAPI is not in the backend yet imported with SSE support — use `sse-starlette` or vanilla `StreamingResponse` with `media_type="text/event-stream"`; chooser defers to planner.
</code_context>

<deferred>
## Deferred Ideas

- Archive format and storage choice (JSONL locally vs. pluggable backend) — see DEFERRED.md
- SIGKILL ladder for wedged orphans that survive SIGTERM — see DEFERRED.md
- `/api/v2/agents/...` path strategy when a breaking SSE schema change becomes necessary — see DEFERRED.md
- Multi-worker uvicorn deployment implications for the asyncio.Lock registry — see DEFERRED.md
- Per-skill `disallowed_tools` tuning for future skills that need tighter scope — see DEFERRED.md
</deferred>
