# Wave 1 — Backend Foundation (SDK tools, DB, router)

## Objective

Land the complete backend half of the ask-user bridge: new `AgentPrompt` SQLModel + Alembic migration, `webui_ask_user` / `ask_free_text` SDK MCP tools wired into `AgentSession.__aenter__`, `can_use_tool` interception for built-in `AskUserQuestion` (>4 split), manager facade methods for resolving/reopening prompts, and three router endpoints (`POST /answer`, `GET /pending-prompt`, `POST /prompts/{id}/reopen`). By the end of this wave the backend can round-trip a structured question from an SDK-mode agent through SSE to a caller and back.

## Committed Decisions (carried forward from research)

- **Splice design (a)**: AskUserQuestion interception lives inside `can_use_tool_hook`. When the tool is called, the hook synthesizes N `ask_user` prompts (splitting on 4-question chunks), awaits each, and returns `PermissionResultDeny(behavior="deny", message="<interpolated answers as JSON>", interrupt=False)` which is how `can_use_tool` returns the answer payload to the agent. This gives true CLI-parity — skills do NOT need to change for AUQ calls that fit in 4 questions.
- **`consumed_at` column is part of the initial schema** — not deferred. Required for the reopen consume-race edge case.
- **Extend `AskUserEvent` additively** with `prompt_id: str` at `schemas/sse_events.py`. `extra="allow"` on `_BaseEvent` means this is not a breaking change for older clients.
- **`kind` enum is just `'ask_user'`** — `permission_req` / `approve_tool` are out of scope (see DEFERRED.md). We do NOT model those kinds in `agent_prompts`.
- **Thread run_id via factory closure.** Do NOT rely on `run_id_var` ContextVar across SDK callback boundaries — bind run_id when building the tool list in `session.__aenter__`.

## Files Owned by this Wave (exclusive)

Create:
- `web/backend/app/models/agent_prompt.py`
- `web/backend/alembic/versions/0005_agent_prompts.py`
- `web/backend/app/agents/tools/__init__.py`
- `web/backend/app/agents/tools/ask_user.py`

Edit:
- `web/backend/app/database.py` — register `AgentPrompt` import alongside `AgentRun`/`AgentEvent`.
- `web/backend/app/schemas/sse_events.py` — add `prompt_id: str` to `AskUserEvent`.
- `web/backend/app/schemas/agents.py` — extend `AnswerRequest` with `prompt_id: str | None = None`; add `PendingPromptResponse`.
- `web/backend/app/agents/permission_hooks.py` — extend `can_use_tool_hook` with AskUserQuestion interception branch.
- `web/backend/app/agents/session.py` — register MCP tools in `__aenter__`; wrap the prompt-await with `_enter_waiting`/`_leave_waiting`; persist `consumed_at` when answer is consumed.
- `web/backend/app/agents/session_manager.py` — add `resolve_prompt`, `reopen_prompt`, `get_pending_prompt` facade methods; initialize `_prompt_futures: dict[str, asyncio.Future]`.
- `web/backend/app/routers/agents.py` — replace 501 stub for `/answer`; add `/pending-prompt` GET; add `/prompts/{prompt_id}/reopen` POST.
- `web/backend/app/services/agent_service.py` — thin wrappers `resolve_prompt`, `get_pending_prompt`, `reopen_prompt` delegating to the manager.

## Tasks

### Task 1 — `AgentPrompt` model

**File:** `web/backend/app/models/agent_prompt.py` (new)

Define a SQLModel table mirroring the `AgentRun` / `AgentEvent` style:

Columns:
- `id: str` primary key (UUIDv4 string; minted by `webui_ask_user`, NOT by SQLAlchemy default — the tool has to know the id before insert so it can emit the SSE event)
- `run_id: UUID` FK to `agentrun.id`, indexed
- `kind: str` — only `'ask_user'` right now (constrained via Literal in Pydantic schemas; column is plain `str`)
- `payload: str` — JSON string of `{question, options, allow_free_text, n_of_m}` at minimum
- `status: str` default `'pending'` — one of `pending|answered|stale`
- `answer: str | None` default None
- `created_at: datetime` default `_utcnow` (local helper, same pattern as `agent_run.py` lines 12-15)
- `answered_at: datetime | None` default None
- `consumed_at: datetime | None` default None  — set by the tool body when `future.result()` returns, BEFORE the result is handed to the SDK client
- `batch_id: str | None` default None — groups prompts produced from a single AUQ call that split >4 questions (so reopen can invalidate siblings)
- `batch_position: int | None` default None — 0-indexed position within the batch

Indexes:
- Partial unique on `(run_id)` where `status = 'pending'` — mirrors `uq_agent_run_active_set` pattern at `agent_run.py:37-44`; enforces "at most one pending prompt per run".
- Composite index on `(run_id, created_at)` — used by reopen to find downstream prompts by "created after target".

