# VERIFICATION-REPORT: web-tool-bridge

**Set:** web-tool-bridge
**Wave:** all (1-4)
**Verified:** 2026-04-15
**Verdict:** PASS_WITH_GAPS

## Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| `webui_ask_user_tool` export | Wave 1 Task 4 | PASS | tool created in `app/agents/tools/ask_user.py` |
| `ask_free_text_tool` export | Wave 1 Task 4 | PASS | same file, thin specialization |
| `ask_user_built_in_interception` export | Wave 1 Task 5 | PASS | splice design (a) in `permission_hooks.py` |
| `agent_prompts_model` export (with `consumed_at`) | Wave 1 Task 1 + 2 | PASS | model + migration 0005 both cover `consumed_at` |
| `answer_endpoint` export | Wave 1 Task 8 | PASS | replaces 501 stub at router.py:148 |
| `pending_prompt_endpoint` export | Wave 1 Task 8 | PASS | new GET endpoint added |
| `reopen_prompt_endpoint` export | Wave 1 Task 8 | PASS | new POST endpoint added |
| `ask_user_modal_component` export | Wave 2 Task 4 | PASS | component at `components/prompts/AskUserModal.tsx` |
| `skill_prose_patches` export (9 files, 118 sites) | Wave 3 Tasks 1-9 | PASS | counts confirmed: 13+38+25+3+3+19+4+5+8=118 matches live grep |
| `prompt_id_is_server_minted` behaviour | Wave 4 Task 2 + 4 | PASS | `test_ask_user_tool` + facade tests |
| `four_question_split_enforced` behaviour | Wave 4 Task 3 | PASS | parametrized over 1/2/4/5/6/12 questions |
| `cli_parity_additive_only` behaviour | Wave 4 Task 8 | PASS | Node `cli-parity-lint.test.cjs` enforces trio |
| `draft_persists_across_tab_close` behaviour | Wave 2 Task 4 (impl only) | GAP | No automated test; Wave 4 explicitly defers frontend tests per research finding 6. Impl is present in `AskUserModal`, but CONTRACT.json `enforced_by=test` is not honored |
| `back_navigation_reopen_respects_consume_race` behaviour | Wave 4 Task 5 | PASS | 5-case matrix covers pending/answered/stale × consumed_at |
| Imports from agent-runtime-foundation | Wave 1 (all tasks) | PASS | `build_sdk_options`, `can_use_tool`, `EventBus`, `register_mcp_tools`, `AgentRun`, `RAPID_RUN_MODE`, `create_sdk_mcp_server` all consumed |
| CONTEXT.md in-scope bullet: SSE `ask_user` event delivery | Wave 1 Task 3, 4, 5 | PASS | emits via `manager.event_bus`, AskUserEvent gets `prompt_id` field |
| CONTEXT.md in-scope bullet: sessionStorage draft | Wave 2 Task 4 | PASS | implemented; not tested (see above gap) |
| CONTEXT.md in-scope bullet: `RAPID_RUN_MODE=sdk` env gate | Wave 3 Tasks 1-9 | PASS | every site wrapped |
| CONTEXT.md in-scope bullet: 409 recovery UX | Wave 2 Task 5 | PASS | `PendingPromptController` handles toast + swap + previous-draft preservation |
| CONTEXT.md in-scope bullet: `AgentPrompt` active set = at most 1 pending per run | Wave 1 Task 1 (partial unique index) + Wave 4 Task 1 | PASS | index specified and tested |
| CONTEXT.md in-scope bullet: active-run wiring on Dashboard | Wave 2 Task 6 | GAP | deliberately mounted with `runId={null}` placeholder; non-testable end-to-end without a later set. Documented in both CONTEXT.md decisions and the plan |

## Implementability

