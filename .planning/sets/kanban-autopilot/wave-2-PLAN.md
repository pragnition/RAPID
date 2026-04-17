# PLAN: kanban-autopilot / Wave 2 — Agent Tools, Routing & Autopilot Worker

## Objective

Build the agent-facing layer: MCP tools that let agents read/write kanban cards, the card-to-skill routing logic, and the always-on autopilot poller that claims unclaimed cards in autopilot-enabled columns and dispatches agent runs. Also extends the HTTP router with new endpoints for card locking, column autopilot toggle, and the move-with-rev variant.

## Prerequisites

Wave 1 must be complete. This wave consumes: `KanbanCard.rev`, `KanbanCard.locked_by_run_id`, `KanbanCard.agent_status`, `KanbanColumn.is_autopilot`, `lock_card()`, `unlock_card()`, `StaleRevisionError`, `set_card_agent_status()`, `update_column_autopilot()`.

## File Ownership

| File | Action |
|------|--------|
| `web/backend/app/agents/tools/kanban_tools.py` | Create — @tool functions |
| `web/backend/app/agents/tools/__init__.py` | Modify — wire in kanban tools |
| `web/backend/app/agents/card_routing.py` | Create — label-to-skill routing |
| `web/backend/app/agents/autopilot_worker.py` | Create — lifespan poller |
| `web/backend/app/agents/permissions.py` | Modify — add autopilot policy entry |
| `web/backend/app/routers/kanban.py` | Modify — new endpoints |
| `web/backend/app/main.py` | Modify — start/stop autopilot in lifespan |
| `web/backend/tests/test_kanban_tools.py` | Create — agent tool tests |
| `web/backend/tests/test_card_routing.py` | Create — routing tests |
| `web/backend/tests/test_autopilot_worker.py` | Create — worker tests |

## Tasks

### Task 1: Create kanban agent tools

**File:** `web/backend/app/agents/tools/kanban_tools.py`

Create a `build_kanban_tools(run_id: UUID, manager: "AgentSessionManager") -> list` function that returns `@tool`-decorated callables. Follow the exact same factory+closure pattern as `ask_user.py`.

Each tool function:
- Gets a `Session` from `manager.engine`
- Routes through `kanban_service` functions
- Returns the standard `{"content": [{"type": "text", "text": json_result}], "is_error": False}` shape
- On error, returns `{"content": [{"type": "text", "text": error_msg}], "is_error": True}`

#### Tools to implement:

**`list_cards(column: str | None = None) -> list[dict]`**
- If column is provided, filter by column title (case-insensitive match).
- Returns list of card dicts with: id, title, description (wrapped as `<untrusted>...</untrusted>`), agent_status, rev, column title.
- Read-only, no locking check needed.

**`get_card(card_id: str) -> dict`**
- Returns full card dict including description (wrapped as `<untrusted>...</untrusted>`).
- Read-only.

**`add_card(column: str, title: str, description: str = "", labels: str = "") -> dict`**
- Resolves column by title (case-insensitive).
- Enforces creation cap: `SELECT COUNT(*) FROM kanbancard WHERE created_by = 'agent:{run_id}'` must be < 5. If at cap, return error.
- Sets `created_by=f"agent:{run_id}"`.
- Returns the new card dict.

**`move_card(card_id: str, to_column: str, rev: int) -> dict`**
- Resolves target column by title (case-insensitive).
- Verifies `locked_by_run_id == run_id` — agents can only move their own claimed cards.
- Calls `kanban_service.move_card(session, card_id, target_column_id, position=0, rev=rev)` (position=0 puts it at top of target column).
- Returns updated card dict.

**`update_card(card_id: str, title: str | None = None, description: str | None = None, rev: int = 0) -> dict`**
- Verifies `locked_by_run_id == run_id`.
- Calls `kanban_service.update_card` with rev.
- Returns updated card dict.

**`comment_card(card_id: str, comment: str) -> None`**
- For now, appends comment to `metadata_json` (parse as JSON, add to a `"comments"` array, serialize back).
- No locking check — any agent can comment on any card.
- Returns `{"content": [{"type": "text", "text": "Comment added"}], "is_error": False}`.

