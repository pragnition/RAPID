# PLAN: kanban-autopilot / Wave 1 — Schema & Service Foundation

## Objective

Evolve the KanbanCard and KanbanColumn SQLModels from passive human-only entities into agent-aware structures with optimistic concurrency control. Add an Alembic migration for the new columns, extend `kanban_service.py` with rev-based concurrency and card locking, extend the Pydantic schemas, and write comprehensive tests (no existing kanban tests exist).

## File Ownership

| File | Action |
|------|--------|
| `web/backend/app/database.py` | Modify — add fields to KanbanCard, KanbanColumn |
| `web/backend/alembic/versions/0006_kanban_v2_autopilot.py` | Create — Alembic migration |
| `web/backend/app/services/kanban_service.py` | Modify — add rev-based OCC, lock/unlock, agent-aware board projection |
| `web/backend/app/schemas/kanban.py` | Modify — extend request/response schemas with agent fields |
| `web/backend/tests/test_kanban_service.py` | Create — service layer unit tests |

## Tasks

### Task 1: Extend SQLModel classes in database.py

**File:** `web/backend/app/database.py`

Add the following fields to `KanbanCard` (lines 66-75):

```
rev: int = Field(default=0)
created_by: str = Field(default="human")
locked_by_run_id: UUID | None = Field(default=None, foreign_key="agentrun.id")
completed_by_run_id: UUID | None = Field(default=None, foreign_key="agentrun.id")
agent_status: str = Field(default="idle")  # idle | claimed | running | blocked | completed
metadata_json: str = Field(default="{}")
agent_run_id: UUID | None = Field(default=None, foreign_key="agentrun.id")
retry_count: int = Field(default=0)
```

Add the following field to `KanbanColumn` (lines 56-63):

```
is_autopilot: bool = Field(default=False)
```

Important notes:
- The `locked_by_run_id`, `completed_by_run_id`, and `agent_run_id` fields use `foreign_key="agentrun.id"` (lowercase table name — `AgentRun.__tablename__` defaults to `agentrun`).
- The `agent_status` field is a plain string, not an enum. Validation happens at the service layer. Valid values: `idle`, `claimed`, `running`, `blocked`, `completed`.
- Do NOT rename the existing `metadata_json` on `Project`. The card's field is named `metadata_json` to match project convention (not `metadata` which is reserved by SQLAlchemy).
- The `rev` field starts at 0 for new cards. Every mutation via the service layer increments it by 1.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && python -c "from app.database import KanbanCard, KanbanColumn; c = KanbanCard(column_id='00000000-0000-0000-0000-000000000000', title='test'); print(c.rev, c.agent_status, c.created_by); col = KanbanColumn(project_id='00000000-0000-0000-0000-000000000000', title='test'); print(col.is_autopilot)"
```
Expected: `0 idle human` then `False`

### Task 2: Create Alembic migration 0006

**File:** `web/backend/alembic/versions/0006_kanban_v2_autopilot.py`

Create migration 0006 that adds the new columns to `kanbancard` and `kanbancolumn` tables. Follow the existing pattern from 0005.

Critical SQLite requirements:
- Use `op.batch_alter_table("kanbancard")` and `op.batch_alter_table("kanbancolumn")` — SQLite cannot add FK columns via plain ALTER TABLE.
- Use `render_as_batch=True` context or explicit `batch_alter_table` blocks.
- All new columns must have `server_default` values for existing rows:
  - `rev`: `server_default="0"`
  - `created_by`: `server_default="human"`
  - `locked_by_run_id`: nullable, no default needed
  - `completed_by_run_id`: nullable, no default needed
  - `agent_status`: `server_default="idle"`
  - `metadata_json`: `server_default="{}"`
  - `agent_run_id`: nullable, no default needed
  - `retry_count`: `server_default="0"`
  - `is_autopilot`: `server_default="0"` (SQLite boolean)

Include a downgrade that removes these columns using batch mode.

Add an index on `kanbancard.agent_status` for efficient autopilot queries:
```python
op.create_index("ix_kanbancard_agent_status", "kanbancard", ["agent_status"])
```

Add a composite index for the autopilot poller's claim query:
```python
op.create_index("ix_kanbancard_status_locked", "kanbancard", ["agent_status", "locked_by_run_id"])
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run alembic upgrade head && uv run python -c "
from app.database import get_engine
from sqlmodel import Session, text
e = get_engine()
with Session(e) as s:
    cols = s.exec(text('PRAGMA table_info(kanbancard)')).all()
    names = [c[1] for c in cols]
    assert 'rev' in names, f'rev missing: {names}'
    assert 'agent_status' in names, f'agent_status missing: {names}'
    assert 'locked_by_run_id' in names, f'locked_by_run_id missing: {names}'
    print('Migration OK:', names)