| File | Job | Action | Status | Notes |
|------|-----|--------|--------|-------|
| `web/backend/app/models/agent_prompt.py` | Wave 1 Task 1 | Create | PASS | does not exist |
| `web/backend/alembic/versions/0005_agent_prompts.py` | Wave 1 Task 2 | Create | PASS | does not exist; 0004 is the current head |
| `web/backend/app/agents/tools/__init__.py` | Wave 1 Task 4 | Create | PASS | subdir does not exist |
| `web/backend/app/agents/tools/ask_user.py` | Wave 1 Task 4 | Create | PASS | does not exist |
| `web/backend/app/database.py` | Wave 1 Task 1 | Edit | PASS | exists |
| `web/backend/app/schemas/sse_events.py` | Wave 1 Task 3 | Edit | PASS | exists; `AskUserEvent` at line 47 |
| `web/backend/app/schemas/agents.py` | Wave 1 Task 3 | Edit | PASS | exists |
| `web/backend/app/agents/permission_hooks.py` | Wave 1 Task 5 | Edit | PASS | exists; already imports `PermissionResultDeny` |
| `web/backend/app/agents/session.py` | Wave 1 Task 6 | Edit | PASS | exists |
| `web/backend/app/agents/session_manager.py` | Wave 1 Task 7 | Edit | PASS | exists |
| `web/backend/app/routers/agents.py` | Wave 1 Task 8 | Edit | PASS | exists; 501 stub at line 148 confirmed |
| `web/backend/app/services/agent_service.py` | Wave 1 Task 8 | Edit | PASS | exists |
| `web/frontend/src/components/prompts/AskUserModal.tsx` | Wave 2 Task 4 | Create | PASS | subdir does not exist |
| `web/frontend/src/components/prompts/PendingPromptController.tsx` | Wave 2 Task 5 | Create | PASS | does not exist |
| `web/frontend/src/hooks/useAgentEventStream.ts` | Wave 2 Task 2 | Create | PASS | does not exist; sibling `use*.ts` hooks confirm convention |
| `web/frontend/src/hooks/useAnswerPrompt.ts` | Wave 2 Task 3 | Create | PASS | does not exist |
| `web/frontend/src/hooks/usePendingPrompt.ts` | Wave 2 Task 3 | Create | PASS | does not exist |
| `web/frontend/src/hooks/useReopenPrompt.ts` | Wave 2 Task 3 | Create | PASS | does not exist |
| `web/frontend/src/types/agentPrompt.ts` | Wave 2 Task 1 | Create | PASS | does not exist |
| `web/frontend/package.json` | Wave 2 Task 1 | Edit | PASS | exists |
| `web/frontend/src/App.tsx` | Wave 2 Task 1 | Edit | PASS | exists |
| `web/frontend/src/pages/DashboardPage.tsx` | Wave 2 Task 6 | Edit | PASS | exists |
| `skills/discuss-set/SKILL.md` (13 AUQ sites) | Wave 3 Task 1 | Edit | PASS | exists; live count = 13 (matches plan) |
| `skills/init/SKILL.md` (38 AUQ sites) | Wave 3 Task 2 | Edit | PASS | live count = 38 (matches plan) |
| `skills/new-version/SKILL.md` (25 AUQ sites) | Wave 3 Task 3 | Edit | PASS | live count = 25 (matches plan) |
| `skills/bug-fix/SKILL.md` (3 AUQ sites) | Wave 3 Task 4 | Edit | PASS | live count = 3 (matches plan) |
| `skills/scaffold/SKILL.md` (3 AUQ sites) | Wave 3 Task 5 | Edit | PASS | live count = 3 (matches plan) |
| `skills/branding/SKILL.md` (19 AUQ sites) | Wave 3 Task 6 | Edit | PASS | live count = 19 (matches plan) |
| `skills/quick/SKILL.md` (4 AUQ sites) | Wave 3 Task 7 | Edit | PASS | live count = 4 (matches plan) |
| `skills/assumptions/SKILL.md` (5 AUQ sites) | Wave 3 Task 8 | Edit | PASS | live count = 5 (matches plan) |
| `skills/add-set/SKILL.md` (8 AUQ sites) | Wave 3 Task 9 | Edit | PASS | live count = 8 (matches plan) |
| `web/backend/tests/agents/test_agent_prompt_model.py` | Wave 4 Task 1 | Create | PASS | does not exist |
| `web/backend/tests/agents/test_migration_0005.py` | Wave 4 Task 1 | Create | PASS | does not exist |
| `web/backend/tests/agents/test_ask_user_tool.py` | Wave 4 Task 2 | Create | PASS | does not exist |
| `web/backend/tests/agents/test_auq_interception.py` | Wave 4 Task 3 | Create | PASS | does not exist |
| `web/backend/tests/agents/test_prompt_manager_facade.py` | Wave 4 Task 4 | Create | PASS | does not exist |
| `web/backend/tests/agents/test_prompt_reopen_matrix.py` | Wave 4 Task 5 | Create | PASS | does not exist |
| `web/backend/tests/agents/test_prompts_router.py` | Wave 4 Task 6 | Create | PASS | does not exist |
| `web/backend/tests/agents/test_prompt_roundtrip_integration.py` | Wave 4 Task 7 | Create | PASS | does not exist |
| `tests/cli-parity-lint.test.cjs` | Wave 4 Task 8 | Create | PASS | does not exist; sibling `*.test.cjs` files confirm convention |