Register the import at `web/backend/app/database.py:99-100` next to the existing `AgentRun`/`AgentEvent` imports.

**Verification:**
```bash
cd web/backend && uv run pytest tests/agents/test_models_schema.py -x
cd web/backend && uv run python -c "from app.models.agent_prompt import AgentPrompt; print(AgentPrompt.__table__.indexes)"
```
The partial unique index should appear with the `WHERE status = 'pending'` predicate.

### Task 2 — Alembic migration 0005

**File:** `web/backend/alembic/versions/0005_agent_prompts.py` (new)

Copy the shape of `0004_agent_runtime.py`. `revision = "0005"`, `down_revision = "0004"`.

- `op.create_table("agentprompt", ...)` matching the model columns.
- `op.create_index(...)` for the `(run_id, created_at)` composite.
- `op.create_index(..., unique=True, sqlite_where=sa.text("status = 'pending'"))` for the partial unique.
- FK on `run_id` → `agentrun.id` with name `fk_agentprompt_run_id_agentrun`; do NOT add `ondelete=CASCADE` (matches existing `agentevent` convention per research).
- `downgrade()` drops indexes then the table.

**Verification:**
```bash
cd web/backend && uv run alembic upgrade head
cd web/backend && uv run alembic downgrade -1
cd web/backend && uv run alembic upgrade head
cd web/backend && uv run pytest tests/agents/test_migration_0004.py -x
```
(Also add a `test_migration_0005.py` in the test wave; this wave just needs migration to round-trip cleanly.)

### Task 3 — Extend SSE and request/response schemas

**Files:**
- `web/backend/app/schemas/sse_events.py` — add `prompt_id: str` field to `AskUserEvent` (keep it required so type-checking flags missing fields; `extra="allow"` on the base still protects cross-version clients).
- `web/backend/app/schemas/agents.py`:
  - Extend `AnswerRequest`: add `prompt_id: str | None = None`. Keep `tool_use_id: str` (backwards compat; frontend sends both).
  - Add new `PendingPromptResponse(BaseModel)` with fields: `prompt_id: str`, `run_id: UUID`, `kind: Literal["ask_user"]`, `question: str`, `options: list[str] | None`, `allow_free_text: bool`, `created_at: datetime`, `batch_id: str | None`, `batch_position: int | None`, `batch_total: int | None`.

**Do NOT:** add new SSE event kinds; extend `EVENT_KINDS`; remove `permission_req` from the union (out of scope — other slices still reference it).

**Verification:**
```bash
cd web/backend && uv run pytest tests/agents/test_sse_schemas.py -x
```

### Task 4 — `webui_ask_user` / `ask_free_text` tool module

**Files:**
- `web/backend/app/agents/tools/__init__.py` (new; exports `build_tools(run_id, manager)`)
- `web/backend/app/agents/tools/ask_user.py` (new)

`build_tools(run_id: UUID, manager: AgentSessionManager) -> list[SdkMcpTool]` returns the two `@tool`-decorated coroutines with `run_id` and `manager` captured in closure.

Inside each tool coroutine:
1. Generate `prompt_id = str(uuid4())`.
2. Acquire per-run prompts lock (new `asyncio.Lock` per run, owned by manager — reuse or add `_prompt_locks[run_id]`). This prevents two concurrent tool calls from racing the partial unique index.
3. Persist `AgentPrompt` row with `status='pending'`, payload JSON including question/options/allow_free_text (ask_free_text forces `options=None`, `allow_free_text=True`).
4. Emit `AskUserEvent` through `manager.event_bus` (obtain seq via `ch = await manager.event_bus.get_or_create_channel(run_id); seq = ch.next_seq()` — same as session.py:351-353).
5. Create `asyncio.Future` and register in `manager._prompt_futures[prompt_id]`.
6. `await` the future (optionally wrap with `manager._sessions[run_id]._enter_waiting()` / `_leave_waiting()` if we can reach into the session — acceptable private access since this is same package).
7. On resolve, write `answered_at` + `answer` + set `status='answered'` (if not already by resolve_prompt path) and set `consumed_at = _utcnow()` — this is the "agent has consumed" marker.
8. Return the plain dict MCP result: `{"content": [{"type":"text","text": <answer>}], "is_error": False}`.
9. On `asyncio.CancelledError` (run interrupted): mark prompt `stale`, re-raise.

**Input schemas** use the `@tool(name, description, input_schema)` shape from `claude_agent_sdk`. Schemas:
- `webui_ask_user`: `{question: str, options: list[str] | None, allow_free_text: bool, n_of_m: tuple[int,int] | None}` — all fields validated as JSON schema dict.
- `ask_free_text`: `{question: str}` — thin specialization.

