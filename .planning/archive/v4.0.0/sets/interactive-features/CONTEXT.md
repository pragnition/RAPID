# CONTEXT: interactive-features

**Set:** interactive-features
**Generated:** 2026-03-21
**Mode:** interactive

<domain>
## Set Boundary
Two interactive, project-scoped features for the RAPID web dashboard: a Kanban Board with drag-and-drop reordering and a Markdown Note Editor with autosave. Both features add SQLModel tables, FastAPI CRUD endpoints, React page components, and .rapid-web/ sync. Depends on project-registry (Project model), frontend-shell (AppLayout, apiClient, useKeyboardNav), and service-infrastructure (get_session, SyncEngine).
</domain>

<decisions>
## Implementation Decisions

### Data Model Migration

- **Alembic migration:** Write an Alembic migration that drops the existing `KanbanItem` table and creates separate `KanbanColumn` + `KanbanCard` tables. Map existing data: status field → column title, items → cards.
- **User-creatable columns:** Users can add, rename, reorder, and delete columns. Default columns (Backlog, In Progress, Done) seeded on first board creation for a project.
- **Integer positions:** Use a simple integer `position` field for both columns and cards. Reorder by updating positions of affected items.

### Kanban Board UX

- **Refetch on error:** When a drag-and-drop server request fails, refetch the entire board state from the server. Simple, always consistent.
- **Card detail:** Cards show title and a truncated description (2-3 lines). Click to expand/edit inline or in a modal.
- **Add column:** A '+' button after the last column. Clicking adds a new column with an inline editable title.

### Note Editor Scope

- **Vim mode toggleable:** CodeMirror 6 vim keybindings available via a toggle in the editor toolbar. Off by default. Matches the project's vim-style keyboard nav philosophy.
- **Split pane layout:** Notes list on the left (narrow), editor on the right. Selecting a note loads it in the editor. Similar to VS Code explorer.
- **Minimal toolbar:** Bold, italic, heading, link, code block, and a save indicator. Power users use markdown shortcuts directly.

### Sync Format

- **Single board.json:** One `.rapid-web/kanban/board.json` per project containing columns and cards. Atomic reads/writes, easy to version control.
- **Plain .md files:** Each note as `.rapid-web/notes/{slug}.md` with YAML frontmatter for title and timestamps. Human-readable, git-friendly.
- **Sync on every mutation:** Every CRUD operation triggers immediate `sync_to_disk()`. Matches the CONTRACT.json behavioral spec.
</decisions>

<specifics>
## Specific Ideas
- Default kanban columns seeded on first board creation: Backlog, In Progress, Done
- CodeMirror 6 with `@codemirror/lang-markdown` for syntax highlighting
- dnd-kit (`@dnd-kit/core` + `@dnd-kit/sortable`) for drag-and-drop
- Optimistic updates for drag-drop with full board refetch as rollback
- Debounced autosave (2s inactivity) for note editor with flush on navigation/beforeunload
- Note slugs derived from title for .rapid-web/ filenames
</specifics>

<code_context>
## Existing Code Insights

- **Models in database.py:** Existing `KanbanItem` (single-table, status-based) and `Note` models need to be replaced/restructured via Alembic migration
- **SyncEngine** (`sync_engine.py`): Already maps "kanban" → kanban/ and "note" → notes/ entities. Needs updating for column/card model structure
- **NotesPage.tsx:** Placeholder stub showing "Notes and documentation will appear here" — full rewrite needed
- **No kanban page/route:** KanbanBoard.tsx and /kanban route need to be created from scratch
- **Router pattern:** `router.tsx` uses React Router 7 with lazy-loaded pages inside AppLayout
- **API pattern:** Service layer (`*_service.py`) → Router (`routers/*.py`) → Pydantic schemas (`schemas/*.py`). FastAPI Depends for session injection.
- **Frontend pattern:** TanStack Query for server state, Zustand for client state, `apiClient` for typed fetches, Tailwind with Everforest CSS variables
- **Dependencies needed:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`, `@codemirror/vim` (optional toggle)
</code_context>

<deferred>
## Deferred Ideas
- Card labels/tags/colors (future enhancement beyond basic CRUD)
- Note folder organization (flat list for now)
- Markdown preview pane (editor-only for v1, preview via toolbar toggle could come later)
- Board filtering/search
- Card due dates and assignments
</deferred>
