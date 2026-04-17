# CONTEXT: kanban-autopilot

**Set:** kanban-autopilot
**Generated:** 2026-04-16
**Mode:** interactive

<domain>
## Set Boundary
Transforms the existing kanban board from a passive human-only task tracker into an agent-accessible work queue with autonomous execution capabilities. Covers: schema v2 migration with agent-tracking fields, kanban MCP tool registration for agents, optimistic concurrency with per-card rev numbers, an always-on autopilot poller that claims/routes/dispatches cards, per-column skill mapping, retry and failure handling, commit-trailer traceability, and UI badges for agent activity. Does NOT cover: admin UI for route customization, per-card cost budgets, or dedicated agent backlog triage workflows.
</domain>

<decisions>
## Implementation Decisions

### Autopilot Polling Strategy
- Fixed-interval poller at 60-second default (configurable). Fully decoupled from the kanban write path — no event-driven triggers or hybrid nudge signals.
- **Rationale:** Simplicity and isolation. Polls are cheap (lightweight SQL query), the write frequency of human card creation is low (minutes to hours), and the 60s cadence matches the existing orphan sweeper precedent. The decoupled design avoids coupling the worker to every mutation path.

### Card Lock & Concurrency Model
- Dual mechanism: SQL atomic `UPDATE ... WHERE locked_by_run_id IS NULL` for claim atomicity, plus per-card `rev` field for optimistic concurrency on all subsequent mutations during processing.
- **Rationale:** SQL-level locking prevents double-claim in a single atomic operation. Rev-based OCC on top protects against stale writes when both human and agent mutate the same card concurrently. Defense in depth covers both the claim and processing phases.

### Human-Agent Conflict Resolution
- Soft warning approach: UI shows an "agent is processing this card" indicator on locked cards. Human can still move the card after a confirmation dialog. The agent detects the card moved out from under it on its next tool call and gracefully stops the run.
- **Rationale:** Humans should never be blocked by agents. The soft warning prevents accidental moves while the confirmation dialog provides the escape hatch. Agent-side detection via card state check keeps the abort logic clean.

### Card-to-Skill Routing
- Per-column skill mapping: each autopilot-enabled column is configured with a target skill (e.g., "Bug Triage" column → `/rapid:bug-fix`). Configuration happens via the column ⋮ menu when enabling autopilot. Cards without a recognized label in the column default to `/rapid:quick`.
- **Rationale:** Per-column routing is more intuitive than per-label routing — users think in terms of "this column processes bugs" rather than "cards with a 'bug' label get routed." The column already represents a workflow stage, making it a natural routing boundary.

### Dispatch Confirmation Model (Two Modes)
- **Default mode (semi-automated):** Per-card confirmation before dispatch. The worker claims the card and surfaces it in the UI for human approval before starting an agent run. This is the safe default.
- **Full autopilot mode:** Toggle on per-column to skip confirmation and dispatch immediately. Enabled via the ⋮ menu with a confirmation dialog warning about cost implications.
- **Rationale:** Safety by default — agent runs cost money and have side effects (commits, file changes). Per-card confirmation gives humans oversight without losing the organizational benefit of the autopilot queue. Power users can opt into full autonomy per-column.

### Retry & Failure Policy
- Failure definition: foundation's `AgentRun.status` (`failed`/`interrupted` = retry) plus agent self-report (agent can explicitly mark a card as "unable to complete" to prevent wasteful retries of non-transient failures).
- Max 3 retries per card (configurable). On exhaustion: move card to "Blocked" column AND add a failure comment to the card with error details and retry history.
- **Rationale:** Run status catches crashes and timeouts (transient). Agent self-report catches "I can't do this" (non-transient), preventing token waste on doomed retries. Failure comments provide inline debugging context so humans can triage without checking logs.

### board.json Projection
- Synchronous regeneration after every kanban mutation (preserving current behavior). board.json includes the new agent metadata fields (`created_by`, `locked_by_run_id`, `completed_by_run_id`, `agent_status`, `metadata`).
- **Rationale:** Consistency over performance. The sync regen is simple and CLI reads are always fresh. Agent metadata fields in the projection enable `/rapid:status` to show autopilot activity and serve as a debugging aid.