**Verification:**
```bash
cd web/backend && uv run python -c "from app.agents.tools.ask_user import build_tools; print([t.name for t in build_tools.__code__.co_consts if hasattr(t, 'name')])"
cd web/backend && uv run pytest tests/agents/test_mcp_registration.py -x
```
(A dedicated `test_ask_user_tool.py` will land in the test wave.)

### Task 5 — `can_use_tool_hook` AskUserQuestion interception

**File:** `web/backend/app/agents/permission_hooks.py`

Extend `can_use_tool_hook`. After the existing `Bash` branch, BEFORE the `return PermissionResultAllow(...)`:

```
elif tool_name == "AskUserQuestion":
    # Splice design (a): route every AUQ through the web bridge when RAPID_RUN_MODE=sdk.
    # This gives CLI-parity — skills needn't change for AUQ calls that fit in 4 questions.
    questions = input_data.get("questions", []) or []
    if not questions:
        return PermissionResultAllow(behavior="allow", updated_input=input_data)
    # Obtain run_id + manager via factory closure — bound when the hook is registered.
    run_id, manager = _resolve_run_context(context)
    answers = await _route_auq_through_bridge(run_id, manager, questions)
    # Return PermissionResultDeny carrying the synthesized answers. The SDK treats
    # a Deny message as the tool_result payload delivered to the agent.
    return PermissionResultDeny(
        behavior="deny",
        message=json.dumps({"answers": answers}),
        interrupt=False,
    )
```

Add module-level `_resolve_run_context(context)` that reads `context.tool_use_id` and whatever the session attached (a `context.metadata` dict or module-level `_run_context_registry: dict[str, tuple[UUID, AgentSessionManager]]`). Easiest: when `AgentSession.__aenter__` registers its tools, it also installs a `can_use_tool` wrapper via `functools.partial` that pre-binds `run_id` + `manager_ref`. See Task 6.

Add `_route_auq_through_bridge(run_id, manager, questions)` that:
1. Chunks `questions` into groups of up to 4.
2. For each chunk: mints prompt_id, persists `AgentPrompt` with `batch_id=<shared>`, `batch_position=i`, `payload={question, options, allow_free_text, n_of_m:(i+1, len(chunks))}`, emits `AskUserEvent`, awaits future.
3. Concatenates answers in original question order, returns `list[str]`.

**Verification:**
```bash
cd web/backend && uv run pytest tests/agents/test_permission_hooks.py -x
```

### Task 6 — Wire tools into `AgentSession.__aenter__`

**File:** `web/backend/app/agents/session.py`

After line 115 (where `self._options = build_sdk_options(...)` is assigned) and BEFORE line 118 (`ClaudeSDKClient(options=self._options)`):

```
from app.agents.mcp_registration import register_mcp_tools
from app.agents.tools import build_tools
tools = build_tools(run_id=self.run_id, manager=self.manager)
register_mcp_tools(self._options, tools)
# Re-bind can_use_tool with run_id + manager captured:
self._options.can_use_tool = functools.partial(
    can_use_tool_hook_bound, run_id=self.run_id, manager=self.manager
)
```

This requires `AgentSession` to hold a reference to `manager` — add `manager: AgentSessionManager` to `__init__` and thread it through `AgentSessionManager._run_session` (which constructs the session at `session_manager.py:~240`).

Also: at `_handle_message`, where we already emit the `ToolResultEvent` (lines 245-254), when the tool name resolves to `mcp__rapid__webui_ask_user`, persist `consumed_at` on the prompt row.

**Do NOT:** change `event_bus` wiring; change `run()` pump logic; touch the budget tracking.

**Verification:**
```bash
cd web/backend && uv run pytest tests/agents/test_session.py tests/agents/test_session_manager.py -x
```

### Task 7 — Manager facade methods

**File:** `web/backend/app/agents/session_manager.py`

Add to `AgentSessionManager`:

```
self._prompt_futures: dict[str, asyncio.Future] = {}
self._prompt_locks: dict[UUID, asyncio.Lock] = {}
```

New methods (all async):

- `resolve_prompt(run_id: UUID, prompt_id: str, answer: str) -> None`:
  1. Under per-run prompts lock, read the prompt row.
  2. If not found → raise `StateError("Prompt not found", error_code="prompt_not_found")` (router maps to 404).
  3. If `status != "pending"` → raise `StateError("Prompt not pending", error_code="prompt_stale")` (router maps to 409).
  4. Update row: `status="answered"`, `answer=answer`, `answered_at=_utcnow()`.
  5. Resolve `self._prompt_futures[prompt_id].set_result(answer)`; pop.

