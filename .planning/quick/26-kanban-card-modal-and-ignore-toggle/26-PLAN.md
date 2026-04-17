# Quick Task 26: Kanban Card Creation Modal + Autopilot Ignore Toggle

## Objective

Two improvements to the kanban board UX:

1. **Card creation modal**: When a user clicks "+ Add card", instead of an inline text input that only captures a title, pop up a modal dialog that lets the user specify both the card **title** and **description** before creating the card.

2. **Autopilot-ignore toggle on cards**: Add a per-card boolean flag (`autopilot_ignore`) that, when set to `true`, tells the autopilot sweeper to skip this card even if it lives in an autopilot-enabled column. Expose the toggle in the card detail modal and on the card chip itself (small visual indicator).

---

## Task 1: Backend -- add `autopilot_ignore` field to KanbanCard

### Files to modify

| File | Action |
|------|--------|
| `web/backend/app/database.py` | Add `autopilot_ignore: bool = Field(default=False)` to `KanbanCard` |
| `web/backend/alembic/versions/0009_card_autopilot_ignore.py` | New migration adding the column |
| `web/backend/app/schemas/kanban.py` | Add `autopilot_ignore: bool` to `KanbanCardCreate`, `KanbanCardUpdate`, and `KanbanCardResponse` |
| `web/backend/app/services/kanban_service.py` | Pass `autopilot_ignore` through in `create_card()`, include it in `get_board()` serialization, and handle it in `update_card()` |
| `web/backend/app/routers/kanban.py` | Pass `autopilot_ignore` from request bodies to service calls; include in all `KanbanCardResponse` constructions |
| `web/backend/app/agents/autopilot_worker.py` | In `_find_candidates()`, add `.where(KanbanCard.autopilot_ignore == False)` to the card query so ignored cards are never dispatched |
| `web/frontend/src/types/api.ts` | Add `autopilot_ignore: boolean` to `KanbanCardResponse` |
| `web/backend/tests/test_kanban_service.py` | Add test: create card with `autopilot_ignore=True`, verify it persists and round-trips through `get_board()` |
| `web/backend/tests/test_autopilot_worker.py` | Add test: card with `autopilot_ignore=True` in an autopilot column is NOT returned by `_find_candidates()` |

### Implementation details

**database.py** -- Add this field to `KanbanCard`, after `retry_count`:
```
autopilot_ignore: bool = Field(default=False)
```

**Migration** -- Create `web/backend/alembic/versions/0009_card_autopilot_ignore.py`. Use the same pattern as prior migrations (e.g., `0006_kanban_v2_autopilot.py`). The migration should:
- `op.add_column("kanbancard", sa.Column("autopilot_ignore", sa.Boolean(), nullable=False, server_default=sa.text("0")))`
- Downgrade: `op.drop_column("kanbancard", "autopilot_ignore")`
- Revision ID: `"0009"`, down_revision: `"0008"`

**schemas/kanban.py**:
- `KanbanCardCreate`: add `autopilot_ignore: bool = False`
- `KanbanCardUpdate`: add `autopilot_ignore: bool | None = None`
- `KanbanCardResponse`: add `autopilot_ignore: bool`

**services/kanban_service.py**:
- `create_card()`: accept `autopilot_ignore: bool = False` parameter, set it on the new `KanbanCard` instance.
- `get_board()`: include `"autopilot_ignore": card.autopilot_ignore` in the card dict serialization.
- `update_card()`: accept `autopilot_ignore: bool | None = None`, apply it if not None.

**routers/kanban.py**:
- `create_card()`: pass `body.autopilot_ignore` to `kanban_service.create_card()`. Include `autopilot_ignore=card.autopilot_ignore` in the `KanbanCardResponse` construction.
- `update_card()`: pass `body.autopilot_ignore` to `kanban_service.update_card()`. Include `autopilot_ignore=card.autopilot_ignore` in the response.
- `move_card()`: include `autopilot_ignore=card.autopilot_ignore` in the response.
- `update_column()` card loop: include `autopilot_ignore=c.autopilot_ignore` in each card's response.

