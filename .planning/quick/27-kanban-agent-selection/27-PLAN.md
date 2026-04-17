# Quick Task 27 -- Kanban Agent Type Selection

## Objective

Allow users to choose which agent (`quick` or `bug-fix`) handles a kanban card.
Cards get an `agent_type` field (default `"quick"`); columns get a
`default_agent_type` field (default `"quick"`) so that new cards inherit the
column's preference. The autopilot worker and card router honor the explicit
per-card `agent_type` over the old label-based heuristic.

Available agent types: `quick` (maps to `rapid:quick`) and `bug-fix` (maps to
`rapid:bug-fix`).

---

## Task 1 -- Backend: data model, schemas, service, migration

### Files to modify
- `web/backend/app/database.py`
- `web/backend/app/schemas/kanban.py`
- `web/backend/app/services/kanban_service.py`
- `web/backend/app/routers/kanban.py`
- `web/backend/app/agents/card_routing.py`
- `web/backend/app/agents/autopilot_worker.py`
- `web/backend/alembic/versions/0010_card_and_column_agent_type.py` (new)

### Actions

1. **Database model** (`database.py`):
   - Add `agent_type: str = Field(default="quick")` to `KanbanCard` (after
     `autopilot_ignore`).
   - Add `default_agent_type: str = Field(default="quick")` to `KanbanColumn`
     (after `is_autopilot`).

2. **Alembic migration** -- create `0010_card_and_column_agent_type.py`:
   - `upgrade()`: add `agent_type VARCHAR NOT NULL DEFAULT 'quick'` to
     `kanbancard`; add `default_agent_type VARCHAR NOT NULL DEFAULT 'quick'` to
     `kanbancolumn`. Use `batch_alter_table` for SQLite compatibility.
   - `down_revision = "0009"`.

3. **Pydantic schemas** (`schemas/kanban.py`):
   - `KanbanCardCreate`: add `agent_type: str = "quick"`.
   - `KanbanCardUpdate`: add `agent_type: str | None = None`.
   - `KanbanCardResponse`: add `agent_type: str`.
   - `KanbanColumnCreate`: add `default_agent_type: str = "quick"`.
   - `KanbanColumnUpdate`: add `default_agent_type: str | None = None`.
   - `KanbanColumnResponse`: add `default_agent_type: str`.

4. **Service layer** (`kanban_service.py`):
   - `create_card()`: accept `agent_type` parameter (default `"quick"`), pass
     it to `KanbanCard(...)`.
   - `update_card()`: accept `agent_type` parameter, set on card when not None.
   - `create_column()`: accept `default_agent_type` parameter (default
     `"quick"`), pass to `KanbanColumn(...)`.
   - `get_board()`: include `agent_type` in card dicts, include
     `default_agent_type` in column dicts.

5. **Router** (`routers/kanban.py`):
   - `create_card()`: pass `body.agent_type` to service.
   - `update_card()`: pass `body.agent_type` to service.
   - `create_column()`: pass `body.default_agent_type` to service.
   - All response serializations must include the new fields.

6. **Card routing** (`card_routing.py`):
   - `route_card_to_skill()`: check `card.agent_type` first. If it is `"quick"`
     return `"rapid:quick"`, if `"bug-fix"` return `"rapid:bug-fix"`. Only fall
     through to label-based routing if `agent_type` is missing or unrecognized
     (backwards compat).

7. **Autopilot worker** (`autopilot_worker.py`):
   - In `_find_candidates()`, include `agent_type` in the card snapshot dict.
   - In `_dispatch_card()`, pass `agent_type` through the `_CardProxy` so
     `route_card_to_skill` can read it.

### What NOT to do
- Do NOT add any enum validation at the DB level -- keep it a plain string
  field for forward-compatibility with future agent types.
- Do NOT change the `_LABEL_TO_SKILL` table -- it remains as a fallback.
- Do NOT modify any test files in this task (that is Task 3).

