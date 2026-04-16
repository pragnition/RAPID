# Wave 1 Plan — Backend Foundation

**Set:** agents-chats-tabs
**Wave:** 1 of 3
**Focus:** Chat persistence schema + `/api/chats` endpoints + consolidated `/api/dashboard`

---

## Objective

Ship the backend foundation that Wave 2 and Wave 3 frontend code consumes:

1. **Chat persistence** — SQLModel classes (`Chat`, `ChatMessage`, `ChatAttachment`) + Alembic migration `0007_chat_persistence.py`.
2. **Chat service layer** — `chat_service.py` mediating chat UI ↔ agent runtime (create_thread, send_message, stream_response).
3. **Chat REST + SSE endpoints** — `/api/chats` router (list / create / get / post-message / SSE).
4. **Consolidated dashboard endpoint** — `GET /api/dashboard?project_id=X` (counts + 5 most recent items per section) to replace 4-5 independent polls with a single query.
5. **Router registration** in `app/main.py` and model-metadata registration in `app/database.py`.
6. **Backend tests** covering schema, migration, service, endpoints, and dashboard aggregations.

**Why this wave exists:** Frontend hooks (Wave 2) call `/api/chats` and `/api/dashboard` for runtime correctness. Shipping backend first makes the frontend work pure and letter-exact against real endpoints. Types can be stubbed in Wave 2, but end-to-end verification (migration applied, aggregate counts correct, SSE flushes chat events) requires the real service.

File ownership is **backend-only** — Wave 1 touches `web/backend/**`; it does NOT modify `web/frontend/**`.

---

## Tasks

### T1. Add Chat models — `web/backend/app/models/chat.py` (new)

**Files modified:**
- `web/backend/app/models/chat.py` (new)

**Implementation:**

Follow the exact pattern from `web/backend/app/models/agent_run.py` and `agent_event.py`:

- Module-local `_utcnow()` returning `datetime.now(timezone.utc)` (avoids `app.models ↔ app.database` circular import; mirrors `agent_run.py:12-15`).
- Three SQLModel tables (`table=True`), each with:
  - `id: UUID = Field(default_factory=uuid4, primary_key=True)` (except `ChatMessage.id` and `ChatAttachment.id` — see below)
  - Foreign keys using lowercase class-name table form (`foreign_key="chat.id"`, `foreign_key="agentrun.id"`).
  - Timestamps as `datetime = Field(default_factory=_utcnow)`.

**Classes:**

```python
class Chat(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="project.id", index=True)
    skill_name: str
    title: str = Field(default="")  # auto-filled from first user message if empty
    session_status: str = Field(default="active", index=True)  # active | idle | archived
    created_at: datetime = Field(default_factory=_utcnow, index=True)
    last_message_at: datetime = Field(default_factory=_utcnow, index=True)
    archived_at: datetime | None = Field(default=None)


class ChatMessage(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    chat_id: UUID = Field(foreign_key="chat.id", index=True)
    seq: int = Field(index=True)  # monotonic within chat_id
    role: str = Field(index=True)  # user | assistant | tool
    content: str = Field(default="")  # rendered markdown text
    tool_calls: str = Field(default="[]")  # JSON array of {tool_use_id, tool_name, input, ...}
    tool_use_id: str | None = Field(default=None)  # set for role='tool' messages
    agent_run_id: UUID | None = Field(default=None, foreign_key="agentrun.id", index=True)
    temp_id: str | None = Field(default=None, index=True)  # client-gen UUID for optimistic reconciliation
    created_at: datetime = Field(default_factory=_utcnow, index=True)

    __table_args__ = (
        Index("uq_chat_message_chat_seq", "chat_id", "seq", unique=True),
    )


class AttachmentKind(str, Enum):
    FILE = "file"
    IMAGE = "image"
    CODE = "code"


class ChatAttachment(SQLModel, table=True):
    """Stub table for v7.1 — all non-PK fields nullable so v7.1 can tighten constraints."""
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    chat_id: UUID | None = Field(default=None, foreign_key="chat.id", index=True)
    message_id: UUID | None = Field(default=None, foreign_key="chatmessage.id", index=True)
    kind: str | None = Field(default=None)  # AttachmentKind value
    payload: str | None = Field(default=None)  # JSON
```

