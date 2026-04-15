# Agent Runtime Contract — Frozen at Wave 4

**Set:** agent-runtime-foundation
**Status:** FROZEN (additive-only)
**Consumers:** web-tool-bridge, skill-invocation-ui, kanban-autopilot, agents-chats-tabs

The surfaces below are stable. **They MUST NOT be changed without a coordinated multi-set release** (see "breaking change process" at the end).

## 1. SSE event schema

All events inherit from `_BaseEvent` (`seq: int`, `ts: datetime`, `run_id: UUID`, `extra="allow"` for forward-compat). Each event carries a `kind` discriminator.

Frozen kinds and their payload shapes (see `app/schemas/sse_events.py`):

- `assistant_text` — `{text: str}`
- `thinking` — `{text: str}`
- `tool_use` — `{tool_name: str, tool_use_id: str, input: dict}`
- `tool_result` — `{tool_use_id: str, output: dict | str | None, is_error: bool}`
- `ask_user` — `{tool_use_id: str, question: str, options: list[str] | None, allow_free_text: bool}`
- `permission_req` — `{tool_name: str, tool_use_id: str, reason: str, blocked: bool}`
- `status` — `{status: "pending"|"running"|"waiting"|"interrupted"|"failed"|"completed", detail: str | None}`
- `run_complete` — `{status: "completed"|"failed"|"interrupted", total_cost_usd: float, turn_count: int, duration_s: float, error_code: str | None, error_detail: dict | None}`
- `replay_truncated` — `{oldest_available_seq: int, requested_since_seq: int, reason: "retention_cap"|"archived"}`
- `retention_warning` — `{event_count: int, cap: int}`

No `version` field. Evolution is strictly additive (new optional fields, new kinds).

## 2. AgentRun / AgentEvent table shapes

Columns on `AgentRun` (see `app/models/agent_run.py`):
`id, project_id, set_id, skill_name, skill_args, status, pid, started_at, ended_at, active_duration_s, total_wall_clock_s, total_cost_usd, max_turns, turn_count, error_code, error_detail, last_seq`.

Partial unique index `uq_agent_run_active_set` on `(project_id, set_id)` where `status IN ('running','waiting')` — the canonical backstop for the per-set mutex.

Columns on `AgentEvent` (see `app/models/agent_event.py`): locked as of Wave 1 migration 0004.

## 3. `build_sdk_options()` signature

```python
build_sdk_options(
    *,
    project_root: Path,
    worktree: Path | None,
    skill_name: str,
    skill_args: dict,
    run_id: UUID,
    engine,
    event_bus,
) -> ClaudeAgentOptions
```

See `app/agents/sdk_options.py`. `bypassPermissions` is banned anywhere in the runtime.

## 4. HTTP surface

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/agents/runs` | `StartRunRequest` | 201 + `AgentRunResponse` |
| `GET`  | `/api/agents/runs/{run_id}` | — | 200 + `AgentRunResponse` |
| `GET`  | `/api/agents/runs/{run_id}/events` | `?since=<int>` or `Last-Event-ID` | 200 `text/event-stream` |
| `POST` | `/api/agents/runs/{run_id}/input` | `SendInputRequest` | 204 |
| `POST` | `/api/agents/runs/{run_id}/interrupt` | — | 200 + `InterruptResponse` |
| `POST` | `/api/agents/runs/{run_id}/answer` | `AnswerRequest` | 501 (Set 2 fills in) |

### Dispatch SLA
`POST /api/agents/runs` returns in **<200ms p95**. The SDK subprocess runs on an `asyncio.Task` — **never** via `BackgroundTasks`, **never** synchronously.

### SSE stream
`text/event-stream` with:
- `id: <seq>` per event (drives `Last-Event-ID` resume).
- `event: <kind>` per event.
- `data: <json>` serialized `SseEvent` model.
- `Cache-Control: no-cache`, `X-Accel-Buffering: no`, `ping: 15s`.
- Replay: `?since=N` wins over `Last-Event-ID` header; starts from the run's earliest available seq if the requested seq precedes retention (emits `replay_truncated`).

### Error taxonomy
Errors from the runtime raise one of: `SdkError` (502, retryable, `Retry-After: 5`), `RunError` (500), `StateError` (409), `ToolError` (422), `UserError` (400). Handlers installed via `install_agent_error_handlers(app)`.

## Breaking-change process

Additive-only is the default:
- New SSE event kinds — OK without coordination.
- New optional fields on existing events, request bodies, or response bodies — OK.
- New endpoints under the `/api/agents/*` tree — OK.

Any of the following require an explicit milestone decision and coordinated release across all four consumer sets:
- Removing or renaming an SSE event kind or a required field.
- Removing or renaming an HTTP path, changing a verb, or changing a non-additive status code.
- Changing the shape of `AgentRun` / `AgentEvent` rows (columns, types, index invariants).
- Changing the `build_sdk_options()` signature in a non-additive way.
- Changing the error taxonomy mapping (error code ↔ HTTP status).

Owners: agent-runtime-foundation set owner + consumers listed above must sign off on the change, and the change must ship as a single milestone-spanning commit wave with updated contract doc.
