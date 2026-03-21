# SET-OVERVIEW: read-only-views

## Approach

This set adds four read-only dashboard views to the RAPID Mission Control web application, each backed by a dedicated GET-only API endpoint. The core problem is surfacing `.planning/` file data (STATE.json, DAG.json, REGISTRY.json) and codebase structure through the browser, giving users at-a-glance visibility into project state, worktrees, dependency graphs, and code layout without touching the CLI.

The backend follows the existing FastAPI router + service pattern established by `project-registry`: each view gets a router module (defining the GET endpoint) and a service module (encapsulating file parsing logic). All four endpoints are scoped under `/api/projects/{id}/...` and read directly from disk via the project's filesystem path stored in the `Project` model -- no new database tables are needed. The file watcher already monitors `.planning/` for STATE.json changes; extending it to also trigger frontend cache invalidation (via polling or refetch intervals) enables the auto-refresh behavioral invariant.

On the frontend, each view is a new page component that uses TanStack Query hooks (matching the `useProjects` / `useProjectDetail` pattern) to fetch data from its corresponding endpoint. The KnowledgeGraph view is the most complex, requiring Cytoscape.js for interactive graph rendering of DAG.json dependency data. The CodebaseMap view requires tree-sitter WASM or a backend-side tree-sitter parse to produce a navigable structure tree. The existing placeholder `GraphPage.tsx` will be replaced by the full KnowledgeGraph implementation.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `web/backend/app/routers/state.py` | GET endpoint for parsed STATE.json | New |
| `web/backend/app/routers/worktrees.py` | GET endpoint for REGISTRY.json worktree data | New |
| `web/backend/app/routers/dag.py` | GET endpoint returning DAG as Cytoscape-compatible nodes/edges | New |
| `web/backend/app/routers/codebase.py` | GET endpoint for tree-sitter codebase structure | New |
| `web/backend/app/services/state_service.py` | Parse STATE.json into structured milestone/set data | New |
| `web/backend/app/services/worktree_service.py` | Parse REGISTRY.json and enumerate git worktrees | New |
| `web/backend/app/services/dag_service.py` | Parse DAG.json into graph nodes and edges | New |
| `web/backend/app/services/codebase_service.py` | Tree-sitter analysis producing file/symbol tree | New |
| `web/frontend/src/pages/StateView.tsx` | React page: milestone/set status dashboard | New |
| `web/frontend/src/pages/WorktreeView.tsx` | React page: active worktrees table | New |
| `web/frontend/src/pages/KnowledgeGraph.tsx` | React page: Cytoscape.js DAG graph (replaces GraphPage stub) | New |
| `web/frontend/src/pages/CodebaseMap.tsx` | React page: navigable codebase tree | New |
| `web/frontend/src/components/views/` | Shared sub-components for view pages | New |
| `web/backend/app/main.py` | Register new routers | Existing (modify) |
| `web/frontend/src/router.tsx` | Add routes for new view pages | Existing (modify) |

## Integration Points

- **Exports:** Four GET endpoints (`/api/projects/{id}/state`, `/worktrees`, `/dag`, `/codebase`) and four React page components (`StateView`, `WorktreeView`, `KnowledgeGraph`, `CodebaseMap`). These are pure read-only views consumed by the frontend router and potentially by the `cli-integration` set.
- **Imports from project-registry:** `Project` model (to resolve project path from UUID), `FileWatcherService` (to leverage existing file-change detection for auto-refresh triggers).
- **Imports from frontend-shell:** `AppLayout` (page wrapper), `useProjectStore` (active project context), `apiClient` (HTTP fetching), `useKeyboardNav` (keyboard shortcuts within views).
- **Side Effects:** None -- all endpoints are strictly GET-only with no mutations. The views read `.planning/` files from disk on each request (or use cached parsed data when the file watcher has already updated metadata).

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tree-sitter WASM binary size and language support | High | Start with Python + JS/TS grammars only; load WASM lazily; consider backend-side parsing to avoid shipping WASM to browser |
| DAG.json may not exist for all projects | Medium | Return empty graph gracefully; show "No dependency data available" placeholder in UI |
| REGISTRY.json does not exist in the current codebase | Medium | Enumerate worktrees via `git worktree list` subprocess as fallback; document expected REGISTRY.json schema |
| Cytoscape.js performance with large graphs (50+ nodes, 200+ edges) | Medium | Use `cose-bilkent` layout algorithm; virtualize rendering; enforce the `graph_performance` behavioral invariant with a benchmark test |
| File watcher currently only watches `.planning/` non-recursively | Low | May need recursive watch or explicit subdirectory scheduling to detect DAG.json in nested paths; verify watchdog configuration |
| Auto-refresh without WebSocket requires polling | Low | Use TanStack Query `refetchInterval` (e.g., 5-10s) as initial approach; WebSocket/SSE upgrade can follow in a later set |

## Wave Breakdown (Preliminary)

- **Wave 1:** Backend services and endpoints -- build the four service modules (`state_service`, `worktree_service`, `dag_service`, `codebase_service`) and their corresponding router modules; register routers in `main.py`; add response schemas
- **Wave 2:** Frontend view components -- build `StateView`, `WorktreeView`, `KnowledgeGraph` (Cytoscape.js), and `CodebaseMap` pages; create TanStack Query hooks for each endpoint; wire into `router.tsx`
- **Wave 3:** Integration and polish -- auto-refresh via refetch intervals, shared view sub-components (loading/error states, empty placeholders), keyboard navigation bindings, performance testing for graph rendering

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