**autopilot_worker.py** -- In `_find_candidates()`, the card query currently has:
```python
.where(KanbanCard.agent_status == "idle")
.where(KanbanCard.locked_by_run_id.is_(None))
.where(KanbanCard.retry_count < _MAX_RETRY_COUNT)
```
Add:
```python
.where(KanbanCard.autopilot_ignore == False)  # noqa: E712
```

**frontend types** -- In `web/frontend/src/types/api.ts`, add to `KanbanCardResponse`:
```typescript
autopilot_ignore: boolean;
```

### Verification

```bash
cd /home/kek/Projects/RAPID/web/backend && uv run alembic upgrade head
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_kanban_service.py -x -v
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_autopilot_worker.py -x -v
```

### Done criteria
- `autopilot_ignore` column exists in DB after migration
- Cards default to `autopilot_ignore=False`
- Cards with `autopilot_ignore=True` are skipped by the autopilot worker's `_find_candidates()`
- API responses include `autopilot_ignore` field
- Both new tests pass

---

## Task 2: Frontend -- card creation modal and autopilot-ignore UI

### Files to modify

| File | Action |
|------|--------|
| `web/frontend/src/components/kanban/KanbanColumn.tsx` | Replace inline "add card" text input with a button that opens a new `CreateCardModal` |
| `web/frontend/src/components/kanban/CreateCardModal.tsx` | **New file** -- Modal with title input, description textarea, and autopilot-ignore checkbox; calls `onSubmit` with `{ title, description, autopilot_ignore }` |
| `web/frontend/src/components/kanban/CardDetailModal.tsx` | Add autopilot-ignore toggle checkbox to the existing edit modal |
| `web/frontend/src/components/kanban/KanbanCard.tsx` | Show a small visual indicator when `card.autopilot_ignore` is `true` (a shield/block icon or similar text symbol next to the agent status badge) |
| `web/frontend/src/pages/KanbanBoard.tsx` | Update `handleAddCard` callback signature to accept `{ title, description, autopilot_ignore }` instead of just `title`; pass `description` and `autopilot_ignore` to `createCard.mutate()` |
| `web/frontend/src/hooks/useKanban.ts` | Update `useCreateCard` mutation type to include `description` and `autopilot_ignore` in the mutation variables; update `useUpdateCard` to include `autopilot_ignore` |

### Implementation details

**CreateCardModal.tsx** (new file):
- Props: `onSubmit: (data: { title: string; description: string; autopilot_ignore: boolean }) => void`, `onClose: () => void`
- State: `title` (string), `description` (string), `autopilotIgnore` (boolean, default false)
- Layout: Same modal styling as `CardDetailModal` -- overlay with centered card, title input at top, description textarea, a labeled checkbox for "Ignore autopilot" with helper text "Autopilot agents will skip this card", and Save/Cancel buttons
- Keyboard: Ctrl+Enter to submit, Escape to close
- Validation: title must be non-empty to submit

**KanbanColumn.tsx** changes:
- Remove `addingCard`, `newCardTitle` state and the inline input/button JSX in the "Add card" section
- Change `onAddCard` prop signature from `(columnId: string, title: string) => void` to `(columnId: string, data: { title: string; description: string; autopilot_ignore: boolean }) => void`
- Add state: `showCreateModal: boolean` (default false)
- The "+ Add card" button sets `showCreateModal = true`
- Render `<CreateCardModal>` when `showCreateModal` is true, passing `onSubmit` that calls `onAddCard(column.id, data)` and closes the modal
- Import the new `CreateCardModal` component

**KanbanBoard.tsx** changes:
- `handleAddCard` callback: change from `(columnId: string, title: string)` to `(columnId: string, data: { title: string; description: string; autopilot_ignore: boolean })`
- Inside it, call `createCard.mutate({ columnId, title: data.title, description: data.description, autopilot_ignore: data.autopilot_ignore })`

**useKanban.ts** changes:
- `useCreateCard` mutation variables type: add `autopilot_ignore?: boolean` alongside existing `description?: string`
- `useUpdateCard` mutation variables type: add `autopilot_ignore?: boolean`
- Both mutationFn bodies already spread `...body` which will include the new fields automatically

