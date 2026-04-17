# VERIFICATION-REPORT: agents-chats-tabs

**Set:** agents-chats-tabs
**Waves Verified:** 3 (wave-1, wave-2, wave-3)
**Verified:** 2026-04-16
**Overall Verdict:** PASS_WITH_GAPS

## Per-Wave Verdicts

| Wave | Verdict | Blocking Issues | Notes |
|------|---------|-----------------|-------|
| Wave 1 — Backend Foundation | PASS | none | Migration revision 0007 correctly follows 0006_kanban_v2_autopilot. All 4 backend exports covered. |
| Wave 2 — Frontend Foundation (hooks/stores/a11y) | PASS | none | All 4 exports covered; hook signatures match CONTRACT exactly; file ownership fully disjoint. |
| Wave 3 — Frontend Pages + Router | PASS_WITH_GAPS | 1 runtime dependency gap | Wave 3 correctly self-diagnoses a missing backend list endpoint (`GET /api/agents/runs`) but resolves it via BLOCKER-at-runtime rather than adding it to Wave 1. Plan is structurally sound. |

## Export Coverage

All 15 exports mapped exactly once. `sidebar_nav_extension` is the special case documented in Wave 3 as pre-existing.

| Export | Wave | Task(s) | Status | Notes |
|--------|------|---------|--------|-------|
| chat_schema | 1 | T1, T2, T3 | PASS | Chat, ChatMessage, ChatAttachment + AttachmentKind enum + migration |
| chat_service | 1 | T6 | PASS | create_thread, list_threads, get_thread, send_message, archive_thread, list_messages, _materialize_assistant_turn |
| chats_http | 1 | T7 | PASS | 7 endpoints including SSE; matches CONTRACT's 5-endpoint minimum |
| consolidated_dashboard_endpoint | 1 | T5, T8 | PASS | Schema + router with 1s LRU cache |
| use_agent_events_hook | 2 | T5 | PASS | Returns {events, status, reconnect} exactly per CONTRACT |
| use_chats_hook | 2 | T6 | PASS | Both useChats and useChatThread exported from same file |
| accessibility_hooks | 2 | T7, T8 | PASS | LiveRegion + useFocusTrap (narrowed surface per redesign_rename note) |
| vite_sse_proxy_config | 2 | T9 | PASS | SSE-aware headers injected via configure hook |
| agents_routes | 3 | T9 | PASS | 4 routes added (list + detail for agents and chats) |
| agents_page | 3 | T4 | PASS | Full rewrite; fixes existing nav bug (`AgentsPage.tsx:50-53`) |
| agent_run_page | 3 | T5 | PASS | New; no composer confirmed; Shift+P/Shift+S wired |
| chats_page | 3 | T6 | PASS | Full rewrite with archive filter |
| chat_thread_page | 3 | T7 | PASS | Composer, SlashAutocomplete, react-markdown + rehype-sanitize |
| empty_state_onboarding | 3 | T8 | PASS | AgentsEmptyState + ChatsEmptyState with 3-action lists |
| sidebar_nav_extension | — | — | PASS (pre-existing) | Verified `web/frontend/src/types/layout.ts` lines 37-38 already contain `ga=/agents, gc=/chats`. Wave 3 correctly declares no modification needed. |

## Behavioral Invariant Coverage

All 10 invariants (9 named + 1 rename reference) mapped to concrete tests or review enforcement.

| Invariant | Enforced By | Wave/Task | Status |
|-----------|-------------|-----------|--------|
| run_survives_tab_close | test (SSE reconnect w/ ?since=N) | Wave 2 T5, T10.3; Wave 3 T5, T10.3 | PASS |
| polling_primary_sse_augmentation | test (2-5s jittered poll + SSE streaming only) | Wave 2 T5, T10.3; Wave 1 T8 (dashboard) | PASS |
| status_pill_color_and_label | test (color tone AND text label) | Wave 3 T4, T10.1, T10.3 | PASS |
| keyboard_accessibility | test (Shift+P/Shift+S, focus trap, ESC) | Wave 2 T8, T10.6; Wave 3 T5, T10.3 | PASS |
| no_composer_on_run_detail | test (query textarea returns nothing) | Wave 3 T5, T10.3 | PASS |
| prefers_reduced_motion_respected | test (matchMedia mock → suppress animation) | Wave 3 T5, T10.3 | PASS |
| auto_scroll_opt_out | test (scroll-up disables auto; pill renders) | Wave 3 T5, T7, T10.3, T10.4 | PASS |
| empty_state_onboarding_present | test (rendered at 0 rows with 3 actions) | Wave 3 T8, T10.5 | PASS |
| adopts_wireframe_primitives | review (no new primitives shipped) | Wave 3 (review-enforced) | PASS |
| sidebar_shortcut_map_matches_context | review (ga=/agents, gc=/chats) | Pre-existing (verified) | PASS |

## File Ownership Exclusivity

