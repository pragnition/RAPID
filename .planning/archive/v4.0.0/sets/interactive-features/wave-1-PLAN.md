# PLAN: interactive-features / Wave 1 — Data Models, Migration, and API Infrastructure

## Objective

Establish the data layer for both kanban and notes features: define new SQLModel tables (`KanbanColumn`, `KanbanCard`), write the Alembic migration to replace the old `KanbanItem` table, create Pydantic schemas, implement backend service layers with CRUD + position reordering, create FastAPI routers, wire them into `main.py`, update `SyncEngine` for the new column/card model, and extend `apiClient` with `.put()` and `.patch()` methods. This wave delivers the complete backend API and makes the frontend ready to consume it.

## File Ownership

| File | Action |
|------|--------|
| `web/backend/app/database.py` | Modify: replace `KanbanItem` with `KanbanColumn` + `KanbanCard`, keep `Note` as-is |
| `web/backend/app/models/kanban.py` | Create: re-export `KanbanColumn`, `KanbanCard` |
| `web/backend/app/models/note.py` | Create: re-export `Note` |
| `web/backend/alembic/versions/0003_kanban_column_card.py` | Create: migration dropping `kanbanitem`, creating `kanbancolumn` + `kanbancard` |
| `web/backend/app/schemas/kanban.py` | Create: Pydantic request/response schemas for kanban endpoints |
| `web/backend/app/schemas/notes.py` | Create: Pydantic request/response schemas for notes endpoints |
| `web/backend/app/services/kanban_service.py` | Create: kanban CRUD with position reordering logic |
| `web/backend/app/services/note_service.py` | Create: notes CRUD service layer |
| `web/backend/app/routers/kanban.py` | Create: CRUD endpoints for columns + cards |
| `web/backend/app/routers/notes.py` | Create: CRUD endpoints for notes |
| `web/backend/app/main.py` | Modify: include kanban_router and notes_router |
| `web/backend/app/sync_engine.py` | Modify: update `_ENTITY_MAP` for `KanbanColumn`/`KanbanCard`, add `PRAGMA foreign_keys=ON`, add board.json composite sync |
| `web/frontend/src/lib/apiClient.ts` | Modify: add `apiClient.put()` and `apiClient.patch()` methods |
| `web/frontend/src/types/api.ts` | Modify: add TypeScript types for kanban and notes API responses |

---

## Task 1: Replace KanbanItem model with KanbanColumn + KanbanCard in database.py

### What
Remove the `KanbanItem` class from `web/backend/app/database.py`. Add two new SQLModel classes:

**KanbanColumn:**
- `id: UUID` (primary key, default uuid4)
- `project_id: UUID` (foreign key to `project.id`)
- `title: str`
- `position: int` (default 0)
- `created_at: datetime` (default utcnow)
- `__tablename__ = "kanbancolumn"`

**KanbanCard:**
- `id: UUID` (primary key, default uuid4)
- `column_id: UUID` (foreign key to `kanbancolumn.id`)
- `title: str`
- `description: str` (default "")
- `position: int` (default 0)
- `created_at: datetime` (default utcnow)
- `updated_at: datetime` (default utcnow)
- `__tablename__ = "kanbancard"`

Keep the existing `Note` model unchanged -- it already has the correct schema.

### Where
`web/backend/app/database.py` -- replace lines 53-63 (the `KanbanItem` class) with `KanbanColumn` and `KanbanCard`.

### Verification
```bash
cd /home/kek/Projects/RAPID/web/backend && python -c "from app.database import KanbanColumn, KanbanCard, Note; print('OK:', KanbanColumn.__tablename__, KanbanCard.__tablename__)"
```

---

## Task 2: Create Alembic migration 0003 for kanban table replacement

### What
Create `web/backend/alembic/versions/0003_kanban_column_card.py` that:

1. Drops the `kanbanitem` table using `op.drop_table("kanbanitem")`
2. Creates `kanbancolumn` table with columns: `id` (Uuid, PK), `project_id` (Uuid, FK to project.id), `title` (String, not null), `position` (Integer, not null), `created_at` (DateTime, not null)
3. Creates `kanbancard` table with columns: `id` (Uuid, PK), `column_id` (Uuid, FK to kanbancolumn.id), `title` (String, not null), `description` (String, not null, default ""), `position` (Integer, not null), `created_at` (DateTime, not null), `updated_at` (DateTime, not null)
4. Add an index on `kanbancolumn.project_id` for efficient board loading
5. Add an index on `kanbancard.column_id` for efficient column loading

Follow the existing naming convention from the project: `op.f("pk_kanbancolumn")`, `op.f("fk_kanbancolumn_project_id_project")`, etc.

Set `revision = "0003"`, `down_revision = "0002"`.