**What NOT to do:**
- Do NOT add `size_bytes`, `content_type`, `storage_url` to `ChatAttachment` — those are deferred to v7.1 per CONTEXT line 99-101.
- Do NOT omit the unique index on `(chat_id, seq)` — it's required by the monotonic-sequence invariant.
- Do NOT hard-code `uuid4()` in the default — use `default_factory=uuid4` (calls once per row, not once per import).
- Do NOT use `datetime.utcnow()` — use the module-local `_utcnow()` timezone-aware helper.

**Verification:**
```bash
cd ~/Projects/RAPID/web/backend
uv run python -c "from app.models.chat import Chat, ChatMessage, ChatAttachment, AttachmentKind; print('ok')"
uv run ruff check app/models/chat.py
```

---

### T2. Register chat models in `app/database.py`

**Files modified:**
- `web/backend/app/database.py` (lines 105-110 area)

**Implementation:**

After the existing agent-runtime imports at the bottom of `database.py` (lines 108-110), append a chat-models import block mirroring the same pattern:

```python
from app.models.chat import Chat, ChatMessage, ChatAttachment  # noqa: E402, F401
```

This populates `SQLModel.metadata` with the three new tables so Alembic autogenerate (and the `create_all` fallback) sees them.

**What NOT to do:**
- Do NOT add the import at the top of `database.py` — the comment at line 106-107 explicitly warns about a circular import with `app.agents.correlation → app.config → app.database`. Keep it at the bottom.

**Verification:**
```bash
cd ~/Projects/RAPID/web/backend
uv run python -c "from app.database import SQLModel; assert 'chat' in SQLModel.metadata.tables; assert 'chatmessage' in SQLModel.metadata.tables; assert 'chatattachment' in SQLModel.metadata.tables; print('ok')"
```

---

### T3. Alembic migration — `alembic/versions/0007_chat_persistence.py` (new)

**Files modified:**
- `web/backend/alembic/versions/0007_chat_persistence.py` (new)

**Implementation:**

Use `revision = "0007"`, `down_revision = "0006"`. Follow the exact pattern from `0005_agent_prompts.py` (known-good for table + index creation) and `0006_kanban_v2_autopilot.py` (known-good for server_default usage).

Tables to create (in this order, so FKs resolve):

1. `chat` — columns matching `Chat` class; FK `project_id` → `project.id`; indexes on `project_id`, `session_status`, `created_at`, `last_message_at`.
2. `chatmessage` — columns matching `ChatMessage`; FKs `chat_id` → `chat.id` and `agent_run_id` → `agentrun.id`; indexes on `chat_id`, `seq`, `role`, `agent_run_id`, `temp_id`, `created_at`. Add unique composite index `uq_chat_message_chat_seq` on `(chat_id, seq)` via `op.create_index(..., unique=True)`.
3. `chatattachment` — columns matching `ChatAttachment`; FKs on `chat_id` and `message_id`, BOTH `nullable=True`.

Use `sa.Uuid()` for UUID columns (matches `0005` and `0006`). Use `sa.DateTime()` for timestamps. `server_default` strings: `session_status` → `"active"`, `seq` → (omit — always explicit from service), `content` → `""`, `tool_calls` → `"[]"`, `role` → (no default — always explicit).

`downgrade()` drops indexes first, then tables in reverse order (`chatattachment`, `chatmessage`, `chat`).

**What NOT to do:**
- Do NOT use revision `"0006"` — `0006_kanban_v2_autopilot.py` already occupies that slot (verified at `.../versions/0006_kanban_v2_autopilot.py:15`).
- Do NOT skip the `downgrade()` — migration tests may exercise round-trip.
- Do NOT use `batch_alter_table` for CREATE TABLE — it's for altering, not creating (compare 0005 `op.create_table()` vs 0006 `batch_alter_table()`).
- Do NOT add columns for deferred ChatAttachment fields (`size_bytes`, `content_type`, `storage_url`).