No collisions detected between waves. Ownership is cleanly disjoint.

| File scope | Wave | Conflict? |
|------------|------|-----------|
| `web/backend/**` | Wave 1 only | None |
| `web/frontend/src/hooks/**` | Wave 2 (new hooks) + Wave 3 (useAgentRuns new) | None — different files (`useAgentRuns.ts` is Wave 3 only) |
| `web/frontend/src/stores/statusStore.ts` | Wave 2 only | None |
| `web/frontend/src/types/{chats,dashboard,sseEvents}.ts` | Wave 2 | None |
| `web/frontend/src/types/agents.ts` | Wave 3 T2 (new) | None (Wave 2 does not touch) |
| `web/frontend/src/components/a11y/**` | Wave 2 only | None |
| `web/frontend/vite.config.ts` | Wave 2 only | None |
| `web/frontend/src/pages/**` | Wave 3 only | None |
| `web/frontend/src/components/empty-states/**` | Wave 3 only | None |
| `web/frontend/src/router.tsx` | Wave 3 only | None |
| `web/frontend/package.json` | Wave 3 only | None |
| `web/frontend/src/types/layout.ts` | No wave (pre-existing) | None |

**Cross-wave coupling (expected, not a conflict):** Wave 3 pages IMPORT Wave 2 hooks and Wave 1 endpoints at runtime. Ownership (who writes the file) remains exclusive.

## Dependency Order

No circular deps. Linear chain verified:

- **Wave 2 → Wave 1:** `useChats`, `useChatThread`, `useDashboard` call `/api/chats`, `/api/dashboard` (Wave 1 endpoints).
- **Wave 3 → Wave 2:** AgentsPage/AgentRunPage/ChatsPage/ChatThreadPage import hooks from Wave 2.
- **Wave 3 → Wave 1:** pages call Wave 1 endpoints through Wave 2 hooks.
- **Execution order:** Wave 1 must merge before Wave 2 end-to-end smoke; Wave 2 must merge before Wave 3 integration tests pass. Wave 3 explicitly documents this in its Coordination Notes.

## Migration Revision Chain

Verified live against filesystem:

- `alembic/versions/0006_kanban_v2_autopilot.py` has `revision="0006", down_revision="0005"` (lines 15-16).
- Wave 1 T3 specifies `revision="0007", down_revision="0006"` — correct, non-colliding.
- Wave 1 correctly warns against using `"0006"` (quoting the actual line `0006_kanban_v2_autopilot.py:15`).

## File Reference Correctness

All existing file references verified on disk:

| File | Referenced by | Exists? |
|------|---------------|---------|
| `web/backend/app/models/agent_run.py` | W1 T1 pattern | YES |
| `web/backend/app/models/agent_event.py` | W1 T1 pattern | YES |
| `web/backend/app/models/agent_prompt.py` | W1 pattern | YES |
| `web/backend/app/routers/agents.py` | W1 T7 sibling pattern | YES |
| `web/backend/app/routers/notes.py` | Pattern reference | YES |
| `web/backend/app/routers/skills.py` | Pattern reference | YES |
| `web/backend/alembic/versions/0006_kanban_v2_autopilot.py` | W1 T3 collision check | YES (confirms 0006 taken) |
| `web/backend/app/services/agent_service.py` | W1 T6 pattern | YES |
| `web/backend/app/services/note_service.py` | W1 T6 pattern | YES |
| `web/backend/app/schemas/sse_events.py` | W2 T2 mirror | YES |
| `web/backend/app/schemas/agents.py` | W2 T2, W3 T2 mirror | YES |
| `web/frontend/src/components/primitives/index.ts` | W2/W3 composition | YES (exports PageHeader, EmptyState, StatCard, DataTable verified) |
| `web/frontend/src/hooks/useAgentEventStream.ts` | W2 T5 pattern reuse | YES |
| `web/frontend/src/hooks/useSkills.ts` | W3 T3 pattern | YES |
| `web/frontend/src/stores/projectStore.ts` | W2 T3 pattern | YES |
| `web/frontend/src/pages/AgentsPage.tsx` | W3 T4 rewrite target | YES (exists as stub) |
| `web/frontend/src/pages/ChatsPage.tsx` | W3 T6 rewrite target | YES (exists as stub) |
| `web/frontend/src/router.tsx` | W3 T9 update target | YES |
| `web/frontend/vite.config.ts` | W2 T9 update target | YES |
| `web/frontend/src/types/layout.ts` | Pre-existing, verified unchanged | YES (confirmed ga=/agents, gc=/chats) |
| `web/frontend/src/components/skills/SkillLauncher.tsx` | W3 T4 import | YES |
| `web/frontend/src/components/skills/SkillGallery.tsx` | W3 T6 import | YES |
| `web/frontend/src/components/prompts/AskUserModal.tsx` | W3 T5, T7 import | YES (found at `components/prompts/` not `tool-bridge/`) |
| `web/frontend/src/components/prompts/PendingPromptController.tsx` | W2 backward-compat note | YES |