"
```

### Task 3: Extend kanban_service.py with rev-based OCC and locking

**File:** `web/backend/app/services/kanban_service.py`

#### 3a: Add a `StaleRevisionError` exception class

Define at the top of the file:
```python
class StaleRevisionError(ValueError):
    """Raised when an update targets a stale rev."""
    def __init__(self, card_id, expected_rev, actual_rev):
        self.card_id = card_id
        self.expected_rev = expected_rev
        self.actual_rev = actual_rev
        super().__init__(f"Card {card_id}: expected rev {expected_rev}, found {actual_rev}")
```

#### 3b: Add `lock_card(session, card_id, run_id) -> bool`

Uses raw SQLAlchemy `UPDATE ... WHERE locked_by_run_id IS NULL` for atomicity:
```python
from sqlalchemy import update
result = session.execute(
    update(KanbanCard)
    .where(KanbanCard.id == card_id)
    .where(KanbanCard.locked_by_run_id.is_(None))
    .values(locked_by_run_id=run_id, agent_status="claimed", updated_at=_utcnow())
)
session.commit()
return result.rowcount > 0
```
On success, also call `_sync_board(session, project_id)` (look up the column to get project_id).

#### 3c: Add `unlock_card(session, card_id, run_id) -> None`

Verifies `locked_by_run_id == run_id` before clearing. Uses raw UPDATE for atomicity. Sets `agent_status` back to `idle`. Bumps `rev`. Calls `_sync_board`.

#### 3d: Modify existing `move_card` to accept optional `rev` parameter

Add parameter `rev: int | None = None`. When `rev is not None`:
1. Re-read the card and compare `card.rev` against `rev`
2. If mismatch, raise `StaleRevisionError(card_id, rev, card.rev)`
3. On success, increment `card.rev += 1`

The existing move_card callers (the HTTP handler) pass `rev=None` so backward-compatible.

#### 3e: Modify existing `update_card` to accept optional `rev` parameter

Same pattern as move_card: optional `rev` parameter, check-and-bump when provided.

#### 3f: Add `set_card_agent_status(session, card_id, status, run_id) -> KanbanCard`

Changes `agent_status` and bumps `rev`. Verifies `locked_by_run_id == run_id` if the card is locked. Calls `_sync_board`.

#### 3g: Modify existing `create_card` to accept optional `created_by` parameter

Default is `"human"`. Sets `card.created_by = created_by`.

#### 3h: Update `get_board` to include agent fields in the card dict

Extend the card serialization dict in `get_board()` with:
```python
"rev": card.rev,
"created_by": card.created_by,
"agent_status": card.agent_status,
"locked_by_run_id": str(card.locked_by_run_id) if card.locked_by_run_id else None,
"completed_by_run_id": str(card.completed_by_run_id) if card.completed_by_run_id else None,
"agent_run_id": str(card.agent_run_id) if card.agent_run_id else None,
"retry_count": card.retry_count,
```

Extend the column serialization dict with:
```python
"is_autopilot": col.is_autopilot,
```

#### 3i: Add `update_column_autopilot(session, column_id, is_autopilot: bool) -> KanbanColumn`

Sets `column.is_autopilot = is_autopilot`, commits, syncs board, returns column.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.services import kanban_service
import inspect
sig = inspect.signature(kanban_service.lock_card)
print('lock_card params:', list(sig.parameters.keys()))
sig2 = inspect.signature(kanban_service.move_card)
print('move_card params:', list(sig2.parameters.keys()))
"
```