Important implementation notes:
- Card descriptions in responses MUST be wrapped: `f"<untrusted>{card.description}</untrusted>"` — this is a behavioral contract.
- Use `asyncio.to_thread()` for all DB operations (the tool functions are async).
- Import `tool` from `claude_agent_sdk`.
- The `labels` parameter on `add_card` is stored in `metadata_json` as `{"labels": [...]}`.
- Column resolution: query `SELECT * FROM kanbancolumn WHERE lower(title) = lower(:title)` using the session. If not found, return error.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.agents.tools.kanban_tools import build_kanban_tools
from unittest.mock import MagicMock
from uuid import uuid4
tools = build_kanban_tools(uuid4(), MagicMock())
print(f'{len(tools)} tools:', [t.__name__ if hasattr(t, '__name__') else str(t) for t in tools])
"
```

### Task 2: Wire kanban tools into build_tools

**File:** `web/backend/app/agents/tools/__init__.py`

Import `build_kanban_tools` from `app.agents.tools.kanban_tools` and extend the return list:

```python
from app.agents.tools.kanban_tools import build_kanban_tools

def build_tools(run_id: UUID, manager: "AgentSessionManager") -> List[Any]:
    return build_ask_user_tools(run_id=run_id, manager=manager) + \
           build_kanban_tools(run_id=run_id, manager=manager)
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.agents.tools import build_tools
from unittest.mock import MagicMock
from uuid import uuid4
tools = build_tools(uuid4(), MagicMock())
print(f'{len(tools)} total tools')
"
```

### Task 3: Create card-to-skill routing

**File:** `web/backend/app/agents/card_routing.py`

```python
"""Label-based card-to-skill routing for autopilot dispatch."""

from __future__ import annotations
import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.database import KanbanCard

# Default routing table — configurable via column settings in future.
_LABEL_TO_SKILL: dict[str, str] = {
    "bug": "rapid:bug-fix",
    "feature": "rapid:add-set",
    "chore": "rapid:quick",
}

_DEFAULT_SKILL = "rapid:quick"


def route_card_to_skill(card: "KanbanCard") -> tuple[str, dict]:
    """Return (skill_name, skill_args) for a given card.

    Routing priority:
    1. Check card labels (stored in metadata_json["labels"]).
    2. First matching label wins.
    3. Fallback to _DEFAULT_SKILL.
    """
    labels: list[str] = []
    try:
        meta = json.loads(card.metadata_json) if card.metadata_json else {}
        labels = [l.lower().strip() for l in meta.get("labels", [])]
    except (json.JSONDecodeError, AttributeError):
        pass

    for label in labels:
        if label in _LABEL_TO_SKILL:
            skill = _LABEL_TO_SKILL[label]
            break
    else:
        skill = _DEFAULT_SKILL

    args = {
        "card_id": str(card.id),
        "title": card.title,
        "description": card.description,
    }
    return skill, args
```

Keep this module pure (no DB I/O, no async). It receives a card object and returns a tuple.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.agents.card_routing import route_card_to_skill
from unittest.mock import MagicMock
card = MagicMock()
card.id = 'test-123'
card.title = 'Fix login'
card.description = 'Login broken'
card.metadata_json = '{\"labels\": [\"bug\"]}'
skill, args = route_card_to_skill(card)
print(f'Skill: {skill}, Args: {args}')
assert skill == 'rapid:bug-fix'
"
```

### Task 4: Create autopilot worker

**File:** `web/backend/app/agents/autopilot_worker.py`

```python
"""Lifespan-managed autopilot poller.

Polls autopilot-enabled columns for unclaimed cards and dispatches agent runs
via AgentSessionManager.start_run(). Respects per-project concurrency cap
by reusing the same semaphore mechanism in the session manager.
"""
```

Implement `AutopilotWorker` class:

```python
class AutopilotWorker:
    def __init__(self, engine, session_manager, interval_s=60.0):
        self.engine = engine
        self.session_manager = session_manager
        self.interval_s = interval_s
        self._stopping = asyncio.Event()
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        self._stopping.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
```

The `_poll_loop`:
1. `while not self._stopping.is_set()`: wait for `interval_s` (same pattern as orphan sweeper).
2. Query all autopilot-enabled columns: `SELECT * FROM kanbancolumn WHERE is_autopilot = 1`.
3. For each column, find unclaimed cards: `SELECT * FROM kanbancard WHERE column_id = :col_id AND agent_status = 'idle' AND locked_by_run_id IS NULL ORDER BY position ASC`.
4. For each card:
   a. Get the project_id from the column.
   b. Call `kanban_service.lock_card(session, card.id, run_id=None)` — wait, the autopilot doesn't have a run_id yet. Instead:
      - Route the card: `skill_name, skill_args = route_card_to_skill(card)`
      - Call `session_manager.start_run(project_id, skill_name, skill_args, prompt=build_prompt(card))` to get an `AgentRun` row.
      - Then lock the card with the new `run.id`: `kanban_service.lock_card(session, card.id, run.id)`.
      - If lock fails (race), the card was claimed between query and lock — skip it. The agent run will notice it has no card and exit gracefully.
   c. Set `card.agent_status = "running"` via `set_card_agent_status`.