## Gaps and Missing References (Findings)

### Gap 1 (PASS_WITH_GAPS — Wave 3): Missing backend list endpoint `GET /api/agents/runs`

**Severity:** Runtime dependency; plan self-diagnoses.

Wave 3 T3 defines `useAgentRuns` which calls `GET /api/agents/runs?project_id=X`. Verified against live `web/backend/app/routers/agents.py`: the router exposes:

- `POST /runs` (create)
- `GET /runs/{run_id}` (single)
- `GET /runs/{run_id}/events` (SSE)
- `GET /runs/{run_id}/pending-prompt`
- action POST endpoints

There is **no list-runs endpoint**. Wave 3 T3 correctly documents this: *"If only `GET /api/agents/runs/{id}` exists, surface this as a BLOCKER immediately (category DEPENDENCY) before continuing. Do NOT silently patch this into Wave 1."*

**Impact on verdict:**
- Does NOT fail Wave 3 structurally — the plan is explicit about what to do (BLOCK) and that it belongs to a different set (agent-runtime-foundation owns `runs_http_and_sse` import per CONTRACT.imports).
- However, it is an execution-time blocker for W3 T4 (AgentsPage DataTable) and integration tests.

**Recommendation (not a blocking fix):** Consider either
1. Adding a task to Wave 1 to ship `GET /runs?project_id=X&limit=&offset=` (small 10-line router handler + test), OR
2. Filing a cross-set dependency with agent-runtime-foundation to add the endpoint before Wave 3 execution begins.

Either path keeps the plan structurally PASS.

### Gap 2 (informational, no verdict impact): `ask_user_modal_components` import path

CONTRACT imports declares `AskUserModal / ApprovalModal / PermissionPrompt` from set `web-tool-bridge`. The live codebase has `AskUserModal` at `web/frontend/src/components/prompts/AskUserModal.tsx` (not in a `tool-bridge/` folder). No `ApprovalModal` or `PermissionPrompt` file was found under the frontend. Wave 3 T5 and T7 reference these by symbol; the actual import paths will need to resolve at implementation time.

**Impact:** Not a planning failure — imports are declared at the CONTRACT layer, not in individual task plans. The symbol-level reference in Wave 3 is correct; the filesystem layout is a Wave 3 implementation concern.

### Gap 3 (informational, no verdict impact): `useAutoScrollWithOptOut` / `usePrefersReducedMotion` location

CONTEXT line 192 states these live in `web/frontend/src/components/primitives/hooks/`. Wave 3 T5, T7 references them by name. This directory was not checked directly but is declared as wireframe-rollout Wave 1 territory — outside this set's scope. If wireframe-rollout Wave 1 hasn't landed these hooks, Wave 3 will need them from a fallback path. Wave 3 does not self-check this.

**Impact:** Not a planning failure — hooks belong to wireframe-rollout set; agents-chats-tabs correctly treats them as imports.

## Cross-Job / Cross-Wave Dependencies

| Dependency | Type | Handled |
|------------|------|---------|
| Wave 2 types mirror Wave 1 schemas | Shape-parity | Wave 2 T1/T2 explicitly cite Wave 1 T4/T5 schemas; tsc build catches drift |
| Wave 2 hooks call Wave 1 endpoints | Runtime | Wave 2 Coordination Notes document the merge order |
| Wave 3 pages import Wave 2 hooks | Compile-time | Wave 3 Coordination Notes document the merge order |
| Wave 3 requires Wave 1 `GET /runs` endpoint | **MISSING** | See Gap 1 |
| Wave 3 relies on `useAutoScrollWithOptOut`, `usePrefersReducedMotion` from wireframe-rollout | Cross-set | Treated as import; not this set's responsibility |

## Edits Made

None. No auto-fixes applied — all issues are either non-blocking informational gaps or self-diagnosed runtime dependencies that the plans themselves document correctly.

## Summary

The agents-chats-tabs plan set is structurally sound and cleanly scoped. All 15 CONTRACT exports are covered by exactly one wave (with `sidebar_nav_extension` explicitly and correctly declared pre-existing, verified on disk at `types/layout.ts:37-38`). All 10 behavioral invariants (9 contract + 1 rename reference) map to concrete test or review tasks. File ownership is fully disjoint across the three waves — Wave 1 is backend-only, Wave 2 owns hooks/stores/a11y/vite config, Wave 3 owns pages/router/empty-states/package.json. Migration revision 0007 correctly follows 0006 on the live alembic chain. One runtime gap exists: Wave 3's `useAgentRuns` hook calls a backend list endpoint (`GET /api/agents/runs`) that does not exist today; Wave 3 self-diagnoses this and declares the correct response (BLOCKED at execution), so the plan itself remains structurally valid. Recommend either adding a small T11 task to Wave 1 to ship the list endpoint or filing a cross-set dependency with agent-runtime-foundation before Wave 3 execution begins.
