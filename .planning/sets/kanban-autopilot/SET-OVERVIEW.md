# SET-OVERVIEW: kanban-autopilot

## Approach

This set transforms the existing kanban board from a passive human-only task tracker into an agent-accessible work queue with autonomous execution capabilities. The core problem is bridging the gap between human-created kanban cards and RAPID's agent runtime: cards in "autopilot-enabled" columns should be automatically claimed, routed to the appropriate RAPID skill, executed, and marked complete -- without human intervention.

The implementation has three layers. First, the schema evolution: an Alembic migration extends `KanbanColumn` with an `is_autopilot` flag and `KanbanCard` with agent-tracking fields (`created_by`, `locked_by_run_id`, `completed_by_run_id`, `agent_status`, `metadata`, `agent_run_id` FK). This establishes SQLite as the canonical state store, with `board.json` demoted to a read-only projection regenerated after every mutation. Second, the agent tooling layer: a set of `@tool`-decorated functions (list, get, add, move, update, comment) registered via the foundation's `register_mcp_tools` helper, giving any agent run direct kanban CRUD access with optimistic concurrency (per-card `rev` numbers). Third, the autopilot loop: a lifespan-managed async poller that scans autopilot columns, claims unclaimed cards via atomic SQL lock, routes each card to a skill based on its labels, dispatches runs through `AgentSessionManager`, and handles retries (max 3) and failure (move to "Blocked" column).

The sequencing is: schema migration first, then service-layer extensions with concurrency controls, then MCP tool registration, then the autopilot worker and skill file, and finally UI badge integration using wireframe-rollout primitives.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `web/backend/app/database.py` | KanbanColumn + KanbanCard SQLModels (add new fields) | Existing -- modify |
| `web/backend/alembic/versions/0006_kanban_v2_autopilot.py` | Schema v2 migration + backfill | New |
| `web/backend/app/services/kanban_service.py` | Extended CRUD with rev-based concurrency, lock/unlock, board.json regen | Existing -- extend |
| `web/backend/app/agents/tools/kanban_tools.py` | `@tool` functions (list, get, add, move, update, comment) | New |
| `web/backend/app/agents/autopilot_worker.py` | Lifespan-managed async poller for autopilot columns | New |
| `web/backend/app/agents/card_routing.py` | Label-based card-to-skill routing logic | New |
| `skills/rapid:autopilot/SKILL.md` | Autopilot skill definition | New |
| `web/backend/app/schemas/kanban.py` | Extended request/response schemas with agent fields | Existing -- extend |
| `web/backend/app/routers/kanban.py` | Updated endpoints for new fields (is_autopilot, labels) | Existing -- extend |
| `web/frontend/src/components/kanban/KanbanCard.tsx` | Agent status badges (claimed, created, completed, blocked) | Existing -- extend |
| `web/frontend/src/components/kanban/KanbanColumn.tsx` | Autopilot toggle indicator on column header | Existing -- extend |

## Integration Points

- **Exports:**
  - `kanban_v2_schema` -- Extended SQLModels with agent-tracking columns, consumed by any future set needing kanban state
  - `kanban_tools` -- In-process `@tool` functions registered via MCP, available to any agent run
  - `kanban_service_extensions` -- `move_card` with rev-based OCC, `lock_card`/`unlock_card` for atomic claim
  - `autopilot_worker` -- Lifespan-managed poller dispatching runs through `AgentSessionManager`
  - `card_to_skill_routing` -- Label-based routing (bug -> bug-fix, feature -> add-set, default -> quick)
  - `commit_trailer_traceability` -- `Autopilot-Card-Id:` and `Autopilot-Run-Id:` git trailers
  - `ui_agent_badges` -- StatusBadge instances per agent state on kanban cards

- **Imports (all from agent-runtime-foundation):**
  - `register_mcp_tools` -- Registers kanban `@tool` functions into the SDK MCP server
  - `AgentSessionManager.start_run` -- Dispatches autopilot runs for claimed cards
  - `build_sdk_options` -- Kanban MCP server registered into agent options
  - `AgentRun` SQLModel -- FK target for `agent_run_id` and `completed_by_run_id`
  - `run_id` correlation -- Used for `locked_by_run_id` ownership and commit trailers
  - Permission policy registry -- Adds `autopilot` entry with restricted Bash allowlist

- **Side Effects:**
  - `board.json` on disk is regenerated after every kanban mutation (read-only projection)
  - Autopilot worker starts automatically at FastAPI lifespan startup
  - Cards that fail 3 times are moved to a "Blocked" column and stop retrying

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Autopilot runaway loops burning tokens if retry logic is buggy | High | Hard cap of N=3 retries per card; card-level timeout; "Blocked" column halts all retries; per-project daily cost cap from foundation |
| Optimistic concurrency (rev) causing frequent StaleRevError when human and agent mutate simultaneously | Medium | Re-read before write pattern in service layer; agent tools retry once on StaleRevError before surfacing failure |
| Prompt injection via card descriptions (user-controlled text fed to agent prompts) | High | All card descriptions wrapped in `<untrusted>...</untrusted>` delimiters; enforced by test |
| Migration backfill on large boards could be slow or fail | Low | Alembic migration uses batch operations; backfill sets safe defaults (created_by='human', agent_status='idle'); tested against empty and populated boards |
| Race condition in lock_card if two poller cycles overlap | Medium | Atomic SQL UPDATE WHERE locked_by_run_id IS NULL prevents double-claim; single poller instance via lifespan management |
| Dependency on wireframe-rollout primitives (SurfaceCard, StatusBadge) for UI badges | Medium | UI badge work is the final wave; if wireframe-rollout is not merged, badges can use existing styling as fallback and be updated post-merge |

## Wave Breakdown (Preliminary)

- **Wave 1:** Schema and service foundation -- Alembic v2 migration with backfill, extend KanbanCard/KanbanColumn SQLModels, add `rev` field and optimistic concurrency to kanban_service (`move_card`, `update_card`, `lock_card`, `unlock_card`), enforce board.json as read-only projection, update Pydantic schemas and router endpoints
- **Wave 2:** Agent tooling and autopilot core -- `kanban_tools.py` with `@tool` decorators (list, get, add, move, update, comment), MCP registration via `register_mcp_tools`, card-to-skill routing module, `autopilot_worker.py` async poller with retry/blocked policy, `SKILL.md` for autopilot skill, commit-trailer injection via PreToolUse hook
- **Wave 3:** UI integration -- Agent status badges on KanbanCard (claimed, created, completed, blocked) using wireframe-rollout primitives (SurfaceCard, StatusBadge), autopilot toggle on KanbanColumn header, "Run with RAPID" action button on cards

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