5. Catch all exceptions per card (never let one card crash the poller).
6. Log dispatched count per cycle.

The `build_prompt` helper constructs the agent prompt:
```python
def _build_prompt(card):
    return (
        f"You are working on kanban card '{card.title}'.\n"
        f"Card ID: {card.id}\n"
        f"Description:\n<untrusted>{card.description}</untrusted>\n\n"
        f"Complete the task described above. When done, move the card to the 'Done' column."
    )
```

Important:
- The worker does NOT bypass the per-project semaphore — `start_run` already handles that.
- If `start_run` raises `StateError` (concurrency cap hit), catch and skip.
- Max retry logic: skip cards where `retry_count >= 3`.
- After a run completes (track via a callback or post-run hook), if the run failed, increment `retry_count` and set `agent_status = "blocked"` when `retry_count >= 3`. Move card to "Blocked" column if one exists.

For the MVP, implement the post-run tracking as a separate coroutine that monitors the run via `session_manager.get_run()` polling. This can be refined later.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.agents.autopilot_worker import AutopilotWorker
print('AutopilotWorker imported successfully')
import inspect
print('Methods:', [m for m in dir(AutopilotWorker) if not m.startswith('_')]  )
"
```

### Task 5: Add autopilot permission policy

**File:** `web/backend/app/agents/permissions.py`

Add an `"autopilot"` entry to the `PERMISSION_POLICY` dict (after the existing entries):

```python
"autopilot": {
    "permission_mode": "acceptEdits",
    "allowed_tools": [],
    "disallowed_tools": [],
    "max_turns": 100,
},
```

This gives autopilot runs `acceptEdits` mode with 100 turns max. The destructive patterns are shared across all policies.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.agents.permissions import PERMISSION_POLICY
assert 'autopilot' in PERMISSION_POLICY, 'Missing autopilot policy'
print('Autopilot policy:', PERMISSION_POLICY['autopilot'])
"
```

### Task 6: Extend HTTP router with new endpoints

**File:** `web/backend/app/routers/kanban.py`

#### 6a: Update the move_card endpoint to accept optional `rev`

Change the `move_card` endpoint to accept `KanbanCardMoveWithRev` (from the updated schemas). Pass `body.rev` through to `kanban_service.move_card`. Catch `StaleRevisionError` and return HTTP 409:

```python
from app.services.kanban_service import StaleRevisionError

except StaleRevisionError as exc:
    raise HTTPException(status_code=409, detail=str(exc))
```

#### 6b: Add column autopilot toggle endpoint

```python
@router.put("/{project_id}/kanban/columns/{column_id}/autopilot")
def toggle_column_autopilot(
    project_id: UUID,
    column_id: UUID,
    body: dict,  # {"is_autopilot": true/false}
    session: Session = Depends(get_db),
):
```

Calls `kanban_service.update_column_autopilot(session, column_id, body["is_autopilot"])`.

#### 6c: Update all card response construction to include new fields

Every place that constructs `KanbanCardResponse` in the router must now include the new fields (`rev`, `created_by`, `agent_status`, `locked_by_run_id`, `completed_by_run_id`, `agent_run_id`, `retry_count`). Similarly, `KanbanColumnResponse` must include `is_autopilot`.

Since `KanbanCardResponse` uses `ConfigDict(from_attributes=True)`, the response model can auto-populate from the SQLModel instance IF the response is constructed from the model rather than a manual dict. Review each endpoint:

- `create_card`: The card object from `kanban_service.create_card` has all fields. Construct the response with explicit field access to include new fields.
- `update_card`, `move_card`: Same — add new fields.
- `get_board`: Already returns a dict from `kanban_service.get_board` which was updated in Wave 1 Task 3h.
- `create_column`, `update_column`: Add `is_autopilot` to the response dict.

#### 6d: Update the update_column endpoint to pass is_autopilot

