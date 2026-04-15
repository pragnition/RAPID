# Wave 4 — Cross-cutting Tests

## Objective

Add the tests that prove the bridge works end-to-end and that the skill patches in Wave 3 are structurally correct. Includes: backend unit tests for the new tool module and manager facade, integration tests covering the reopen consume-race state matrix, router tests for the three new endpoints, and a Node-based skill-prose lint test that enforces the `if/else/AUQ` trio at every patched call site.

## Committed Decisions (carried forward from research)

- **No frontend tests.** Per research finding 6, the repo has zero frontend test infrastructure and CONTEXT.md's simplicity ethos argues against a vitest+RTL wave. Back-navigation behaviour is covered by Python integration tests that drive the manager facade directly.
- **CLI-parity test is a cheap static lint**, not a real CLI smoke. `tests/cli-parity-lint.test.cjs` greps each patched SKILL.md for the if/else/built-in trio. Adding a real `claude -p /rapid:execute-set` smoke would require a fixture and is deferred to a later set.
- **The reopen consume-race test matrix is 5 cases** (per research finding 8):
  1. `(pending, answered)` — target is pending → 400 on reopen.
  2. `(answered, pending) with consumed_at IS NULL` — target is answered-but-unconsumed → 204, downstream marked stale.
  3. `(answered, answered) with consumed_at IS NULL` — target answered-and-unconsumed, downstream already answered → 204, downstream marked stale.
  4. `(answered, answered) with consumed_at IS NOT NULL` — consumed → 409.
  5. `(stale, answered)` — target already stale → 400 (nothing meaningful to reopen).

## Files Owned by this Wave (exclusive)

Create:
- `web/backend/tests/agents/test_agent_prompt_model.py` — model-level tests (partial unique, composite index, roundtrip).
- `web/backend/tests/agents/test_migration_0005.py` — alembic upgrade/downgrade roundtrip + column presence.
- `web/backend/tests/agents/test_ask_user_tool.py` — unit tests for the `webui_ask_user` / `ask_free_text` tool functions.
- `web/backend/tests/agents/test_auq_interception.py` — `can_use_tool_hook` branch test: AUQ with 2, 4, 6, 12 questions; 6 and 12 exercise split.
- `web/backend/tests/agents/test_prompt_manager_facade.py` — `resolve_prompt`, `get_pending_prompt`, `reopen_prompt` unit tests.
- `web/backend/tests/agents/test_prompt_reopen_matrix.py` — the 5-case back-navigation state matrix, each as its own parametrized test.
- `web/backend/tests/agents/test_prompts_router.py` — TestClient tests for `/answer`, `/pending-prompt`, `/prompts/{id}/reopen`.
- `web/backend/tests/agents/test_prompt_roundtrip_integration.py` — end-to-end test that simulates `webui_ask_user` being called, emits the event, POSTs an answer, and asserts the tool result is delivered. Uses a fake SDK client (see `test_session.py` for the pattern).
- `tests/cli-parity-lint.test.cjs` — Node test that asserts the if/else/AUQ trio at each call site of the 9 patched skills.

**Do NOT edit** the production backend code, frontend code, or skill files. If a test failure reveals a production bug, **report BLOCKED** with category DEPENDENCY and cite the wave that owns the file.

## Tasks

### Task 1 — Model + migration tests

**Files:** `test_agent_prompt_model.py`, `test_migration_0005.py`

Model tests:
- Round-trip insert/read of an `AgentPrompt` row.
- Partial unique index: inserting two rows with the same `run_id` and `status='pending'` raises `IntegrityError`. Inserting the second with `status='answered'` does NOT.
- Composite `(run_id, created_at)` index exists (inspect `AgentPrompt.__table__.indexes`).

Migration tests (mirror `test_migration_0004.py`):
- `alembic upgrade 0005` creates the `agentprompt` table with the expected columns.
- `alembic downgrade -1` drops it cleanly.
- `alembic upgrade head` after downgrade works.

**Verification:**
```bash
cd web/backend && uv run pytest tests/agents/test_agent_prompt_model.py tests/agents/test_migration_0005.py -x
```

