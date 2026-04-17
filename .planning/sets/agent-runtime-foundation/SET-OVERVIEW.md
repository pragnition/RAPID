# SET-OVERVIEW: agent-runtime-foundation

## Approach

This set is the Wave 1 keystone of the milestone: a Python backend runtime that wraps the Claude Agent SDK and exposes a safe, observable, long-lived agent-run lifecycle over HTTP/SSE. Every downstream set (web-tool-bridge, skill-invocation-ui, kanban-autopilot, agents-chats-tabs) consumes contracts produced here, so the primary mandate is **freezing the interface surface early** -- especially the SSE event schema, the `AgentRun` SQLite shape, and the `build_sdk_options()` signature -- and then filling in the implementation without further contract churn.

The implementation strategy is a standard FastAPI service layered on top of the Anthropic Claude Agent SDK (Python), backed by SQLite via SQLModel. `AgentSessionManager` is the lifespan-managed singleton that owns every live `ClaudeSDKClient`, gates concurrency with a per-project `asyncio.Semaphore`, and enforces a per-set semantic mutex via a SQLite partial unique index. Each run is modeled as an `AgentSession` async-context-manager that pumps SDK events onto a per-run `EventBus` (in-memory ring buffer + durable `agent_events` table for SSE replay via `?since=<seq>`). The dispatch endpoint returns `{run_id}` in under 200ms by offloading the actual SDK work to an `asyncio.Task` -- never BackgroundTasks, never synchronous -- matching the polling/streaming design the user's CLAUDE.md requires for long-running work.

Safety is the non-negotiable spine of this set. `build_sdk_options()` is the single source of truth for `ClaudeAgentOptions` and is unit-tested to always set `setting_sources=['project']`, never set `bypassPermissions`, scrub credential env vars, and thread `RAPID_RUN_ID` + `RAPID_RUN_MODE` into spawned skills. `can_use_tool` is paired with a no-op `PreToolUse` hook (an undocumented SDK quirk: the callback silently short-circuits without one) and checks an unoverridable `DESTRUCTIVE_PATTERNS` regex list before any per-skill allowlist. Orphan-subprocess reaping at startup, cost/turn budget tracking, and a canonical error taxonomy round out the operational contract so downstream sets can BLOCKED-resume cleanly.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `app/agents/sdk_options.py` | `build_sdk_options()` single-source-of-truth factory | New |
| `app/agents/session_manager.py` | `AgentSessionManager` lifespan service + semaphore + mutex | New |
| `app/agents/session.py` | `AgentSession` async-context-managed SDK wrapper + pump task | New |
| `app/agents/event_bus.py` | Per-run pub/sub, ring buffer, SQLite replay | New |
| `app/agents/permissions.py` | `DESTRUCTIVE_PATTERNS`, `PERMISSION_POLICY`, `can_use_tool` | New |
| `app/agents/budget.py` | `RunBudget` per-run turns + per-project daily USD cap | New |
| `app/agents/errors.py` | `SdkError`, `RunError`, `StateError`, `ToolError`, `UserError` taxonomy | New |
| `app/agents/mcp_registration.py` | `register_mcp_tools()` for downstream in-process `@tool` wiring | New |
| `app/agents/correlation.py` | `run_id` `contextvars.ContextVar` + logger filter | New |
| `app/models/agent_run.py` | `AgentRun` SQLModel (partial unique index, PID column) | New |
| `app/models/agent_event.py` | `AgentEvent` SQLModel (unique `(run_id, seq)`, batched writes) | New |
| `app/api/agents.py` | POST/GET `/api/agents/runs`, SSE `/events`, `/input`, `/interrupt` | New |
| `app/api/schemas/sse_events.py` | Typed SSE event payloads (kind union + Pydantic models) | New |
| `app/main.py` | FastAPI app wiring, lifespan, orphan sweeper on startup | New or Existing |
| `tests/agents/test_sdk_options.py` | Invariants: `setting_sources`, no `bypassPermissions`, env scrub | New |
| `tests/agents/test_permissions.py` | Destructive-pattern firewall, allowlist ordering | New |
| `tests/agents/test_dispatch_latency.py` | `<200ms` POST `/runs` assertion | New |
| `tests/agents/test_mutex_concurrency.py` | Per-set 409, semaphore cap of 3 | New |

## Integration Points

- **Exports (provided to downstream sets):**
  - `build_sdk_options()` -- used by every set that spawns an SDK session
  - `AgentSessionManager` / `AgentSession` / `EventBus` -- consumed by `agents-chats-tabs` for transcript streaming and by `kanban-autopilot` to launch runs
  - Typed SSE event schema (`assistant_text`, `thinking`, `tool_use`, `tool_result`, `ask_user`, `permission_req`, `status`, `run_complete`) -- hard contract for `web-tool-bridge`, `agents-chats-tabs`, `kanban-autopilot`, `skill-invocation-ui`
  - HTTP surface: `POST /api/agents/runs`, `GET /api/agents/runs/{id}`, `GET .../events` (SSE), `POST .../input`, `POST .../interrupt`, `POST .../answer`
  - `AgentRun` SQLModel -- referenced by FK from `kanban_card.agent_run_id`, `chat_message.agent_run_id`, `agent_prompts.run_id`
  - `register_mcp_tools()` -- extension point for `web-tool-bridge` (`ask_user`) and `kanban-autopilot` (`kanban_tools`)
  - `RAPID_RUN_ID` / `RAPID_RUN_MODE` env contract -- skills branch on these; enables additive CLI parity without forking skill prose
  - Error taxonomy classes -- every downstream set maps these to HTTP `error_code` responses
  - `RunBudget` -- dashboard endpoints surface remaining budget