### Task 4: Extend Pydantic schemas

**File:** `web/backend/app/schemas/kanban.py`

#### 4a: Extend `KanbanCardResponse`

Add fields:
```python
rev: int
created_by: str
agent_status: str
locked_by_run_id: str | None = None
completed_by_run_id: str | None = None
agent_run_id: str | None = None
retry_count: int
```

#### 4b: Extend `KanbanColumnResponse`

Add field:
```python
is_autopilot: bool
```

#### 4c: Add `KanbanCardMoveWithRev` schema

```python
class KanbanCardMoveWithRev(BaseModel):
    column_id: str
    position: int
    rev: int | None = None
```

#### 4d: Extend `KanbanColumnUpdate`

Add field:
```python
is_autopilot: bool | None = None
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.schemas.kanban import KanbanCardResponse, KanbanColumnResponse
print(KanbanCardResponse.model_fields.keys())
print(KanbanColumnResponse.model_fields.keys())
"
```

### Task 5: Write kanban service tests

**File:** `web/backend/tests/test_kanban_service.py`

Write tests using the same test infrastructure as other backend tests (pytest, in-memory SQLite). Create a fixture that sets up an engine, runs `SQLModel.metadata.create_all(engine)`, and provides a session.

Test cases:

1. **test_create_card_default_fields** — Create a card, verify `rev=0`, `agent_status="idle"`, `created_by="human"`.
2. **test_create_card_agent_created** — `create_card(..., created_by="agent:run-123")`, verify `created_by` persists.
3. **test_lock_card_success** — Lock an unlocked card. Verify returns `True`, card has `locked_by_run_id` set, `agent_status="claimed"`.
4. **test_lock_card_already_locked** — Lock card A, try to lock again with a different run_id. Verify returns `False`.
5. **test_unlock_card_success** — Lock then unlock. Verify card back to `agent_status="idle"`, `locked_by_run_id=None`, `rev` incremented.
6. **test_unlock_card_wrong_run** — Lock with run_id A, try to unlock with run_id B. Verify raises (or returns without effect).
7. **test_move_card_with_rev_success** — Move card passing correct rev. Verify rev incremented.
8. **test_move_card_stale_rev** — Move card passing stale rev. Verify raises `StaleRevisionError`.
9. **test_update_card_with_rev_success** — Update card passing correct rev. Verify rev incremented.
10. **test_update_card_stale_rev** — Update card passing stale rev. Verify raises `StaleRevisionError`.
11. **test_get_board_includes_agent_fields** — Create board, verify response dict includes `rev`, `agent_status`, `is_autopilot`.
12. **test_board_json_projection_matches_db** — Create/mutate cards, verify board.json on disk matches SQLite state (if project path is set up).
13. **test_update_column_autopilot** — Toggle `is_autopilot` on a column. Verify persisted.
14. **test_set_card_agent_status** — Set status to "running", verify persisted and rev bumped.

For tests requiring FK targets (locked_by_run_id references agentrun), create a test AgentRun row in the same session before testing lock_card.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_kanban_service.py -v --tb=short
```

## Success Criteria

1. `uv run alembic upgrade head` succeeds on a fresh DB and on a DB with existing 0005 migration
2. All 14 test cases pass
3. `get_board()` returns agent metadata fields for both cards and columns
4. `lock_card` uses atomic SQL UPDATE (not ORM load-modify-save)
5. `StaleRevisionError` raised when rev mismatches
6. board.json regenerated on every mutation (existing behavior preserved)
7. No existing tests break (verify with `uv run pytest tests/ -v --tb=short`)