### Task 2 — `webui_ask_user` / `ask_free_text` tool tests

**File:** `test_ask_user_tool.py`

Mock `AgentSessionManager` (or use a real one with sqlite in-memory + an EventBus). Exercise:
- Happy path: `webui_ask_user({"question":"pick one","options":["a","b"],"allow_free_text":false})` emits an `AskUserEvent` via the bus, persists a `pending` `AgentPrompt` row. The call blocks until the test resolves the future via `manager.resolve_prompt(prompt_id, "a")`. The tool returns `{"content":[{"type":"text","text":"a"}], "is_error": False}`. Post-condition: row status is `answered`, `answered_at` set, `consumed_at` set.
- `ask_free_text` variant: options forced null, allow_free_text forced true.
- CancelError propagation: simulate `asyncio.CancelledError` during `await future`; assert the prompt row is marked `stale` and the exception is re-raised.

**Verification:**
```bash
cd web/backend && uv run pytest tests/agents/test_ask_user_tool.py -x
```

### Task 3 — `can_use_tool` AUQ interception tests

**File:** `test_auq_interception.py`

Parametrize over `questions_count ∈ {1, 2, 4, 5, 6, 12}`:
- Mock manager and EventBus.
- Invoke `can_use_tool_hook("AskUserQuestion", {"questions": [...]}, context)`.
- Kick off the hook in an asyncio task, resolve each emitted prompt in order, collect the synthesized `PermissionResultDeny` message.
- Assertions:
  - Number of emitted `ask_user` events equals `ceil(questions_count / 4)`.
  - Each event carries `batch_id` consistent across siblings, unique `batch_position`.
  - The final `PermissionResultDeny.message` parses as JSON with an `answers` list whose length equals `questions_count`.
  - Answers are ordered to match the input questions.

**Verification:**
```bash
cd web/backend && uv run pytest tests/agents/test_auq_interception.py -x
```

### Task 4 — Manager facade tests

**File:** `test_prompt_manager_facade.py`

Target: `resolve_prompt`, `get_pending_prompt`, `reopen_prompt` in isolation with a real in-memory SQLite.

Cases:
- `resolve_prompt(unknown_id)` → `StateError(error_code="prompt_not_found")`.
- `resolve_prompt` on a `stale` prompt → `StateError(error_code="prompt_stale")`.
- `get_pending_prompt(run_with_no_pending)` → None.
- `get_pending_prompt(run_with_one_pending)` → that row.
- Concurrency: two `resolve_prompt` calls with the same prompt_id race; only one resolves the future, the other raises `prompt_stale`.

**Verification:**
```bash
cd web/backend && uv run pytest tests/agents/test_prompt_manager_facade.py -x
```

### Task 5 — Reopen consume-race matrix

**File:** `test_prompt_reopen_matrix.py`

One parametrized test function `test_reopen_matrix(case)` with 5 cases matching the decisions section above. Each case sets up the AgentPrompt rows (target + 1 downstream), invokes `reopen_prompt`, and asserts:
- HTTP status (via a local TestClient OR by asserting the `StateError.error_code` directly).
- Row states post-call.
- Future state if applicable.