### Verification
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run alembic upgrade head
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.database import KanbanCard, KanbanColumn
assert hasattr(KanbanCard, 'agent_type'), 'KanbanCard.agent_type missing'
assert hasattr(KanbanColumn, 'default_agent_type'), 'KanbanColumn.default_agent_type missing'
print('OK: model fields present')
"
```

### Done criteria
- Migration applies cleanly.
- `KanbanCard` and `KanbanColumn` have the new fields with defaults.
- Board JSON includes `agent_type` on cards and `default_agent_type` on columns.
- Card routing respects `agent_type` over labels.
- All existing cards default to `"quick"`.

---

## Task 2 -- Frontend: UI for agent type selection

### Files to modify
- `web/frontend/src/types/api.ts`
- `web/frontend/src/hooks/useKanban.ts`
- `web/frontend/src/components/kanban/CreateCardModal.tsx`
- `web/frontend/src/components/kanban/CardDetailModal.tsx`
- `web/frontend/src/components/kanban/KanbanColumn.tsx`
- `web/frontend/src/components/kanban/KanbanCard.tsx`
- `web/frontend/src/components/kanban/AddColumnButton.tsx`
- `web/frontend/src/pages/KanbanBoard.tsx`

### Actions

1. **TypeScript types** (`types/api.ts`):
   - `KanbanCardResponse`: add `agent_type: string`.
   - `KanbanColumnResponse`: add `default_agent_type: string`.

2. **useKanban hook** (`hooks/useKanban.ts`):
   - `useCreateCard` mutation type: add `agent_type?: string` to the variables.
   - `useUpdateCard` mutation type: add `agent_type?: string` to the variables.
   - `useCreateColumn` mutation type: add `default_agent_type?: string` to
     the variables.

3. **CreateCardModal** (`CreateCardModal.tsx`):
   - Accept a `defaultAgentType` prop (string, default `"quick"`).
   - Add a dropdown/select labeled "Agent type" with options "Quick task" (value
     `"quick"`) and "Bug fix" (value `"bug-fix"`). Initialize from
     `defaultAgentType` prop.
   - Include `agent_type` in the `onSubmit` data payload.
   - Style the select to match the existing form (same classes as the checkbox
     section -- small, below description).

4. **CardDetailModal** (`CardDetailModal.tsx`):
   - Add the same agent type dropdown, initialized from `card.agent_type`.
   - Include `agent_type` in the save diff.

5. **KanbanColumn** (`KanbanColumn.tsx`):
   - Update `onAddCard` callback type to include `agent_type: string`.
   - Pass `column.default_agent_type` (or `"quick"` fallback) to
     `CreateCardModal` as the `defaultAgentType` prop.
   - Add a small indicator next to the autopilot bolt showing the column's
     default agent type (e.g., a text badge "Q" or "B" only when autopilot is
     enabled).

6. **KanbanCard** (`KanbanCard.tsx`):
   - Show a tiny badge on the card indicating agent type: "Q" for quick,
     "B" for bug-fix. Place it next to the `AgentStatusBadge`. Style it as a
     small muted text label.

7. **AddColumnButton** (`AddColumnButton.tsx`):
   - When creating a column, add a small dropdown for default agent type (same
     "Quick task" / "Bug fix" options).
   - Pass the selected value to `onAdd`.
   - Update the `onAdd` callback type from `(title: string)` to
     `(title: string, defaultAgentType: string)`.

8. **KanbanBoard** (`KanbanBoard.tsx`):
   - Update `handleAddColumn` to forward `defaultAgentType` to
     `createColumn.mutate(...)`.
   - Update `handleAddCard` callback type to include `agent_type`.
   - Pass `agent_type` through `createCard.mutate(...)`.
   - Pass `agent_type` through `updateCard.mutate(...)`.

### What NOT to do
- Do NOT add validation that restricts future agent types -- the select simply
  offers the two current options.
- Do NOT change drag-and-drop behavior -- `agent_type` is not involved in moves.

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit
```

### Done criteria
- TypeScript compiles with no errors.
- CreateCardModal shows an agent type dropdown defaulting to the column's
  `default_agent_type`.
- CardDetailModal shows and can edit the agent type.
- AddColumnButton includes a default agent type selector.
- KanbanCard displays a small agent type indicator.

---

## Task 3 -- Tests for agent type routing and service changes

### Files to modify
- `web/backend/tests/test_kanban_service.py`
- `web/backend/tests/test_autopilot_worker.py`

### Actions

1. **test_kanban_service.py** -- add tests:
   - `test_create_card_default_agent_type`: create card without specifying
     `agent_type`, assert it defaults to `"quick"`.
   - `test_create_card_custom_agent_type`: create card with
     `agent_type="bug-fix"`, assert it persists.
   - `test_update_card_agent_type`: update a card's `agent_type` from `"quick"`
     to `"bug-fix"`, assert the change persists.
   - `test_column_default_agent_type`: create a column, verify
     `default_agent_type` defaults to `"quick"`.
   - `test_board_includes_agent_type_fields`: call `get_board()`, verify both
     `agent_type` on cards and `default_agent_type` on columns appear in the
     returned dict.

2. **test_autopilot_worker.py** -- add or update tests:
   - `test_dispatch_routes_by_agent_type`: create a card with
     `agent_type="bug-fix"`, verify `route_card_to_skill` returns
     `"rapid:bug-fix"` (not the default `"rapid:quick"`).
   - `test_dispatch_routes_quick_by_default`: create a card with default
     `agent_type`, verify routing returns `"rapid:quick"`.

### What NOT to do
- Do NOT modify production code in this task -- only test files.
- Do NOT duplicate existing test coverage for OCC/locking.

### Verification
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_kanban_service.py tests/test_autopilot_worker.py -v --tb=short 2>&1 | tail -30
```

### Done criteria
- All new tests pass.
- Existing tests remain green.
- Coverage confirms `agent_type` routing is exercised.
