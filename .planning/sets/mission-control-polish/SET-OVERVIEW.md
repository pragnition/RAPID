# SET-OVERVIEW: mission-control-polish

## Approach

This set addresses four distinct visual and functional regressions in the Mission Control web dashboard's graph pages. The work is entirely frontend-focused for three of the four issues (color palette, default zoom, syntax highlighting) and requires a coordinated frontend-backend investigation for the fourth (Set DAG visualization failure).

The graph rendering uses Cytoscape.js with the `cytoscape-dagre` layout for the Set DAG and `cytoscape-fcose` for the Code Graph. Both graphs use hardcoded color values in `getNodeColor()` and `getLanguageColor()` that bypass the theme system, producing poor contrast against dark surfaces. The syntax highlighting in the FileViewerPanel uses CodeMirror's `basicSetup` with only a minimal `darkHighlight` override -- no proper token-level syntax highlighting theme is applied, so code appears largely monochrome. The default zoom is left to Cytoscape's automatic fit, which can produce unhelpful zoom levels on small or very large graphs.

The DAG visualization failure ("Failed to load DAG data") traces through `useDagGraph` -> `GET /api/projects/{id}/dag` -> `get_dag_graph()` which reads `.planning/sets/DAG.json`. The backend service exists and the DAG.json file is present, so the issue likely lies in data shape mismatches (extra fields like `type`, `group`, `priority`, `description` on nodes that the Pydantic response model may reject) or in the project registration/path resolution. This needs investigation to identify the exact failure mode.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `web/frontend/src/pages/KnowledgeGraphPage.tsx` | Main graph page with both Code Graph and Set DAG tabs | Existing -- modify color functions, zoom defaults |
| `web/frontend/src/components/graph/FileViewerPanel.tsx` | File viewer panel with CodeMirror syntax highlighting | Existing -- add proper syntax highlighting theme |
| `web/frontend/src/components/editor/CodeMirrorEditor.tsx` | Notes editor with CodeMirror (shared theme pattern) | Existing -- may share highlight theme improvements |
| `web/frontend/src/hooks/useViews.ts` | `useDagGraph` hook that fetches DAG data | Existing -- may need error handling improvements |
| `web/frontend/src/hooks/useCodeGraph.ts` | `useCodeGraph` and `useFileContent` hooks | Existing |
| `web/frontend/src/types/api.ts` | TypeScript types for `DagGraph`, `DagNode`, etc. | Existing -- may need type alignment |
| `web/backend/app/services/dag_service.py` | Backend service reading DAG.json | Existing -- investigate/fix data shape |
| `web/backend/app/schemas/views.py` | Pydantic response models for DAG endpoint | Existing -- may need field relaxation |
| `web/backend/app/routers/views.py` | DAG endpoint handler | Existing |

## Integration Points

- **Exports:** None (CONTRACT.json exports are empty). This set is purely a polish/bugfix set with no API surface changes.
- **Imports:** None (CONTRACT.json imports are empty). All dependencies are internal to the web dashboard.
- **Side Effects:** Visual appearance of all graph views will change. The DAG endpoint fix may change the response payload shape if extra fields are forwarded.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| DAG failure root cause is deeper than data shape (e.g., project path resolution, DB state) | Medium | Reproduce locally first; check backend logs; test with curl before touching frontend |
| Syntax highlighting theme conflicts with multi-theme support (8 themes exist) | Medium | Use CSS custom properties from the existing theme system rather than hardcoded colors |
| Color palette changes break visual consistency across themes | Low | Test against at least dark and light variants of one theme; use theme variables where possible |
| Cytoscape zoom defaults behave differently at various graph sizes | Low | Set bounded initial zoom with fallback to fit; test with both small (3-5 nodes) and large (50+) graphs |

## Wave Breakdown (Preliminary)

- **Wave 1:** DAG investigation and fix (backend data shape alignment, Pydantic model update, verify endpoint returns valid data); graph color palette improvements (replace hardcoded hex values in `getNodeColor`/`getLanguageColor` with theme-aware colors that have better contrast)
- **Wave 2:** Syntax highlighting theme (add proper CodeMirror highlight theme using `@codemirror/language` `HighlightStyle` with theme-aware token colors); default zoom level tuning (set sensible initial zoom bounds and fit padding for both DAG and Code Graph views)
- **Wave 3:** Cross-theme validation and edge case polish (verify all changes look correct across multiple themes; handle empty/minimal graphs gracefully)

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