The downgrade should drop `kanbancard`, then `kanbancolumn`, then recreate the old `kanbanitem` table (matching schema from 0001 migration).

### Where
New file: `web/backend/alembic/versions/0003_kanban_column_card.py`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/backend && python -c "
from app.database import get_engine, run_migrations, SQLModel
from pathlib import Path
import tempfile, os
with tempfile.TemporaryDirectory() as td:
    db_path = Path(td) / 'test.db'
    engine = get_engine(db_path)
    run_migrations(engine)
    from sqlalchemy import inspect
    tables = inspect(engine).get_table_names()
    assert 'kanbancolumn' in tables, f'kanbancolumn not in {tables}'
    assert 'kanbancard' in tables, f'kanbancard not in {tables}'
    assert 'kanbanitem' not in tables, f'kanbanitem still in {tables}'
    print('Migration OK:', sorted(tables))
"
```

---

## Task 3: Create model re-export files

### What
Create two files following the pattern established by `web/backend/app/models/project.py`:

**`web/backend/app/models/kanban.py`:**
```
"""Re-export Kanban models from database for conventional import path."""
from app.database import KanbanColumn, KanbanCard
__all__ = ["KanbanColumn", "KanbanCard"]
```

**`web/backend/app/models/note.py`:**
```
"""Re-export Note model from database for conventional import path."""
from app.database import Note
__all__ = ["Note"]
```

### Where
New files: `web/backend/app/models/kanban.py`, `web/backend/app/models/note.py`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/backend && python -c "from app.models.kanban import KanbanColumn, KanbanCard; from app.models.note import Note; print('OK')"
```

---

## Task 4: Create Pydantic schemas for kanban and notes

### What

**`web/backend/app/schemas/kanban.py`:**

Follow the pattern from `web/backend/app/schemas/project.py`. Define:

- `KanbanColumnCreate(BaseModel)`: `title: str`
- `KanbanColumnUpdate(BaseModel)`: `title: str | None = None`, `position: int | None = None`
- `KanbanCardCreate(BaseModel)`: `title: str`, `description: str = ""`
- `KanbanCardUpdate(BaseModel)`: `title: str | None = None`, `description: str | None = None`, `column_id: str | None = None`, `position: int | None = None`
- `KanbanCardMove(BaseModel)`: `column_id: str`, `position: int` -- for drag-and-drop move
- `KanbanColumnResponse(BaseModel)`: `id: str`, `project_id: str`, `title: str`, `position: int`, `created_at: str`, `cards: list[KanbanCardResponse]` -- use `model_config = ConfigDict(from_attributes=True)`
- `KanbanCardResponse(BaseModel)`: `id: str`, `column_id: str`, `title: str`, `description: str`, `position: int`, `created_at: str`, `updated_at: str` -- use `model_config = ConfigDict(from_attributes=True)`
- `KanbanBoardResponse(BaseModel)`: `project_id: str`, `columns: list[KanbanColumnResponse]`

**`web/backend/app/schemas/notes.py`:**

- `NoteCreate(BaseModel)`: `title: str`, `content: str = ""`
- `NoteUpdate(BaseModel)`: `title: str | None = None`, `content: str | None = None`
- `NoteResponse(BaseModel)`: `id: str`, `project_id: str`, `title: str`, `content: str`, `created_at: str`, `updated_at: str` -- use `model_config = ConfigDict(from_attributes=True)`
- `NoteListResponse(BaseModel)`: `items: list[NoteResponse]`, `total: int`

### Where
New files: `web/backend/app/schemas/kanban.py`, `web/backend/app/schemas/notes.py`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/backend && python -c "
from app.schemas.kanban import KanbanColumnCreate, KanbanCardCreate, KanbanBoardResponse, KanbanCardMove
from app.schemas.notes import NoteCreate, NoteUpdate, NoteResponse, NoteListResponse
print('Schemas OK')
"
```

---

## Task 5: Implement kanban_service.py

### What
Create `web/backend/app/services/kanban_service.py` with these functions:

- `get_board(session: Session, project_id: UUID) -> dict`: Load all columns for a project (ordered by position), and for each column load its cards (ordered by position). Return structured dict matching `KanbanBoardResponse`.
- `create_column(session: Session, project_id: UUID, title: str) -> KanbanColumn`: Create a new column with position = max existing position + 1. On the first column creation for a project, seed default columns (Backlog, In Progress, Done) instead of just the requested one.
- `update_column(session: Session, column_id: UUID, title: str | None, position: int | None) -> KanbanColumn`: Update column title and/or reorder (shift other columns' positions accordingly).
- `delete_column(session: Session, column_id: UUID) -> None`: Delete column and all its cards. Reorder remaining columns' positions to be contiguous.
- `create_card(session: Session, column_id: UUID, title: str, description: str) -> KanbanCard`: Create card at the bottom of the column (position = max + 1).
- `update_card(session: Session, card_id: UUID, title: str | None, description: str | None) -> KanbanCard`: Update card fields.
- `move_card(session: Session, card_id: UUID, target_column_id: UUID, target_position: int) -> KanbanCard`: Move card to a different column and/or position. Update positions of cards in the source column (remove gap) and target column (make room).
- `delete_card(session: Session, card_id: UUID) -> None`: Delete card, reorder remaining cards in the column.

Use `select().where().order_by()` pattern matching existing `project_service.py`. Use `session.add()`, `session.commit()`, `session.refresh()`.

Important: Every mutating function must also call `_sync_board(session, project_id)` at the end, which composes the full board state and writes it to `.rapid-web/kanban/board.json` via `SyncEngine`. To get the project path, query the `Project` table using the `project_id` (which you can derive from the column's `project_id` or from the card's column's `project_id`).

### Where
New file: `web/backend/app/services/kanban_service.py`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/backend && python -c "
from app.services.kanban_service import get_board, create_column, create_card, move_card, update_card, delete_card, update_column, delete_column
print('kanban_service imports OK')
"
```