**Verification:**
```bash
cd ~/Projects/RAPID/web/backend
uv run alembic -c alembic.ini upgrade head  # on a fresh tmp DB
uv run alembic -c alembic.ini downgrade -1  # round-trip check
uv run alembic -c alembic.ini upgrade head
uv run ruff check alembic/versions/0007_chat_persistence.py
```

---

### T4. Chat request/response schemas — `app/schemas/chats.py` (new)

**Files modified:**
- `web/backend/app/schemas/chats.py` (new)

**Implementation:**

Follow the pattern from `app/schemas/agents.py`: Pydantic v2 `BaseModel`, `ConfigDict(from_attributes=True)` on response models, explicit field types.

```python
from __future__ import annotations
from datetime import datetime
from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ChatCreateRequest(BaseModel):
    project_id: UUID
    skill_name: str = Field(min_length=1, max_length=128)
    title: str | None = Field(default=None, max_length=255)


class ChatMessageCreateRequest(BaseModel):
    content: str = Field(min_length=1)
    temp_id: str | None = Field(default=None)


class ChatResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    skill_name: str
    title: str
    session_status: Literal["active", "idle", "archived"]
    created_at: datetime
    last_message_at: datetime
    archived_at: datetime | None


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    chat_id: UUID
    seq: int
    role: Literal["user", "assistant", "tool"]
    content: str
    tool_calls: list[dict[str, Any]]  # JSON-decoded
    tool_use_id: str | None
    agent_run_id: UUID | None
    temp_id: str | None
    created_at: datetime


class ChatListResponse(BaseModel):
    items: list[ChatResponse]
    total: int
```

