# SET-OVERVIEW: code-graph-frontend

## Approach

This set transforms the existing KnowledgeGraphPage (which currently renders only a Set DAG) into a full Code Graph page with two tabs: a new codebase dependency graph visualization and the preserved Set DAG view. The core work is building a second Cytoscape.js graph instance that renders file nodes colored by language and import/require edges with directional arrows, consuming the `GET /api/projects/{id}/code-graph` endpoint provided by the `code-graph-backend` set.

The implementation reuses the project's existing Cytoscape.js and CodeMirror dependencies. A new `useCodeGraph` hook wraps the code-graph API with 30s+ polling (matching the backend's heavier tree-sitter workload). Clicking a file node fetches its content via `GET /api/projects/{id}/file` and displays it in a side panel using CodeMirror with syntax highlighting. A search/filter bar dims non-matching nodes to let users find files quickly. For large codebases (200+ nodes), a directory-level clustering view prevents performance degradation.

The rename from "Knowledge Graph" to "Code Graph" touches the page component, router lazy-import, sidebar command palette entry, and page headings. The route path `/graph` stays unchanged to avoid breaking bookmarks. The existing DAG visualization is preserved verbatim in a "Set DAG" tab.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `web/frontend/src/pages/KnowledgeGraphPage.tsx` | Rename to CodeGraphPage; add tab container wrapping DAG and Code Graph views | Existing (major refactor) |
| `web/frontend/src/components/graph/FileViewerPanel.tsx` | Read-only CodeMirror file content viewer, shown on node click | New |
| `web/frontend/src/components/graph/GraphSearchFilter.tsx` | Filename search input with graph highlighting/dimming | New |
| `web/frontend/src/components/graph/GraphTabBar.tsx` | Tab switcher between Code Graph and Set DAG views | New |
| `web/frontend/src/hooks/useCodeGraph.ts` | React Query hook for `/code-graph` and `/file` endpoints with 30s+ polling | New |
| `web/frontend/src/types/api.ts` | Add CodeGraph types (CodeGraphNode, CodeGraphEdge, FileContent) | Existing (extend) |
| `web/frontend/src/router.tsx` | Update lazy import name from KnowledgeGraphPage to CodeGraphPage | Existing (minor) |

## Integration Points

- **Exports:**
  - `CodeGraphPage` React component -- the full tabbed page with both graph views
  - `FileViewerPanel` React component -- reusable read-only file viewer with CodeMirror
- **Imports:**
  - `GET /api/projects/{id}/code-graph` from `code-graph-backend` -- returns `{ nodes, edges, total_files, total_edges }` with file nodes and import edges
  - `GET /api/projects/{id}/file?path=<relative_path>` from `code-graph-backend` -- returns `{ path, content, language, size }` for click-to-view
- **Side Effects:**
  - Cytoscape instances must be destroyed in useEffect cleanup to prevent memory leaks
  - CodeMirror language extensions will need to be dynamically imported per file language (only `@codemirror/lang-markdown` is currently installed; additional language packs like `@codemirror/lang-javascript`, `@codemirror/lang-python` needed)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing CodeMirror language extensions -- only markdown is installed | Medium | Install `@codemirror/lang-javascript`, `@codemirror/lang-python`, `@codemirror/lang-rust`, `@codemirror/lang-go` as needed; fall back to plain text for unsupported languages |
| Performance with 200+ file nodes in Cytoscape | High | Implement directory-level clustering for large graphs; show warning and offer collapsed view; use `cy.batch()` for bulk updates |
| Backend endpoint unavailability during parallel development | Medium | `useCodeGraph` hook returns clean loading/error states; UI degrades gracefully with informative messages when backend is not ready |
| Dual Cytoscape instances (DAG tab + Code Graph tab) consuming memory | Medium | Only mount the active tab's Cytoscape instance; destroy on tab switch via conditional rendering |
| Rename breakage across sidebar, router, command palette | Low | Grep for all "KnowledgeGraph" and "Knowledge Graph" references; update systematically |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- add CodeGraph types to `api.ts`, create `useCodeGraph` hook, install missing CodeMirror language packages
- **Wave 2:** Core UI -- rename page, implement `GraphTabBar` for tab switching, build code graph Cytoscape visualization with force-directed layout and language-colored nodes
- **Wave 3:** Interaction and polish -- implement `FileViewerPanel` with CodeMirror, add `GraphSearchFilter` with highlight/dim behavior, add performance safeguards (directory clustering, max-nodes warning), keyboard accessibility with aria-live

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
