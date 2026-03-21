# CONTEXT: read-only-views

**Set:** read-only-views
**Generated:** 2026-03-21
**Mode:** interactive

<domain>
## Set Boundary
Four read-only dashboard views for the RAPID Mission Control web app, each backed by a GET-only API endpoint. The views surface `.planning/` file data (STATE.json, DAG.json, REGISTRY.json) and codebase structure through the browser. This set covers: Project State View, Worktree Tracking, Knowledge Graph (Cytoscape.js), and Codebase Mapping (tree-sitter). No mutations — all endpoints are strictly GET-only. Depends on project-registry (Project model, FileWatcherService) and frontend-shell (AppLayout, useProjectStore, apiClient, useKeyboardNav).
</domain>

<decisions>
## Implementation Decisions

### Tree-sitter Strategy

- **Parse location:** Backend-only using py-tree-sitter. The Python backend handles all parsing and sends JSON structure trees to the frontend. No WASM shipped to the browser.
- **Language support:** Python, JavaScript/TypeScript, Go, and Rust grammars from the start. Four languages covering the most common RAPID project types.

### Knowledge Graph UX

- **Node coloring:** Color by set status (pending=gray, discussed=yellow, planned=blue, executing=orange, completed=green, merged=dim). Gives at-a-glance progress visibility across the DAG.
- **Layout algorithm:** Dagre directed-graph layout. Flows top-to-bottom (or left-to-right), naturally showing dependency ordering and wave structure.
- **Interactions:** Interactive zoom/pan/click-to-select per the behavioral contract. Must handle 50+ nodes and 200+ edges smoothly.

### Auto-Refresh Mechanism

- **Method:** Polling via TanStack Query `refetchInterval`. No WebSocket or SSE infrastructure needed for v4.0 read-only views.
- **Interval:** 2-second polling. Near-real-time feel with minimal overhead since all traffic is local (127.0.0.1).
- **Scope:** Per-hook refetchInterval on each view's TanStack Query hook. Views only poll when mounted/visible.

### View Navigation & Routing

- **Route structure:** Top-level sidebar routes (/state, /worktrees, /graph, /codebase). Each view uses `activeProjectId` from the Zustand store to scope data. Consistent with existing /projects route pattern.
- **Placeholder handling:** Replace existing GraphPage placeholder with the full KnowledgeGraph implementation. Keep NotesPage as-is since it maps to the interactive-features set (Set 5).
- **Sidebar nav:** Add four new NAV_ITEMS entries with keyboard shortcuts (gs=state, gw=worktrees, gg=graph, gc=codebase).
</decisions>

<specifics>
## Specific Ideas
- Use the existing `parse_state_json` pattern in project_service.py as a template for the new service modules
- Follow the existing router + service separation from projects.py/project_service.py
- TanStack Query hooks should follow the useProjects/useProjectDetail naming pattern (e.g., useStateView, useWorktrees, useDagGraph, useCodebaseMap)
- Graph page already exists at /graph route — KnowledgeGraph replaces it in-place, no route change needed
- For the codebase endpoint, consider caching parsed tree-sitter output since parsing is expensive and source files change infrequently
</specifics>

<code_context>
## Existing Code Insights

**Backend patterns:**
- FastAPI routers in `web/backend/app/routers/` with service layer in `web/backend/app/services/`
- Schemas in `web/backend/app/schemas/` for request/response models
- Routers registered in `main.py` via `app.include_router()`
- Project model provides `path` field for resolving filesystem locations
- `project_service.parse_state_json()` already reads STATE.json — can be extended or reused

**Frontend patterns:**
- Pages in `web/frontend/src/pages/` as React functional components
- TanStack Query hooks in `web/frontend/src/hooks/` (useProjects pattern)
- `apiClient` in `web/frontend/src/lib/apiClient.ts` with `.get()`, `.post()`, `.delete()` helpers
- `useProjectStore` Zustand store for active project context
- Router in `web/frontend/src/router.tsx` with AppLayout wrapper
- NAV_ITEMS in `web/frontend/src/types/layout.ts` for sidebar entries
- Keyboard bindings registered in AppLayout.tsx

**Existing placeholders to replace:**
- `GraphPage.tsx` — stub that becomes KnowledgeGraph
- `/graph` route already exists in router.tsx

**FileWatcherService:**
- Already monitors `.planning/` for STATE.json changes
- Can be leveraged for future SSE/WebSocket upgrades but not needed now (polling approach)
</code_context>

<deferred>
## Deferred Ideas
- WebSocket/SSE push for real-time updates (future enhancement beyond v4.0 polling)
- Additional tree-sitter language grammars beyond the initial four
- Graph filtering/search within the KnowledgeGraph view
- Codebase diff view showing changes between commits
</deferred>