**CardDetailModal.tsx** changes:
- Add state: `autopilotIgnore` initialized from `card.autopilot_ignore`
- Add a checkbox below the description textarea:
  ```
  <label className="flex items-center gap-2 mt-3">
    <input type="checkbox" checked={autopilotIgnore} onChange={...} className="..." />
    <span className="text-sm text-fg">Ignore autopilot</span>
  </label>
  <p className="text-xs text-muted ml-6">Autopilot agents will skip this card</p>
  ```
- In `handleSave`, include `autopilot_ignore` in the updates object if it differs from `card.autopilot_ignore`
- Update the `onSave` prop type to include `autopilot_ignore?: boolean` in the updates object

**KanbanCard.tsx** changes:
- When `card.autopilot_ignore` is true, show a small indicator. Add a span with a no-entry-like text symbol (e.g., the Unicode character `\u2298` or the text "AP OFF") next to the `AgentStatusBadge`, styled with `text-xs text-muted` and a tooltip title "Autopilot ignored"

### Verification

```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit
```

Manually verify in browser:
1. Click "+ Add card" -- a modal pops up with title, description, and autopilot-ignore checkbox
2. Fill in all fields, submit -- card appears with description and the ignore indicator if checked
3. Click an existing card to edit -- the autopilot-ignore checkbox appears and can be toggled
4. Cards with autopilot_ignore show a visual indicator on the board

### Done criteria
- Clicking "+ Add card" opens a modal (not inline input)
- Modal has title, description, and autopilot-ignore checkbox
- Card creation sends title + description + autopilot_ignore to the API
- Existing CardDetailModal shows and saves autopilot-ignore toggle
- Cards with `autopilot_ignore=true` show a visual indicator
- TypeScript compilation passes with no errors

---

## Task 3: Unit tests for autopilot-ignore filtering

### Files to modify

| File | Action |
|------|--------|
| `web/backend/tests/test_kanban_service.py` | Add tests for `autopilot_ignore` field persistence and board serialization |
| `web/backend/tests/test_autopilot_worker.py` | Add test verifying `_find_candidates()` skips cards with `autopilot_ignore=True` |

### Implementation details

**test_kanban_service.py** -- Add these tests:

```python
def test_create_card_autopilot_ignore(session, column):
    """Card created with autopilot_ignore=True persists the flag."""
    card = create_card(session, column.id, "Ignored task", autopilot_ignore=True)
    assert card.autopilot_ignore is True

    # Verify it round-trips through get_board
    board = get_board(session, column.project_id)
    card_data = board["columns"][0]["cards"][0]
    assert card_data["autopilot_ignore"] is True


def test_create_card_autopilot_ignore_defaults_false(session, column):
    """Cards default to autopilot_ignore=False."""
    card = create_card(session, column.id, "Normal task")
    assert card.autopilot_ignore is False
```

**test_autopilot_worker.py** -- Add this test:

```python
def test_find_candidates_skips_ignored_cards(engine, tables, session, autopilot_column, mock_session_manager):
    """Cards with autopilot_ignore=True are not returned as candidates."""
    # Create a normal card and an ignored card in the autopilot column
    normal_card = KanbanCard(
        column_id=autopilot_column.id,
        title="Normal",
        position=0,
        agent_status="idle",
        autopilot_ignore=False,
    )
    ignored_card = KanbanCard(
        column_id=autopilot_column.id,
        title="Ignored",
        position=1,
        agent_status="idle",
        autopilot_ignore=True,
    )
    session.add_all([normal_card, ignored_card])
    session.commit()

    worker = AutopilotWorker(engine, mock_session_manager, interval_s=999)
    candidates = worker._find_candidates()

    card_ids = [c[1] for c in candidates]
    assert normal_card.id in card_ids
    assert ignored_card.id not in card_ids
```

### Verification

```bash
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_kanban_service.py::test_create_card_autopilot_ignore -x -v
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_kanban_service.py::test_create_card_autopilot_ignore_defaults_false -x -v
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_autopilot_worker.py::test_find_candidates_skips_ignored_cards -x -v
```

### Done criteria
- All three new tests pass
- No existing tests are broken
- `uv run pytest tests/test_kanban_service.py tests/test_autopilot_worker.py -x -v` passes clean