- **Imports (consumed from other sets):** **none** -- `imports.fromSets = []`. This set sits at the root of the DAG.

- **Side Effects:**
  - Spawns SDK subprocess children (tracked via `agent_runs.pid`)
  - Writes to SQLite: `agent_runs`, `agent_events` (batched ~1/s), `agent_prompts`
  - Emits SSE streams (long-lived HTTP connections)
  - Startup-time sweep reconciles orphaned PIDs and marks `running`/`waiting` rows as `interrupted`
  - Reads `.claude/skills/*`, `CLAUDE.md`, and project-scoped slash commands via `setting_sources=['project']`

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| SDK silently short-circuits `can_use_tool` when no `PreToolUse` hook is registered (undocumented quirk) | High -- whole safety model nullified | Pair every `can_use_tool` registration with a no-op `PreToolUse` hook; unit test asserts both are present on every `ClaudeAgentOptions` |
| `bypassPermissions` propagates to subagents silently | High -- bypass escape hatch | Source-grep unit test forbids the string in any `options.*` construction; allowlist is explicit |
| Credential env leakage into spawned subprocess (`ANTHROPIC_API_KEY` etc.) | High -- key exfiltration via tool use | `options.env = {}` plus only `RAPID_RUN_ID` + `RAPID_RUN_MODE`; credentials via proxy `ANTHROPIC_BASE_URL` only; unit test inspects built env |
| POST `/runs` blocks on SDK startup and exceeds 200ms | High -- UI feels frozen, socket timeouts per user's CLAUDE.md guidance | Strict asyncio.Task dispatch (never BackgroundTasks, never synchronous); latency test in CI |
| Second run against same `(project_id, set_id)` races and produces double-execution | High -- corrupt state, duplicate commits | SQLite partial unique index on `(project_id, set_id) WHERE status='running'`; API handler returns 409 before any dispatch |
| SDK `>=0.1.59` concurrent-query warning above ~11 parallel sessions; SQLite write contention | Medium -- degraded throughput, flaky writes | Per-project `asyncio.Semaphore(3)` (configurable); batched event writes ~1/s |
| Crash leaves zombie SDK subprocesses burning API tokens | Medium -- cost leak | Startup orphan sweeper reconciles `agent_runs.pid` against live processes; marks orphans `interrupted` |
| SSE reconnect loses events emitted during disconnect | Medium -- transcript gaps | Durable `agent_events` table + in-memory ring buffer; `?since=<seq>` replay spans both |
| `run_id` correlation gaps (missing from a log line, SQL row, or .planning artifact) | Medium -- debugging nightmares spanning UI+backend+filesystem | `contextvars.ContextVar` + logger filter + SDK env injection; schema is load-bearing for 2 years of UI capabilities, so lock it down early |
| SSE event schema churn after downstream sets start consuming it | High -- blocks 4 downstream sets | Freeze typed payload shapes in Wave 1; treat schema changes as breaking and require all-set coordination |
| Worktree `cwd` confusion causes session transcripts to vanish when worktree is cleaned up | Medium -- lost observability | Session `cwd = project_root`; worktrees exposed via `additional_directories`; unit test asserts invariant |
| Budget tracking drifts from real spend | Low-Medium -- runaway cost | Record turn cost inline in SDK pump; per-project daily cap default `$10`; halt with `budget_exceeded` status |

## Wave Breakdown (Preliminary)

- **Wave 1 (Foundation):** `errors.py` taxonomy, SQLModel tables (`AgentRun`, `AgentEvent`) with indexes, `correlation.py` (run_id contextvar + logger filter), typed SSE event Pydantic models, `permissions.py` (`DESTRUCTIVE_PATTERNS` + `PERMISSION_POLICY` data only, no logic yet). These are pure-schema deliverables with no runtime dependencies; lock the interface before any SDK wiring.

- **Wave 2 (SDK Core):** `build_sdk_options()` with full unit-test invariant suite, `can_use_tool` + no-op `PreToolUse` hook, `EventBus` (ring buffer + SQLite persistence), `RunBudget`, `register_mcp_tools()` stub. All unit-testable without a live FastAPI app.

- **Wave 3 (Session Lifecycle):** `AgentSession` async-context-managed wrapper, `AgentSessionManager` with semaphore + partial-unique-index mutex + orphan sweeper, `send_input`/`interrupt` wiring. Integration-tested against real SDK.

- **Wave 4 (HTTP Surface + Integration):** FastAPI routes (`/runs`, `/events` SSE, `/input`, `/interrupt`, `/answer`), lifespan hook, dispatch-latency test, end-to-end smoke test. Final contract freeze before Wave 2 sets unblock.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during `/rapid:discuss-set` and `/rapid:plan-set`.