All 118 AUQ counts match the live codebase exactly (13+38+25+3+3+19+4+5+8 = 118). Wave 3 counts + Wave 4 lint expectations are aligned.

## Consistency

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| (all files) | single wave only | PASS | Every file is touched by exactly one wave. Wave 1 owns all `web/backend/app/` + migration files; Wave 2 owns all `web/frontend/src/` + `package.json` + `App.tsx` + `DashboardPage.tsx`; Wave 3 owns the 9 `skills/*/SKILL.md` files; Wave 4 owns only new `tests/` files. No overlap detected. |

Audited by scanning each wave's "Files Owned by this Wave (exclusive)" block and intersecting. No file appears in two wave ownership lists. Wave 4 explicitly creates only new files and states it will not edit production code.

## Cross-Job Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Wave 2 consumes backend endpoints created in Wave 1 | PASS_WITH_GAPS | Wave 2 must merge after Wave 1 OR be tested in isolation with mocks. `useAgentEventStream` points at `/api/agents/runs/:id/events` (Wave 1 responsibility via foundation) and the mutation hooks target the three new endpoints. If waves are executed in parallel, Wave 2 TS type-check passes without the backend; runtime verification of the happy path requires Wave 1. Plan acknowledges this implicitly. |
| Wave 3 skill prose references `mcp__rapid__webui_ask_user` and `mcp__rapid__ask_free_text` tool names created in Wave 1 | PASS_WITH_GAPS | Tool names are string literals in SKILL.md; no real runtime coupling in Wave 3. Correct invocation at runtime still depends on Wave 1 being merged. CLI mode is unaffected. |
| Wave 4 tests production code from Waves 1 + 3 | PASS | Wave 4 plan explicitly documents dependency: "Wave 4 MUST merge AFTER Wave 1 at minimum" and "Recommended merge order: Wave 1 → (Waves 2, 3, 4 in any order)". Ordering is feasible. |
| Wave 1 partial unique index `(run_id) WHERE status='pending'` is specified (Task 1, 2) AND tested (Wave 4 Task 1) | PASS | Pairing confirmed: Wave 1 Task 1 line 55 specifies the partial unique; Wave 1 Task 2 line 75 specifies `sqlite_where=sa.text("status = 'pending'")` in migration; Wave 4 Task 1 asserts "inserting two rows with the same `run_id` and `status='pending'` raises `IntegrityError`". |
| `consumed_at` column declared (Wave 1 Task 1) + reopen matrix tests it (Wave 4 Task 5) | PASS | Column is declared in the model (line 50), set by the tool body on future resolve (Wave 1 Task 4 step 7 and Wave 1 Task 6 session wiring), checked by `reopen_prompt` (Wave 1 Task 7 step 3), and tested by all 5 matrix cases (Wave 4 Task 5). Coherent end-to-end. |
| Reopen consume-race matrix 5 cases | PASS_WITH_GAPS | Case 1 (`pending, answered` → 400), Case 2 (`answered, pending, consumed_at=NULL` → 204), Case 3 (`answered, answered, consumed_at=NULL` → 204), Case 4 (`answered, answered, consumed_at=NOT NULL` → 409), Case 5 (`stale, answered` → 400). Cases are coherent and cover the key branches of `reopen_prompt` logic (Wave 1 Task 7 step 2-4). Minor gap: there is no case covering "run_id mismatch between URL and prompt_id owner" — low severity since the facade fetches by prompt_id and the router TestClient tests (Wave 4 Task 6) cover 404 separately. |