---

## Task 6: Implement note_service.py

### What
Create `web/backend/app/services/note_service.py` with these functions:

- `list_notes(session: Session, project_id: UUID) -> tuple[list[Note], int]`: List all notes for a project ordered by `updated_at` descending. Return (items, total_count).
- `get_note(session: Session, note_id: UUID) -> Note | None`: Get a single note by ID.
- `create_note(session: Session, project_id: UUID, title: str, content: str) -> Note`: Create a new note.
- `update_note(session: Session, note_id: UUID, title: str | None, content: str | None) -> Note | None`: Update note fields. Set `updated_at` to utcnow. Return None if not found.
- `delete_note(session: Session, note_id: UUID) -> bool`: Delete a note. Return True if deleted, False if not found.

Each mutating function must call `_sync_note(session, note, project_id)` or `_delete_note_sync(session, note_id, project_id)` to write/remove `.rapid-web/notes/{slug}.md` files. Note slugs should be derived from the note title: lowercase, replace spaces with hyphens, strip non-alphanumeric (except hyphens), truncate to 50 chars. The `.md` file should have YAML frontmatter:
```
---
title: Note Title
id: <uuid>
created_at: <iso datetime>
updated_at: <iso datetime>
---
<content>
```

To get the project path for SyncEngine, query the `Project` table via `project_id`.

### Where
New file: `web/backend/app/services/note_service.py`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/backend && python -c "
from app.services.note_service import list_notes, get_note, create_note, update_note, delete_note
print('note_service imports OK')
"
```

---

## Task 7: Create kanban router

### What
Create `web/backend/app/routers/kanban.py` with `router = APIRouter(prefix="/api/projects", tags=["kanban"])`.

Follow the pattern from `routers/projects.py`: define a local `get_db` dependency, use `Depends(get_db)` for session injection.

Endpoints:
- `GET /{project_id}/kanban` -> `KanbanBoardResponse`: Return the full board (columns with nested cards).
- `POST /{project_id}/kanban/columns` -> `KanbanColumnResponse`: Create a column (body: `KanbanColumnCreate`). Status 201.
- `PUT /{project_id}/kanban/columns/{column_id}` -> `KanbanColumnResponse`: Update column (body: `KanbanColumnUpdate`).
- `DELETE /{project_id}/kanban/columns/{column_id}` -> status 204.
- `POST /{project_id}/kanban/columns/{column_id}/cards` -> `KanbanCardResponse`: Create card (body: `KanbanCardCreate`). Status 201.
- `PUT /{project_id}/kanban/cards/{card_id}` -> `KanbanCardResponse`: Update card (body: `KanbanCardUpdate`).
- `PUT /{project_id}/kanban/cards/{card_id}/move` -> `KanbanCardResponse`: Move card (body: `KanbanCardMove`).
- `DELETE /{project_id}/kanban/cards/{card_id}` -> status 204.

Each endpoint should validate that the project exists (raise 404 if not), then delegate to `kanban_service`. For 404s on columns/cards, catch and raise `HTTPException(404)`.

### Where
New file: `web/backend/app/routers/kanban.py`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/backend && python -c "from app.routers.kanban import router; print('Routes:', [r.path for r in router.routes])"
```

---

## Task 8: Create notes router

### What
Create `web/backend/app/routers/notes.py` with `router = APIRouter(prefix="/api/projects", tags=["notes"])`.