Case 1 — `(pending, answered)` → expect `error_code == "prompt_already_pending"`.
Case 2 — `(answered, pending) with consumed_at=NULL` → expect 204, target flipped to pending, downstream marked `stale`.
Case 3 — `(answered, answered) with consumed_at=NULL` → expect 204, target flipped to pending, downstream marked `stale`.
Case 4 — `(answered, answered) with consumed_at=NOT NULL` → expect `error_code == "answer_consumed"`.
Case 5 — `(stale, answered)` → expect `error_code == "prompt_already_pending"` (stale can't reopen either). Document decision: staler-than-stale is not reopenable.

**Verification:**
```bash
cd web/backend && uv run pytest tests/agents/test_prompt_reopen_matrix.py -x -v
```

### Task 6 — Router TestClient tests

**File:** `test_prompts_router.py`

Follow the pattern of `test_agents_router.py:44-58`. For each of the three new endpoints:

- `POST /runs/{id}/answer`:
  - 204 on happy path.
  - 400 with `error_code=missing_prompt_id` when `prompt_id` is absent.
  - 404 with `error_code=prompt_not_found` for unknown prompt_id.
  - 409 with `error_code=prompt_stale` when prompt not pending.

- `GET /runs/{id}/pending-prompt`:
  - 200 with `PendingPromptResponse` body when pending exists.
  - 204 when no pending prompt.
  - Unknown run_id: manager returns None → 204 (not 404; decided here so the frontend doesn't need to distinguish the two).

- `POST /runs/{id}/prompts/{prompt_id}/reopen`:
  - 204 on happy path.
  - 400 when target already pending.
  - 404 when target prompt_id unknown.
  - 409 when target answer is consumed.

Use the `_reset_sse_starlette_event` autouse fixture pattern if any of these tests spin up an SSE stream.

**Verification:**
```bash
cd web/backend && uv run pytest tests/agents/test_prompts_router.py -x
```

### Task 7 — End-to-end integration test

**File:** `test_prompt_roundtrip_integration.py`

Build a fake SDK client (pattern at `test_session.py:~100`) that:
1. On `query(prompt)`, yields a single `AssistantMessage` with a `ToolUseBlock` whose `name == "mcp__rapid__webui_ask_user"` and `input == {"question":"hi","options":null,"allow_free_text":true}`.
2. Runs the real `AgentSession` against the fake client.
3. In a second asyncio task, poll `GET /pending-prompt` until a prompt appears, then `POST /answer`.
4. Assert the fake client receives a `tool_result` payload with text == "yes" (the answer submitted).
5. Assert the `AgentPrompt` row ends in `status=answered`, `consumed_at IS NOT NULL`.

Mark `@pytest.mark.slow` if wall time exceeds 2s.

**Verification:**
```bash
cd web/backend && uv run pytest tests/agents/test_prompt_roundtrip_integration.py -x
```

### Task 8 — CLI-parity lint (Node)

**File:** `tests/cli-parity-lint.test.cjs`

Use Node's built-in `node:test` runner (the existing CJS tests at repo root use plain `assert` — check one to confirm the runner convention; use the same).

For each of the 9 patched skill files (whitelist inlined in the test), load the file contents and:
1. Find every `AskUserQuestion` token.
2. For each occurrence, walk up at most 30 lines to find the preceding `else` keyword.
3. Walk up further to find `if [ "${RAPID_RUN_MODE}" = "sdk" ]` (or `"$RAPID_RUN_MODE" = "sdk"`).
4. Walk down at most 20 lines from the AskUserQuestion to find the closing `fi`.
5. Assert that the block contains a `mcp__rapid__webui_ask_user` or `mcp__rapid__ask_free_text` token above the `else` within the same `if/fi` block.

Assert the total AUQ count per file matches the expected counts from Wave 3 (13/38/25/3/3/19/4/5/8).

Assert no AUQ tokens appear in any OTHER file under `skills/` (the blacklist). If `audit-version` etc. have AUQ references that are NOT part of the patch scope, allow them — but log their counts to catch accidental-patch drift.

**Verification:**
```bash
node --test tests/cli-parity-lint.test.cjs
```

## Success Criteria

- `cd web/backend && uv run pytest tests/agents -x` passes with the new tests included.
- `node --test tests/cli-parity-lint.test.cjs` passes.
- All 5 cases of the reopen matrix are covered.
- The existing Wave 1 foundation tests still pass (no regressions introduced by production code changes — verified by running the whole `tests/agents/` directory).

## Out of Scope (do NOT touch in this wave)

- Production code in `web/backend/app/` (Wave 1).
- Production code in `web/frontend/src/` (Wave 2).
- Skill files (Wave 3).
- A real `claude -p /rapid:execute-set` smoke — lint-only is sufficient per research finding 7.
- Frontend component/hook tests (deferred per research finding 6).

## Dependencies Between Waves

Wave 4 tests **production code created in Waves 1 and 3.** If you execute Waves 2/3/4 in parallel, Wave 4 MUST merge AFTER Wave 1 at minimum. Recommended merge order: Wave 1 → (Waves 2, 3, 4 in any order; file ownership is exclusive).