For `tool_calls`, write a small adapter fn in the router (`_message_to_response`) that json-loads `ChatMessage.tool_calls` before returning. Do NOT try to do it in the Pydantic field itself (Pydantic can't decode JSON-stored-as-string automatically with `from_attributes=True`).

**Verification:**
```bash
cd ~/Projects/RAPID/web/backend
uv run python -c "from app.schemas.chats import ChatResponse, ChatMessageResponse, ChatCreateRequest; print('ok')"
uv run ruff check app/schemas/chats.py
```

---

### T5. Dashboard response schemas — `app/schemas/dashboard.py` (new)

**Files modified:**
- `web/backend/app/schemas/dashboard.py` (new)

**Implementation:**

```python
from __future__ import annotations
from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class _RecentRun(BaseModel):
    id: UUID
    skill_name: str
    status: str
    started_at: datetime


class RunsSummary(BaseModel):
    running: int
    waiting: int
    failed: int
    completed: int
    recent: list[_RecentRun]  # top 5


class _RecentThread(BaseModel):
    id: UUID
    title: str
    skill_name: str
    last_message_at: datetime
    session_status: str


class ChatsSummary(BaseModel):
    active: int
    idle: int
    archived: int
    recent: list[_RecentThread]  # top 5


class KanbanSummary(BaseModel):
    total: int
    in_progress: int
    blocked: int


class BudgetRemaining(BaseModel):
    daily_cap: float
    spent_today: float
    remaining: float


class _ActivityItem(BaseModel):
    kind: Literal["run", "chat"]
    id: UUID
    title: str  # skill_name for runs, title for chats
    status: str
    ts: datetime


class DashboardResponse(BaseModel):
    runs_summary: RunsSummary
    chats_summary: ChatsSummary
    kanban_summary: KanbanSummary
    budget_remaining: BudgetRemaining
    recent_activity: list[_ActivityItem]  # top 10 across runs + chats
```

**Verification:**
```bash
uv run python -c "from app.schemas.dashboard import DashboardResponse; print('ok')"
uv run ruff check app/schemas/dashboard.py
```

---

### T6. Chat service — `app/services/chat_service.py` (new)

**Files modified:**
- `web/backend/app/services/chat_service.py` (new)

**Implementation:**

Thin facade pattern matching `app/services/agent_service.py:1-98`. Uses lifespan-owned `AgentSessionManager` via `request.app.state.agent_manager`. Raises `app.agents.StateError` for semantic errors (app-level 409 handler converts to HTTP).

**Functions to export** (match CONTRACT.json signatures):

```python
def get_manager(request: Request) -> AgentSessionManager: ...  # copied from agent_service.py:25-29

async def create_thread(
    session: Session,
    project_id: UUID,
    skill_name: str,
    title: str | None = None,
) -> Chat:
    """Create a new chat thread. Returns the row. Does NOT start a session yet —
    session is lazily created on first send_message call."""

async def list_threads(
    session: Session,
    project_id: UUID,
    include_archived: bool = False,
) -> tuple[list[Chat], int]:
    """List threads for a project, newest last_message_at first. Filters out
    archived_at IS NOT NULL unless include_archived=True."""

async def get_thread(session: Session, chat_id: UUID) -> Chat | None: ...

async def send_message(
    session: Session,
    mgr: AgentSessionManager,
    chat_id: UUID,
    content: str,
    temp_id: str | None = None,
) -> ChatMessage:
    """Persist a user message (role='user'), ensure/create the bound AgentSession,
    and kick off the agent response. Returns the persisted user ChatMessage
    immediately (the assistant response arrives later via stream_response / SSE)."""

async def archive_thread(session: Session, chat_id: UUID) -> Chat: ...

async def list_messages(
    session: Session, chat_id: UUID, since_seq: int = 0
) -> list[ChatMessage]:
    """Load messages for replay (historical). Used by GET /api/chats/{id} and
    by SSE reconnect before joining the live stream."""
```

**Session-binding implementation note (internal detail, not exported):**

- Maintain an in-memory `dict[UUID, UUID]` mapping `chat_id → active_run_id` on the `AgentSessionManager` (or a sibling `ChatSessionRegistry` instance, whichever lands cleaner). On `send_message`, check the map: if present AND `mgr.get_run(run_id).status in ('running', 'waiting')` AND last activity within 1 hour, reuse it (send input via `mgr.send_input`). Otherwise, call `mgr.start_run(...)` with the chat's full ChatMessage history injected into `prompt`, and update the map.
- "Last activity" = max of user message `created_at` and latest `ChatMessage.created_at` for any role — compute on session reuse check.
- For now, 1-hour timeout is enforced at `send_message` time (i.e., on the next user message). No background timer.

**Message persistence details:**
- Compute next `seq` via `SELECT COALESCE(MAX(seq), 0) + 1 FROM chatmessage WHERE chat_id = ?` inside the same transaction.
- Set `temp_id` from the request so the frontend can reconcile optimistic renders.
- For assistant turn materialization (called from event-stream consumer, NOT from `send_message`): accumulate `assistant_text` deltas + `tool_use` blocks from the `agent_event` stream, write a single `ChatMessage(role='assistant', content=<accumulated text>, tool_calls=<json>, agent_run_id=<run.id>)` at `run_complete` time. This can live in a helper `_materialize_assistant_turn(session, chat_id, run_id)` — add a unit test for it; wiring into the actual event consumer can land in this wave (preferred) or be marked TODO and handled with a thin polling job (acceptable).

**Error semantics:**
- `create_thread` with unknown `project_id` → `StateError(error_code="project_not_found", ...)`.
- `send_message` on archived thread → `StateError(error_code="thread_archived", ...)`.
- `get_thread` returns `None` on miss (router converts to 404), matching `note_service` pattern.

**What NOT to do:**
- Do NOT store streaming delta events as ChatMessage rows — keep them in `agent_event` (already exists from agent-runtime-foundation). Only materialize the ChatMessage at turn completion.
- Do NOT create a new error hierarchy — re-raise `StateError` from `app.agents`. Error mapping to HTTP lives in `install_agent_error_handlers` already installed in `main.py:190`.
- Do NOT make `create_thread` async if it has no awaits — use `def` for sync functions (match `note_service.py`). The CONTRACT signature says `async def` but all three service functions in CONTRACT.json are `async`; keep them async for consistency even if the body has no awaits (they may gain awaits when session-binding lands).

**Verification:**
```bash
cd ~/Projects/RAPID/web/backend
uv run python -c "from app.services import chat_service; assert hasattr(chat_service, 'create_thread'); assert hasattr(chat_service, 'send_message'); print('ok')"
uv run ruff check app/services/chat_service.py
```

---

### T7. Chats router — `app/routers/chats.py` (new)

**Files modified:**
- `web/backend/app/routers/chats.py` (new)

**Implementation:**

Sibling to `app/routers/agents.py`. Prefix `/api/chats`. Use `app.agents.to_http_exception` for `StateError` conversion. Use `EventSourceResponse` from `sse_starlette` for the SSE endpoint, mirroring `agents.py:120-124`.

**Endpoints:**

| Method | Path | Body | Returns | Status |
|--------|------|------|---------|--------|
| GET | `/api/chats` | — | `ChatListResponse` | 200 |
| POST | `/api/chats` | `ChatCreateRequest` | `ChatResponse` | 201 |
| GET | `/api/chats/{chat_id}` | — | `ChatResponse` | 200 |
| POST | `/api/chats/{chat_id}/messages` | `ChatMessageCreateRequest` | `ChatMessageResponse` | 201 |
| GET | `/api/chats/{chat_id}/messages` | query `since_seq` | `list[ChatMessageResponse]` | 200 |
| POST | `/api/chats/{chat_id}/archive` | — | `ChatResponse` | 200 |
| GET | `/api/chats/{chat_id}/events` | query `since`, or `Last-Event-ID` header | SSE | 200 |

**Query params for list:**
- `project_id: UUID` (required)
- `include_archived: bool = False`

**SSE implementation:**
- Resolve the chat's bound `agent_run_id` (if the session is active). If no active run, return an empty stream (or a single `replay_truncated` event with `requested_since_seq=since, oldest_available_seq=since, reason="archived"`).
- Otherwise, delegate to `agent_service.stream_events(mgr, run_id, since=since)` exactly like `agents.py:83-118`. Reuse `serialize_event` and `EVENT_KINDS`.
- Same SSE headers: `{"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}`, `ping=15`.

**What NOT to do:**
- Do NOT invent new event kinds. The 10 in `EVENT_KINDS` (verified in `sse_events.py:116-129`) are the complete set.
- Do NOT read `StateError` details and hand-craft HTTPException — use `to_http_exception(exc)` (already imported in `agents.py:24`).
- Do NOT forget to json-decode `ChatMessage.tool_calls` when constructing `ChatMessageResponse`. Use a local `_message_to_response(row) -> ChatMessageResponse` helper with `json.loads(row.tool_calls or "[]")`.

**Verification:**
```bash
cd ~/Projects/RAPID/web/backend
uv run python -c "from app.routers.chats import router; assert router.prefix == '/api/chats'; print('ok')"
uv run ruff check app/routers/chats.py
```

---

### T8. Dashboard router — `app/routers/dashboard.py` (new)

**Files modified:**
- `web/backend/app/routers/dashboard.py` (new)

**Implementation:**

Single endpoint — `GET /api/dashboard?project_id=X` returning `DashboardResponse`.

**Aggregation strategy** (target <100ms; use SQL aggregates, not Python counting):

```python
# runs_summary counts — one GROUP BY query:
# SELECT status, COUNT(*) FROM agentrun WHERE project_id = ? GROUP BY status
# Map buckets: running, waiting -> active; failed; completed; others -> skip.

# runs_summary.recent — one ORDER BY LIMIT query:
# SELECT id, skill_name, status, started_at FROM agentrun
# WHERE project_id = ? ORDER BY started_at DESC LIMIT 5

# chats_summary counts — one query:
# SELECT
#   SUM(CASE WHEN session_status='active' AND archived_at IS NULL THEN 1 ELSE 0 END) AS active,
#   SUM(CASE WHEN session_status='idle' AND archived_at IS NULL THEN 1 ELSE 0 END) AS idle,
#   SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) AS archived
# FROM chat WHERE project_id = ?

# chats_summary.recent — one ORDER BY LIMIT query:
# SELECT id, title, skill_name, last_message_at, session_status FROM chat
# WHERE project_id = ? AND archived_at IS NULL
# ORDER BY last_message_at DESC LIMIT 5

# kanban_summary — one query:
# SELECT COUNT(*) FROM kanbancard WHERE column_id IN (
#   SELECT id FROM kanbancolumn WHERE project_id = ?
# )  -- total
# (in_progress and blocked: initially ZERO placeholders — existing kanban schema
#  does NOT have in_progress/blocked status columns; kanban column positions
#  encode status. Return total; in_progress=total-archived if desired;
#  blocked=0 for now with a TODO.)

# budget_remaining — use settings values. spent_today: SUM(total_cost_usd)
# from agentrun where started_at >= today_utc_midnight.
# daily_cap: settings.rapid_budget_daily_cap if set, else 999.0 sentinel.

# recent_activity — UNION of latest 10 runs + 10 chats, sort by ts desc, take 10.
# Python-side merge is fine (bounded to 20 items).
```

Add a **1-second in-memory LRU-ish cache** keyed by `project_id` (per CONTEXT specifics line 180). Simplest: a `dict[UUID, tuple[DashboardResponse, float]]` module-level with a lock-free read path. If `time.monotonic() - ts < 1.0`, return cached; else recompute and store. This prevents thundering herd on tab focus.

**What NOT to do:**
- Do NOT call per-kanban-card queries — use a single `COUNT(*)` with subquery for `project_id → column_id`.
- Do NOT re-fetch full rows when counts suffice — use `SELECT COUNT(*)` not `SELECT *`.
- Do NOT let the cache grow unbounded — cap the dict at `max 64 entries` (projects are typically few; over-cap evicts oldest).
- Do NOT add the cache inside a test-hostile global — expose `_invalidate_cache()` and `_clear_cache()` helpers so backend tests can reset between test methods.

**Verification:**
```bash
cd ~/Projects/RAPID/web/backend
uv run python -c "from app.routers.dashboard import router; assert router.prefix == '/api/dashboard' or '/api' in router.prefix; print('ok')"
uv run ruff check app/routers/dashboard.py
```

---

### T9. Register routers in `app/main.py`

**Files modified:**
- `web/backend/app/main.py` (lines 23-26 imports, lines 192-198 registration)

**Implementation:**

Add two new imports near the existing router imports (lines 23-26):

```python
from app.routers.chats import router as chats_router
from app.routers.dashboard import router as dashboard_router
```

Append two `include_router` calls after `skills_router` (currently line 198):

```python
app.include_router(chats_router)
app.include_router(dashboard_router)
```

**What NOT to do:**
- Do NOT reorder existing `include_router` calls — just append.
- Do NOT add a `prefix=` override at `include_router` time — the routers define their own prefix.

**Verification:**
```bash
cd ~/Projects/RAPID/web/backend
uv run python -c "from app.main import create_app; app = create_app(); paths = [r.path for r in app.routes]; assert any(p.startswith('/api/chats') for p in paths); assert any(p.startswith('/api/dashboard') for p in paths); print('ok')"
uv run ruff check app/main.py
```

---

### T10. Backend tests

**Files modified:**
- `web/backend/tests/test_chat_models.py` (new)
- `web/backend/tests/test_migration_0007.py` (new)
- `web/backend/tests/test_chat_service.py` (new)
- `web/backend/tests/test_chats_router.py` (new)
- `web/backend/tests/test_dashboard_router.py` (new)

#### T10.1 — `test_chat_models.py`

Verify model metadata, foreign-key wiring, unique index on `(chat_id, seq)`, and default values. Pattern: see `tests/agents/test_models_schema.py`.

Test cases:
- `test_chat_model_registers_in_metadata` — `'chat' in SQLModel.metadata.tables`
- `test_chatmessage_has_chat_fk` — inspect FK to `chat.id`
- `test_chatmessage_unique_seq_per_chat` — insert two messages with `(chat_id=X, seq=1)`, second raises `IntegrityError`
- `test_chatattachment_all_fields_nullable_except_id` — verify each column's `nullable=True`
- `test_attachment_kind_enum_values` — `AttachmentKind.FILE.value == 'file'`, etc.

#### T10.2 — `test_migration_0007.py`

Copy the fixture pattern from `tests/agents/test_migration_0005.py`. Verify upgrade creates `chat`, `chatmessage`, `chatattachment` tables with expected columns; downgrade drops them cleanly.

Test cases:
- `test_migration_0007_creates_tables` — inspector lists all three tables after upgrade.
- `test_migration_0007_columns_chat` — column set matches the model.
- `test_migration_0007_columns_chatmessage` — column set matches the model.
- `test_migration_0007_downgrade_roundtrip` — upgrade → downgrade → tables gone → upgrade → tables back.
- `test_migration_0007_revision_metadata` — `revision == "0007"`, `down_revision == "0006"`.

#### T10.3 — `test_chat_service.py`

Unit tests using an in-memory sqlite session (pattern from `test_kanban_service.py`).

Test cases:
- `test_create_thread_returns_row_with_defaults` — session_status='active', title='', archived_at=None.
- `test_create_thread_unknown_project_raises_state_error` — `StateError` with `error_code='project_not_found'`.
- `test_list_threads_filters_archived_by_default` — insert 2 active + 1 archived, list returns 2.
- `test_list_threads_includes_archived_when_flag_set` — same setup, `include_archived=True` returns 3.
- `test_list_threads_orders_by_last_message_at_desc` — newest first.
- `test_send_message_persists_user_message_with_seq_1` — first message in a fresh thread gets seq=1.
- `test_send_message_monotonic_seq` — second message gets seq=2.
- `test_send_message_sets_temp_id_when_provided` — temp_id round-trips.
- `test_archive_thread_sets_archived_at` — archived_at is non-null, session_status='archived'.
- `test_archive_thread_rejects_send_message` — sending to archived raises `StateError(error_code='thread_archived')`.
- `test_list_messages_returns_in_seq_order` — 3 messages returned in seq=1,2,3 order regardless of insertion.
- `test_materialize_assistant_turn_accumulates_text_and_tool_calls` — unit-test the helper with a synthetic event list.

**Behavioral invariant coverage:** `chat_thread_lifecycle` (active | idle | archived) — the lifecycle tests above cover active/archived. Idle is set at session-manager timeout time (tested as part of session reuse logic in a follow-up; stub test that asserts a service function does NOT reject idle threads).

#### T10.4 — `test_chats_router.py`

FastAPI TestClient integration tests. Pattern: `tests/agents/test_agents_router.py`.

Test cases:
- `test_create_chat_201` — POST /api/chats with valid body returns 201 + ChatResponse shape.
- `test_create_chat_missing_skill_400` — min_length validation.
- `test_create_chat_unknown_project_409` — StateError → 409 via `to_http_exception` (matches project_not_found).
- `test_list_chats_200` — GET with project_id query returns ChatListResponse shape.
- `test_list_chats_excludes_archived_by_default` — archived thread not in items.
- `test_list_chats_with_include_archived_flag` — archived thread IS in items.
- `test_get_chat_404` — unknown UUID returns 404.
- `test_post_message_201` — message persisted, temp_id round-trips.
- `test_post_message_archived_thread_409` — StateError → 409.
- `test_list_messages_since_seq` — query `?since_seq=2` returns only seq>2.
- `test_sse_events_endpoint_no_active_run_returns_empty_stream` — SSE connection closes cleanly when the thread has no bound run.
- `test_sse_events_endpoint_headers` — `Cache-Control: no-cache`, `X-Accel-Buffering: no` present.

#### T10.5 — `test_dashboard_router.py`

Pattern: `tests/test_projects_api.py`.

Test cases:
- `test_dashboard_returns_zero_counts_on_empty_db`
- `test_dashboard_runs_summary_counts_by_status` — insert runs with `status='running'` and `'completed'`, verify buckets.
- `test_dashboard_chats_summary_counts_active_idle_archived`
- `test_dashboard_recent_runs_limited_to_5` — insert 7 runs, assert `len(recent) == 5`.
- `test_dashboard_recent_activity_merges_and_sorts` — mix of runs + chats sorted by ts desc, limit 10.
- `test_dashboard_budget_remaining_uses_settings_cap`
- `test_dashboard_caches_within_1_second` — call twice rapidly; mock the service layer to track query count; assert second call hits cache.
- `test_dashboard_cache_invalidates_after_1_second` — wrap `time.monotonic` via monkeypatch, advance past 1.0s, verify recompute.

**Verification (all backend tests):**
```bash
cd ~/Projects/RAPID/web/backend
uv run pytest tests/test_chat_models.py tests/test_migration_0007.py tests/test_chat_service.py tests/test_chats_router.py tests/test_dashboard_router.py -v
uv run pytest  # full suite — nothing in Wave 1 should break existing tests
uv run ruff check .
```

---

## Success Criteria

### Export coverage (CONTRACT.json exports fulfilled by this wave)

| Export | Task | File |
|--------|------|------|
| `chat_schema` | T1, T2, T3 | `app/models/chat.py`, migration |
| `chat_service` | T6 | `app/services/chat_service.py` |
| `chats_http` | T7 | `app/routers/chats.py` |
| `consolidated_dashboard_endpoint` | T5, T8 | `app/routers/dashboard.py` + schemas |

### Behavioral invariants covered

| Invariant | Enforcement | Task |
|-----------|-------------|------|
| Chat thread lifecycle (active\|idle\|archived) | `test_chat_service.py` | T10.3 |
| `run_survives_tab_close` (shared with Wave 3 tests) | Backend side: SSE reconnect works mid-session | T7 SSE tests (T10.4) |
| `polling_primary_sse_augmentation` (backend side) | Dashboard endpoint replaces 4-5 independent polls | T8 (T10.5) |

### Automated verification

All commands must pass:

```bash
cd ~/Projects/RAPID/web/backend
uv run alembic -c alembic.ini upgrade head  # on tmp DB
uv run alembic -c alembic.ini downgrade -1
uv run alembic -c alembic.ini upgrade head
uv run pytest tests/test_chat_models.py tests/test_migration_0007.py tests/test_chat_service.py tests/test_chats_router.py tests/test_dashboard_router.py -v
uv run pytest  # full suite stays green
uv run ruff check .
```

### Deliverables checklist

- [ ] `app/models/chat.py` with `Chat`, `ChatMessage`, `ChatAttachment`, `AttachmentKind`
- [ ] `app/database.py` imports chat models at bottom
- [ ] `alembic/versions/0007_chat_persistence.py` (revision="0007", down_revision="0006")
- [ ] `app/schemas/chats.py`
- [ ] `app/schemas/dashboard.py`
- [ ] `app/services/chat_service.py` (create_thread, list_threads, get_thread, send_message, archive_thread, list_messages)
- [ ] `app/routers/chats.py` (7 endpoints)
- [ ] `app/routers/dashboard.py` (1 endpoint, with 1s cache)
- [ ] `app/main.py` registers chats + dashboard routers
- [ ] 5 new test files, all passing

---

## Out of Scope for Wave 1

- Any `web/frontend/**` modifications — Wave 2 and Wave 3 own those.
- Session-recovery UX after server restart — handled lazily on next `send_message`.
- ChatAttachment upload/storage logic — stub table only; v7.1 milestone.
- Background idle-timeout sweeper — check happens on-demand at `send_message`.