- `get_pending_prompt(run_id: UUID) -> AgentPrompt | None`: SELECT by `run_id` + `status='pending'` ORDER BY created_at DESC LIMIT 1. (Partial unique means there's at most one; ORDER BY is defense-in-depth.)

- `reopen_prompt(run_id: UUID, prompt_id: str) -> None`:
  1. Under per-run prompts lock:
  2. Load target prompt. If not found → 404. If `status == "pending"` → raise `StateError("Nothing to reopen", error_code="prompt_already_pending")` with HTTP 400 mapping (add to `error_mapping.py` if needed).
  3. If `status == "answered"` AND `consumed_at IS NOT NULL` → raise `StateError("Answer already consumed; interrupt the run to revise", error_code="answer_consumed")` → 409.
  4. Otherwise: update downstream prompts (`run_id=target.run_id AND created_at > target.created_at AND status IN ('pending','answered')`) to `status='stale'`. Update target to `status='pending'`, clear `answer`, `answered_at`, `consumed_at`. Cancel and replace any in-flight future (new `asyncio.Future` inserted at `_prompt_futures[prompt_id]`).
  5. Re-emit the `AskUserEvent` so reconnected clients see the pending prompt in the event stream.

Add entries to `app/agents/error_mapping.py` for `prompt_not_found` → 404, `prompt_stale` → 409, `prompt_already_pending` → 400, `answer_consumed` → 409.

**Verification:**
```bash
cd web/backend && uv run pytest tests/agents/test_session_manager.py -x
```

### Task 8 — Router endpoints

**File:** `web/backend/app/routers/agents.py`

Replace the 501 stub at lines 148-164 with a real implementation:

```
@router.post("/runs/{run_id}/answer", status_code=204)
async def answer_endpoint(run_id: UUID, body: AnswerRequest, request: Request):
    mgr = agent_service.get_manager(request)
    # prompt_id is the real handle; tool_use_id kept for backwards compat only.
    if not body.prompt_id:
        raise HTTPException(400, detail={"error_code":"missing_prompt_id", "message":"prompt_id is required"})
    try:
        await agent_service.resolve_prompt(mgr, run_id, body.prompt_id, body.answer)
    except StateError as exc:
        raise to_http_exception(exc)
    return Response(status_code=204)
```

Add:

```
@router.get("/runs/{run_id}/pending-prompt")
async def get_pending_prompt_endpoint(run_id: UUID, request: Request):
    mgr = agent_service.get_manager(request)
    try:
        row = await agent_service.get_pending_prompt(mgr, run_id)
    except StateError as exc:
        raise to_http_exception(exc)
    if row is None:
        return Response(status_code=204)
    return PendingPromptResponse(...from row...)

@router.post("/runs/{run_id}/prompts/{prompt_id}/reopen", status_code=204)
async def reopen_prompt_endpoint(run_id: UUID, prompt_id: str, request: Request):
    mgr = agent_service.get_manager(request)
    try:
        await agent_service.reopen_prompt(mgr, run_id, prompt_id)
    except StateError as exc:
        raise to_http_exception(exc)
    return Response(status_code=204)
```

Add the three thin service wrappers in `app/services/agent_service.py` (mirror `send_input` / `interrupt`).

**Verification:**
```bash
cd web/backend && uv run pytest tests/agents/test_agents_router.py -x
```

## Success Criteria

- `uv run alembic upgrade head` creates `agentprompt` table with partial unique index; `uv run alembic downgrade -1` is clean.
- `uv run pytest web/backend/tests/agents -x` (existing suite) still passes — no regressions to foundation tests.
- New `AgentPrompt` import is registered in `database.py` and appears in `SQLModel.metadata.tables`.
- `AskUserEvent` serializes with a `prompt_id` field; `test_sse_schemas.py` asserts it.
- `can_use_tool_hook` produces an `ask_user` event on SSE when invoked with `tool_name="AskUserQuestion"` (unit-test via TestClient — landed in test wave).
- `POST /api/agents/runs/{id}/answer` with a valid `{prompt_id, answer}` returns 204 and resolves the in-memory future; 409 on stale prompt_id; 404 on unknown prompt.
- `GET /api/agents/runs/{id}/pending-prompt` returns 200 when pending exists, 204 when none.
- `POST /api/agents/runs/{id}/prompts/{id}/reopen` returns 409 when `consumed_at IS NOT NULL`, 204 otherwise (and marks downstream stale).

## Out of Scope (do NOT touch in this wave)

- Frontend anything (Wave 2).
- Skill SKILL.md files (Wave 3).
- New test files (Wave 4).
- `permission_req` / `approve_tool` kinds (deferred; see DEFERRED.md).
- Pending-prompt timeouts (deferred).