## Edits Made

| File | Change | Reason |
|------|--------|--------|
| (none) | — | No auto-fixes required. All files claimed "Create" are absent; all files claimed "Edit" exist; no ownership conflicts; AUQ counts match exactly; no trivial path typos detected. |

## Technical Soundness Notes

**Splice design (a) — `PermissionResultDeny` as tool-result delivery:** The plan commits to returning `PermissionResultDeny(behavior="deny", message=<json answers>, interrupt=False)` from `can_use_tool` and claims the SDK treats the Deny `message` as the tool-result payload. I confirmed that `PermissionResultDeny` is already imported in `permission_hooks.py:18` and that the foundation's existing Bash branch already uses it (line 46). However, the existing Bash `Deny` branch at line 46 exists for denials, not as an alternate success channel. **The plan's claim that "the SDK treats a Deny message as the tool_result payload delivered to the agent" is a research assertion that has not been independently verified in this verification pass.** If the SDK instead surfaces `Deny.message` as an error string to the agent (the more conventional interpretation), the interception would not round-trip answers correctly. **Wave 4 Task 3 (`test_auq_interception.py`) does not exercise this in a real `ClaudeSDKClient` end-to-end scenario** — it only asserts the `PermissionResultDeny` object shape. Wave 4 Task 7 (`test_prompt_roundtrip_integration.py`) uses a fake SDK client that "yields a single `AssistantMessage` with a `ToolUseBlock` whose `name == mcp__rapid__webui_ask_user`" — i.e., it bypasses the `AskUserQuestion` interception path entirely by directly calling the MCP tool. **Recommendation:** add a Wave 4 sub-test that uses the fake SDK client to drive an `AskUserQuestion` tool call and asserts the agent receives the answers via `Deny.message`. Flagged as PASS_WITH_GAPS gap, not FAIL, because the research claims to have verified this and the plan explicitly committed the decision; verifying the SDK contract requires live SDK reading outside this set's scope.

**Frontend `runId={null}` placeholder:** Wave 2 Task 6 commits to mounting `PendingPromptController` with a hardcoded `runId={null}`, which means end-to-end testability from the frontend is gated on a future set's activeRunId plumbing. This is explicitly documented as deliberate in the plan ("modal infrastructure is landed and the wiring turns on when a later set adds activeRunId"). **Acceptable scope — the set delivers all the required exports and behaviours; the integration point is tracked but non-blocking.**

**No frontend tests:** Wave 4 explicitly defers vitest+RTL. The CONTRACT.json behaviour `draft_persists_across_tab_close` declares `enforced_by=test`, which Wave 4 does not honor for the frontend half. This is a real contract-vs-plan gap. Flagged as PASS_WITH_GAPS per the user's guidance ("flag as PASS_WITH_GAPS if you believe the lack of vitest+RTL setup is a risk"). Suggest adding a single-file vitest setup + one RTL test for the sessionStorage round-trip in a follow-up set, or down-grading the contract to `enforced_by=manual` / `enforced_by=impl`.

**AUQ count parity:** Wave 3 expected counts (13+38+25+3+3+19+4+5+8=118) match live `grep -c AskUserQuestion` counts on all 9 skill files exactly. Wave 4 Task 8 lint test asserts the same expected counts per file. Counts line up end-to-end.

## Summary

All four wave plans are structurally sound: every requirement from CONTEXT.md and every export/behaviour from CONTRACT.json has a concrete task owner, file ownership is strictly exclusive across waves, all file references are valid against the live codebase, and the 118-site skill patch accounting matches live grep counts exactly. Two non-blocking gaps warrant PASS_WITH_GAPS rather than PASS: (1) the CONTRACT.json behaviour `draft_persists_across_tab_close` is declared test-enforced but Wave 4 has no frontend test harness, and (2) the splice-design (a) claim — that `PermissionResultDeny.message` is delivered to the agent as a tool_result payload — is not independently exercised by any end-to-end test in Wave 4 (the integration test uses the MCP tool path, not the AskUserQuestion interception path). Neither gap blocks execution; both can be addressed in a follow-up set or by tightening Wave 4 Task 7 before execution.
