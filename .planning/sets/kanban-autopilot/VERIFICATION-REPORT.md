# VERIFICATION-REPORT: kanban-autopilot (All Waves)

**Set:** kanban-autopilot
**Waves:** wave-1, wave-2, wave-3
**Verified:** 2026-04-16
**Verdict:** PASS_WITH_GAPS

## Coverage

### CONTRACT.json Exports

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| `kanban_v2_schema` — KanbanCard agent fields, KanbanColumn.is_autopilot | Wave 1 Tasks 1-2 | PASS | All fields specified in contract signature present in Wave 1 plan |
| `kanban_tools` — list_cards, get_card, add_card, move_card, update_card, comment_card | Wave 2 Task 1 | PASS | All 6 @tool functions planned with correct signatures |
| `kanban_service_extensions` — move_card, update_card, lock_card, unlock_card | Wave 1 Task 3 | PASS | All 4 service functions planned with rev-based OCC |
| `autopilot_worker` — run_autopilot_loop | Wave 2 Task 4 | PASS | AutopilotWorker class with start/stop/poll_loop planned |
| `card_to_skill_routing` — route_card_to_skill(card) -> (skill_name, args) | Wave 2 Task 3 | PASS | Function signature matches contract. Implementation uses label-based routing (see note below) |
| `retry_and_blocked_policy` — max 3 retries, card-level timeout, move to Blocked | Wave 2 Task 4 | PASS | retry_count >= 3 skip logic + move to Blocked planned |
| `commit_trailer_traceability` — Autopilot-Card-Id + Autopilot-Run-Id trailers | None | MISSING | No wave plan addresses commit trailer injection. Contract requires every autopilot commit to append these trailers. |
| `ui_agent_badges` — StatusBadge instances per agent state | Wave 3 Tasks 2-3 | PASS | AgentStatusBadge component with claimed/running/blocked/completed/agent-created states |
| `kanban_column_surface` — KanbanColumn composed from SurfaceCard + header | Wave 3 Task 4 | PASS | KanbanColumn updated with autopilot toggle |

### CONTRACT.json Behavioral Contracts

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| `board_json_is_read_only_projection` — regenerated from SQLite after every mutation | Wave 1 Task 3 (all mutations call _sync_board) | PASS | Existing pattern preserved; new functions follow same pattern |
| `optimistic_concurrency_via_rev` — StaleRevError on rev mismatch | Wave 1 Tasks 3d, 3e | PASS | StaleRevisionError defined; move_card and update_card check rev |
| `max_3_retries_per_card` — card moves to Blocked after 3 failures | Wave 2 Task 4 | PASS | retry_count >= 3 skip logic planned |
| `card_description_untrusted_wrapped` — descriptions wrapped as untrusted | Wave 2 Task 1 | PASS | Explicitly documented and tested (test_get_card_wraps_description_untrusted) |
| `autopilot_worker_respects_concurrency_cap` — does NOT bypass per-project semaphore | Wave 2 Task 4 | PASS | Uses session_manager.start_run which handles semaphore |
| `locked_by_run_id_prevents_double_claim` — atomic lock acquisition | Wave 1 Task 3b | PASS | Uses SQL UPDATE ... WHERE locked_by_run_id IS NULL |
| `commit_trailer_present_on_every_autopilot_commit` — trailers on commits | None | MISSING | Same as commit_trailer_traceability export above |
| `adopts_wireframe_primitives` — composes SurfaceCard, StatusBadge | Wave 3 Tasks 2-3 | PASS | AgentStatusBadge uses consistent Tailwind tone patterns |

### CONTEXT.md Implementation Decisions

| Decision | Covered By | Status | Notes |
|----------|------------|--------|-------|
| Autopilot Polling Strategy — 60s fixed interval, decoupled | Wave 2 Task 4 | PASS | AutopilotWorker with interval_s=60.0 default |
| Card Lock & Concurrency Model — dual mechanism (SQL atomic + rev OCC) | Wave 1 Tasks 3b-3e | PASS | Both mechanisms planned |
| Human-Agent Conflict Resolution — soft warning, confirmation dialog | Wave 3 Tasks 3-4 | GAP | Left border accent on agent-active cards is planned; however, no confirmation dialog for human moving agent-locked card is implemented in any wave |
| Card-to-Skill Routing — per-column skill mapping | Wave 2 Task 3 | GAP | Plan implements label-based routing, not per-column mapping. The contract signature (card -> skill) is satisfied, but the CONTEXT decision specified per-column routing via column menu. Wave 2 code comments note "configurable via column settings in future" |
| Dispatch Confirmation Model — semi-automated default + full autopilot toggle | None | MISSING | No wave plan implements per-card confirmation before dispatch. The autopilot worker dispatches immediately. Neither the semi-automated mode nor the full-autopilot mode toggle is planned. |
| Retry & Failure Policy — agent self-report + max 3 retries | Wave 2 Task 4 | GAP | Max 3 retries and move-to-Blocked are planned. However, agent self-report ("unable to complete" tool/return value) is not planned. Only run status-based failure detection is implemented. |
| board.json Projection — sync regen with agent metadata | Wave 1 Tasks 3g-3h | PASS | get_board extended with all agent fields |
| Autopilot Worker Lifecycle — always-on, claim+queue backpressure, orphan sweeper extension | Wave 2 Tasks 4, 7 | GAP | Always-on lifecycle planned. Claim+queue backpressure for semaphore saturation NOT planned. Orphan sweeper extension for locked kanban cards NOT planned. |
| Agent Kanban Tool Surface — read all, write own, create cap 5, no delete | Wave 2 Task 1 | PASS | All scoping rules implemented: lock check on move/update, 5-card cap, no delete tool |
| UI Badges & Indicators — rich telemetry, autopilot toggle | Wave 3 Tasks 2-5 | GAP | Badge states and autopilot toggle planned. Live run duration/cost/skill name on active cards NOT planned. Column menu skill assignment NOT planned (only simple button toggle). |