If `body.is_autopilot is not None`, call `kanban_service.update_column_autopilot`.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.routers.kanban import router
routes = [(r.path, r.methods) for r in router.routes]
print('Routes:', routes)
" 2>&1 | head -20
```

### Task 7: Start/stop autopilot worker in lifespan

**File:** `web/backend/app/main.py`

In the `lifespan` function, after `agent_manager` is started:

```python
from app.agents.autopilot_worker import AutopilotWorker

autopilot = AutopilotWorker(engine, agent_manager)
await autopilot.start()
app.state.autopilot_worker = autopilot
```

In the shutdown section (before engine dispose):
```python
if hasattr(app.state, "autopilot_worker") and app.state.autopilot_worker:
    await app.state.autopilot_worker.stop()
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
import ast, inspect
from app.main import lifespan
src = inspect.getsource(lifespan)
assert 'AutopilotWorker' in src, 'AutopilotWorker not in lifespan'
assert 'autopilot_worker' in src
print('Lifespan includes autopilot worker')
"
```

### Task 8: Write agent tool tests

**File:** `web/backend/tests/test_kanban_tools.py`

Test the kanban tools in isolation using an in-memory DB and mocked `AgentSessionManager`. The tools are sync functions that internally use `asyncio.to_thread`, so test them by calling the underlying sync service logic directly and verifying tool output format.

Test cases:
1. **test_list_cards_returns_all** — Create cards, call list_cards, verify all returned.
2. **test_list_cards_filter_by_column** — Filter by column title.
3. **test_get_card_wraps_description_untrusted** — Verify description is wrapped in `<untrusted>` tags.
4. **test_add_card_enforces_cap** — Create 5 cards as agent, attempt 6th, verify error.
5. **test_move_card_requires_lock** — Move a card without holding the lock. Verify error.
6. **test_update_card_requires_lock** — Same for update.
7. **test_comment_card_appends** — Add two comments, verify both in metadata_json.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_kanban_tools.py -v --tb=short
```

### Task 9: Write routing tests

**File:** `web/backend/tests/test_card_routing.py`

Test cases:
1. **test_bug_label_routes_to_bug_fix** — Card with `["bug"]` label routes to `rapid:bug-fix`.
2. **test_feature_label_routes_to_add_set** — Routes to `rapid:add-set`.
3. **test_no_labels_routes_to_default** — Routes to `rapid:quick`.
4. **test_multiple_labels_first_wins** — `["feature", "bug"]` routes to `rapid:add-set` (feature is checked first if it comes first in the label list — but actually the routing iterates through card labels and checks against the map, so first matching label wins).
5. **test_invalid_metadata_json** — Card with `metadata_json="not json"` falls back to default.
6. **test_args_contain_card_info** — Verify returned args dict has `card_id`, `title`, `description`.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_card_routing.py -v --tb=short
```

### Task 10: Write autopilot worker tests

**File:** `web/backend/tests/test_autopilot_worker.py`

Test cases (using asyncio test fixtures):
1. **test_worker_starts_and_stops** — Start worker, verify task is created, stop, verify task is cancelled.
2. **test_worker_skips_non_autopilot_columns** — Create a column with `is_autopilot=False`, add a card. Run one poll cycle. Verify no run dispatched.
3. **test_worker_dispatches_for_autopilot_column** — Create autopilot column with idle card. Mock `session_manager.start_run`. Run one cycle. Verify `start_run` called.
4. **test_worker_skips_locked_cards** — Card already locked. Verify not dispatched.
5. **test_worker_skips_cards_at_retry_limit** — Card with `retry_count >= 3`. Verify skipped.
6. **test_worker_catches_dispatch_errors** — `start_run` raises. Verify worker continues to next card without crashing.

For testing, expose the single-poll-cycle logic as a testable method (e.g., `_poll_once`) that can be called directly.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_autopilot_worker.py -v --tb=short
```

## Success Criteria

1. All 6+7+6 = 19 new test cases pass
2. `build_tools()` returns kanban tools alongside ask_user tools
3. Card descriptions in tool responses are wrapped with `<untrusted>` tags
4. Agent card creation cap enforced at 5 per run
5. Autopilot worker starts/stops cleanly with FastAPI lifespan
6. Card routing correctly maps labels to skills
7. `PERMISSION_POLICY["autopilot"]` exists with `acceptEdits` mode
8. HTTP 409 returned on stale rev in move_card endpoint
9. Column autopilot toggle endpoint works
10. No existing tests break: `uv run pytest tests/ -v --tb=short`