Endpoints:
- `GET /{project_id}/notes` -> `NoteListResponse`: List all notes for a project.
- `GET /{project_id}/notes/{note_id}` -> `NoteResponse`: Get single note.
- `POST /{project_id}/notes` -> `NoteResponse`: Create note (body: `NoteCreate`). Status 201.
- `PUT /{project_id}/notes/{note_id}` -> `NoteResponse`: Update note (body: `NoteUpdate`).
- `DELETE /{project_id}/notes/{note_id}` -> status 204.

Same pattern: local `get_db`, validate project exists, delegate to `note_service`.

### Where
New file: `web/backend/app/routers/notes.py`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/backend && python -c "from app.routers.notes import router; print('Routes:', [r.path for r in router.routes])"
```

---

## Task 9: Wire routers into main.py and update SyncEngine

### What

**main.py changes:**
1. Add imports at top: `from app.routers.kanban import router as kanban_router` and `from app.routers.notes import router as notes_router`
2. Add `app.include_router(kanban_router)` and `app.include_router(notes_router)` after the existing `app.include_router(views_router)` line.

**sync_engine.py changes:**
1. Update the import line to import `KanbanColumn, KanbanCard` instead of `KanbanItem`
2. Update `_ENTITY_MAP` to:
   ```python
   _ENTITY_MAP: dict[str, tuple[str, type]] = {
       "project": ("projects", Project),
       "note": ("notes", Note),
       "kanban_column": ("kanban", KanbanColumn),
       "kanban_card": ("kanban", KanbanCard),
   }
   ```
3. Add `PRAGMA foreign_keys=ON` in `database.py`'s `_set_sqlite_pragmas` function (add `cursor.execute("PRAGMA foreign_keys=ON")` after the busy_timeout line).

### Where
- `web/backend/app/main.py` (modify)
- `web/backend/app/sync_engine.py` (modify)
- `web/backend/app/database.py` (modify `_set_sqlite_pragmas`)

### Verification
```bash
cd /home/kek/Projects/RAPID/web/backend && python -c "
from app.main import app
routes = [r.path for r in app.routes if hasattr(r, 'path')]
kanban_routes = [r for r in routes if 'kanban' in r]
notes_routes = [r for r in routes if 'notes' in r]
print('Kanban routes:', kanban_routes)
print('Notes routes:', notes_routes)
assert len(kanban_routes) > 0, 'No kanban routes found'
assert len(notes_routes) > 0, 'No notes routes found'
print('Router wiring OK')
"
```

---

## Task 10: Extend apiClient with PUT and PATCH methods, add frontend types

### What

**apiClient.ts changes:**
Add `apiPut` and `apiPatch` functions following the existing `apiPost` / `apiDelete` pattern:

```typescript
function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiClient<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiClient<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

apiClient.put = apiPut;
apiClient.patch = apiPatch;
```

**api.ts changes:**
Add TypeScript interfaces at the bottom of the file:

```typescript
// Kanban types
export interface KanbanCardResponse {
  id: string;
  column_id: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface KanbanColumnResponse {
  id: string;
  project_id: string;
  title: string;
  position: number;
  created_at: string;
  cards: KanbanCardResponse[];
}

export interface KanbanBoardResponse {
  project_id: string;
  columns: KanbanColumnResponse[];
}

// Note types
export interface NoteResponse {
  id: string;
  project_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface NoteListResponse {
  items: NoteResponse[];
  total: number;
}
```

### Where
- `web/frontend/src/lib/apiClient.ts` (modify)
- `web/frontend/src/types/api.ts` (modify)

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Success Criteria

1. `KanbanColumn` and `KanbanCard` models importable from `app.database`
2. Alembic migration 0003 runs cleanly: creates `kanbancolumn` + `kanbancard`, drops `kanbanitem`
3. All CRUD endpoints registered in FastAPI app for both kanban and notes
4. `kanban_service` supports full CRUD including position-based reordering and cross-column card moves
5. `note_service` supports full CRUD with `.rapid-web/notes/*.md` sync
6. `apiClient.put()` and `apiClient.patch()` available in frontend
7. TypeScript types for kanban and notes API responses compile without errors
8. `PRAGMA foreign_keys=ON` set in SQLite connection pragmas

## What NOT To Do

- Do NOT modify `NotesPage.tsx`, `KanbanBoard.tsx`, or any frontend page components -- those are Wave 2 and Wave 3
- Do NOT add npm dependencies (dnd-kit, codemirror) -- that is Wave 2
- Do NOT create frontend components in `components/kanban/` or `components/editor/` -- that is Wave 2 and Wave 3
- Do NOT modify `router.tsx` or `layout.ts` (NAV_ITEMS) -- that is Wave 2
- Do NOT add the kanban/notes keyboard nav shortcuts to AppLayout -- that is Wave 2
- Do NOT use SQLAlchemy `relationship()` -- use explicit `select().where()` queries instead
- Do NOT write `note.content` into the JSON sync for notes -- write as `.md` files with YAML frontmatter
