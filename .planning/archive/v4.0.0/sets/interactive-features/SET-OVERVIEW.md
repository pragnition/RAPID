# SET-OVERVIEW: interactive-features

## Approach

This set adds two interactive, project-scoped features to the RAPID web dashboard: a Kanban Board with drag-and-drop reordering and a Markdown Note Editor with autosave. Both features follow the existing architectural pattern established by prior sets -- SQLModel models in the backend, FastAPI CRUD routers, service-layer logic, and React page components consuming the `apiClient` and TanStack Query infrastructure from `frontend-shell`.

The current database already contains a `KanbanItem` model (single-table, status-based columns) and a `Note` model. The CONTRACT.json specifies a more structured two-table kanban model (`KanbanColumn` + `KanbanCard`) with explicit position-based reordering. Implementation must decide whether to migrate the existing `KanbanItem` to the column/card model or build the column/card layer on top. Given the contract's explicit exports, the recommended approach is to replace `KanbanItem` with proper `KanbanColumn` and `KanbanCard` tables via an Alembic migration, which gives drag-and-drop between columns a clean data model.

On the frontend, `dnd-kit` will be added for kanban drag-and-drop (it is React 19 compatible and actively maintained) and `@codemirror/view` + `@codemirror/lang-markdown` for the note editor. The existing `NotesPage.tsx` is a placeholder stub that will be replaced with a full editor. A new `KanbanBoard` page route needs to be added to `router.tsx`. Both features use optimistic updates on the frontend with server reconciliation to keep interactions snappy.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `web/backend/app/database.py` | KanbanColumn, KanbanCard models (replace KanbanItem) | Existing -- modify |
| `web/backend/app/models/kanban.py` | Re-export kanban models | New |
| `web/backend/app/models/note.py` | Re-export Note model | New |
| `web/backend/app/routers/kanban.py` | CRUD endpoints for columns and cards | New |
| `web/backend/app/routers/notes.py` | CRUD endpoints for notes | New |
| `web/backend/app/services/kanban_service.py` | Kanban business logic (reordering, moves) | New |
| `web/backend/app/services/note_service.py` | Note CRUD service layer | New |
| `web/backend/alembic/versions/` | Migration: drop kanbanitem, create kanbancolumn + kanbancard | New migration |
| `web/frontend/src/pages/KanbanBoard.tsx` | Kanban board page with dnd-kit | New |
| `web/frontend/src/pages/NoteEditor.tsx` | CodeMirror 6 markdown editor page | New |
| `web/frontend/src/pages/NotesPage.tsx` | Notes list page (replace placeholder) | Existing -- rewrite |
| `web/frontend/src/components/kanban/` | KanbanColumn, KanbanCard, drag overlay components | New directory |
| `web/frontend/src/components/editor/` | CodeMirror wrapper, toolbar, autosave hook | New directory |
| `web/frontend/src/router.tsx` | Add kanban route | Existing -- modify |
| `web/frontend/package.json` | Add dnd-kit, codemirror dependencies | Existing -- modify |
| `web/backend/app/sync_engine.py` | Update entity map for column/card models | Existing -- modify |

## Integration Points

- **Exports:**
  - `KanbanBoard` and `MarkdownEditor` React components (page-level, project-scoped)
  - `KanbanColumn`, `KanbanCard`, `Note` SQLModel classes
  - `/api/projects/{id}/kanban/columns` and `/api/projects/{id}/kanban/cards` CRUD endpoints
  - `/api/projects/{id}/notes` CRUD endpoints

- **Imports:**
  - `Project` model from `project-registry` (foreign key reference for project_id)
  - `get_session` from `service-infrastructure` (FastAPI dependency injection)
  - `SyncEngine` from `service-infrastructure` (write-through to `.rapid-web/`)
  - `AppLayout` from `frontend-shell` (page layout wrapper via router)
  - `useKeyboardNav` from `frontend-shell` (keyboard shortcuts on kanban/editor pages)
  - `apiClient` from `frontend-shell` (typed API calls)

- **Side Effects:**
  - Every kanban or note mutation triggers `SyncEngine.sync_to_disk()` to persist data as JSON/Markdown in `.rapid-web/`
  - Kanban data writes to `.rapid-web/kanban/` as JSON files
  - Notes write to `.rapid-web/notes/` as `.md` files (version-control-friendly)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| KanbanItem -> KanbanColumn/KanbanCard migration breaks existing data | Medium | Write Alembic migration that migrates rows; status field maps to column title, items become cards |
| dnd-kit compatibility with React 19 | Medium | Verify `@dnd-kit/core` v6+ supports React 19; fall back to `react-dnd` if not |
| CodeMirror 6 bundle size (~200KB) | Low | Use dynamic import / code splitting for editor page |
| Optimistic update rollback complexity for multi-column card moves | Medium | Keep server as source of truth; on error, refetch full board state rather than partial rollback |
| SyncEngine entity map changes conflict with other sets | Low | SyncEngine is owned by `service-infrastructure` but the entity map is append-only; coordinate via contract |
| Autosave debounce causing data loss on page navigation | Medium | Flush pending saves on `beforeunload` and route change; save indicator in UI |

## Wave Breakdown (Preliminary)

- **Wave 1:** Data model and migrations -- define `KanbanColumn`, `KanbanCard` models; write Alembic migration to replace `KanbanItem`; update `Note` model if needed; update `SyncEngine` entity map for new models
- **Wave 2:** Backend CRUD -- implement `kanban_service.py` and `note_service.py` with position reordering logic; create `kanban.py` and `notes.py` routers; wire into `main.py`
- **Wave 3:** Frontend features -- add npm dependencies (`@dnd-kit/core`, `@dnd-kit/sortable`, `@codemirror/view`, `@codemirror/lang-markdown`); build kanban components and editor components; replace `NotesPage` placeholder; add `KanbanBoard` route; implement optimistic updates and autosave

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