## Implementability

### Wave 1

| File | Action | Status | Notes |
|------|--------|--------|-------|
| `web/backend/app/database.py` | Modify | PASS | File exists on disk |
| `web/backend/alembic/versions/0006_kanban_v2_autopilot.py` | Create | PASS | Does not exist; 0005 is latest migration |
| `web/backend/app/services/kanban_service.py` | Modify | PASS | File exists on disk |
| `web/backend/app/schemas/kanban.py` | Modify | PASS | File exists on disk |
| `web/backend/tests/test_kanban_service.py` | Create | PASS | Does not exist on disk |

### Wave 2

| File | Action | Status | Notes |
|------|--------|--------|-------|
| `web/backend/app/agents/tools/kanban_tools.py` | Create | PASS | Does not exist on disk |
| `web/backend/app/agents/tools/__init__.py` | Modify | PASS | File exists on disk |
| `web/backend/app/agents/card_routing.py` | Create | PASS | Does not exist on disk |
| `web/backend/app/agents/autopilot_worker.py` | Create | PASS | Does not exist on disk |
| `web/backend/app/agents/permissions.py` | Modify | PASS | File exists on disk |
| `web/backend/app/routers/kanban.py` | Modify | PASS | File exists on disk |
| `web/backend/app/main.py` | Modify | PASS | File exists on disk |
| `web/backend/tests/test_kanban_tools.py` | Create | PASS | Does not exist on disk |
| `web/backend/tests/test_card_routing.py` | Create | PASS | Does not exist on disk |
| `web/backend/tests/test_autopilot_worker.py` | Create | PASS | Does not exist on disk |

### Wave 3

| File | Action | Status | Notes |
|------|--------|--------|-------|
| `web/frontend/src/types/api.ts` | Modify | PASS | File exists on disk |
| `web/frontend/src/components/kanban/KanbanCard.tsx` | Modify | PASS | File exists on disk |
| `web/frontend/src/components/kanban/KanbanColumn.tsx` | Modify | PASS | File exists on disk |
| `web/frontend/src/components/kanban/CardDetailModal.tsx` | Modify | PASS | File exists on disk |
| `web/frontend/src/hooks/useKanban.ts` | Modify | PASS | File exists on disk |
| `web/frontend/src/components/kanban/AgentStatusBadge.tsx` | Create | PASS | Does not exist on disk |
| `web/frontend/src/pages/KanbanBoard.tsx` | Modify | PASS | File exists on disk |

## Consistency

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| No file ownership conflicts detected | — | PASS | Each wave owns distinct files. Waves are sequential (Wave 2 depends on Wave 1, Wave 3 depends on Wave 2), so no parallel execution conflicts. |

## Cross-Job Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Wave 2 depends on Wave 1 schema + service outputs | PASS | Wave 2 prerequisites list correctly identifies all consumed artifacts |
| Wave 3 depends on Wave 1 + Wave 2 API outputs | PASS | Wave 3 prerequisites correctly specify both prior waves |
| Wave 2 kanban_tools consume Wave 1 kanban_service extensions | PASS | All service functions referenced in tool implementations are planned in Wave 1 |
| Wave 2 autopilot_worker consumes Wave 1 lock_card/unlock_card | PASS | Correct dependency chain |
| Wave 3 TypeScript types depend on Wave 2 router changes | PASS | New API fields from Wave 1 schema + Wave 2 router are reflected in Wave 3 type updates |

## Edits Made

| File | Change | Reason |
|------|--------|--------|
| None | — | No auto-fixes applied. All issues are either scope gaps requiring human decision or missing features that cannot be auto-fixed. |

## Summary

**Verdict: PASS_WITH_GAPS**

All three wave plans are structurally sound: file references are valid, no ownership conflicts exist, the sequential dependency chain is correctly specified, and the core schema/service/tools/UI pipeline covers the majority of the contract. However, there are notable gaps against the CONTEXT.md decisions and CONTRACT.json exports:

1. **MISSING: commit_trailer_traceability** -- No wave plan addresses injecting `Autopilot-Card-Id` and `Autopilot-Run-Id` trailers into git commits made during autopilot runs. This is a contract export and a behavioral contract.
2. **MISSING: Dispatch Confirmation Model** -- The CONTEXT.md decision specifying semi-automated (per-card confirmation before dispatch) as the default mode, with a full-autopilot toggle, is entirely absent from all wave plans. The autopilot worker dispatches immediately without confirmation.
3. **GAP: Per-column skill routing** -- CONTEXT specifies per-column routing (each column configured with a target skill via the column menu), but Wave 2 implements label-based routing. The contract function signature is satisfied, but the routing paradigm differs from the design decision.
4. **GAP: Agent self-report** -- CONTEXT mentions agents can self-report "unable to complete" to prevent wasteful retries of non-transient failures. No tool or mechanism for this is planned.
5. **GAP: Backpressure claim+queue** and **orphan sweeper extension** from CONTEXT are not planned.
6. **GAP: Rich telemetry** -- Live run duration, cost, and skill name on active cards (mentioned in CONTEXT) are not in the Wave 3 plan.

These gaps do not block execution -- the plans deliver a functional autopilot system. The MISSING items should be addressed in a follow-up wave or amendment to Wave 2.