### Autopilot Worker Lifecycle
- Always-on at FastAPI startup. Polls are no-ops when no autopilot columns exist. Shares the per-project semaphore from the foundation.
- Backpressure handling: claim + queue in memory. When the semaphore is saturated, the worker still claims unclaimed cards (sets `locked_by_run_id`) to prevent double-claim, but queues the dispatch in memory until a semaphore slot opens.
- Crash recovery: extend the existing orphan sweeper to also check for locked kanban cards with no matching active agent run, and unlock them.
- **Rationale:** Always-on avoids dynamic lifecycle complexity. Claim+queue prevents the starvation scenario where manual runs permanently block autopilot cards from being noticed. The orphan sweeper extension handles the crash case where in-memory queue is lost but SQL locks persist.

### Agent Kanban Tool Surface
- Read: full access to all cards and columns (`list_cards`, `get_card`).
- Write: scoped to the agent's claimed card (`move_card`, `update_card`, `comment_card` — own card only).
- Create: allowed with a cap of 5 new cards per run, into the originating column or a designated column.
- Delete: NEVER permitted. No `delete_card` or `delete_column` tool is exposed to agents.
- **Rationale:** Agents need read access for context and write access for their mission, but broad write access risks accidental board reorganization. The create cap enables sub-task decomposition without flood risk. The hard no-delete rule prevents irreversible data loss from agent errors.

### UI Badges & Indicators
- Rich telemetry on kanban cards: the 4 CONTRACT-specified StatusBadge states (claimed/info, created/highlight, completed/accent, blocked/error) plus live run duration, cost, and skill name on active cards. Retry count visible only on Blocked cards.
- Autopilot toggle: accessible via column ⋮ menu with a confirmation dialog on enable. Active autopilot columns show a subtle icon in the header. The menu also exposes skill assignment and the full-autopilot mode toggle.
- **Rationale:** Rich telemetry gives operators real-time visibility into agent activity directly on the board, avoiding the need to switch to the Agents tab for monitoring. The ⋮ menu toggle with confirmation prevents accidental autopilot activation while keeping the UI clean.

### Claude's Discretion
- No areas were left to Claude's discretion — all 8 gray areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- Per-column routing means each column's ⋮ menu becomes the central configuration surface: autopilot toggle, skill assignment, full-autopilot mode toggle, and confirmation about cost
- The two-mode dispatch (semi-automated default vs full autopilot) should be clearly distinguished in the UI — perhaps a visual indicator on the column header that differentiates "autopilot (confirming)" from "autopilot (autonomous)"
- Agent self-report for "unable to complete" should use a dedicated tool or return value, not just a comment — this feeds directly into the retry/skip decision
- Failure comments on Blocked cards should include: error summary, retry count, skill name, run IDs, and a link to the agent run detail page
- The 5-card-per-run creation cap should be enforced server-side in the tool handler, not just documented
</specifics>

<code_context>
## Existing Code Insights
- `kanban_service.py` follows a clean pattern: each mutation calls `_sync_board()` at the end to regenerate board.json. New methods (lock_card, unlock_card) should follow this same pattern.
- `KanbanCard` and `KanbanColumn` are SQLModel classes in `database.py`. New fields are added directly to these models with Alembic migrations for schema evolution.
- The existing `move_card()` handles both same-column reordering and cross-column moves with position shifting — the new rev-based OCC wraps this existing logic.
- `AgentSessionManager.start_run()` returns <200ms (inserts pending row, dispatches asyncio task) — autopilot worker calls this for each claimed card.
- Agent tools in `app/agents/tools/ask_user.py` follow the pattern: `@tool` decorator, emit SSE events, await futures for user responses. Kanban tools follow the same pattern but are synchronous (no user input needed).
- The orphan sweeper runs at 60s intervals via `asyncio.create_task` in the lifespan — kanban lock cleanup hooks into this same loop.
- Frontend kanban uses `@dnd-kit/sortable` for drag-drop. StatusBadge and SurfaceCard primitives from wireframe-rollout are available for agent state badges.
- The `AgentRun` model has `status`, `total_cost_usd`, `turn_count` — these feed the rich telemetry badges on kanban cards.
</code_context>

<deferred>
## Deferred Ideas
- SQLite-configurable route table for per-project routing customization and admin UI
- Per-card cost budget limits beyond the per-project daily cap
- Dedicated "Agent Backlog" column auto-created for agent-created card triage
</deferred>
