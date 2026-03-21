# Stack Research: read-only-views

## Core Stack Assessment

### Frontend: Cytoscape.js (NEW dependency)
- **Required for:** KnowledgeGraph view (DAG visualization)
- **Latest stable:** 3.33.1 (published ~Aug 2025)
- **Key features relevant to this set:**
  - Canvas-based graph rendering with built-in zoom/pan/selection
  - First-party TypeScript support (since 3.31.0)
  - Experimental WebGL rendering (3.31.0+) for large graphs
  - Rich styling via CSS-like selectors with data-driven mapping (`data(field)`, `mapData()`)
  - Event system for click-to-select interactions
  - Performance: handles 50+ nodes and 200+ edges easily in canvas mode
- **Performance configuration for 50-node/200-edge target:**
  - `hideEdgesOnViewport: true` and `hideLabelsOnViewport: true` during pan/zoom
  - `textureOnViewport: true` for texture-based rendering during interaction
  - `curve-style: 'bezier'` with `target-arrow-shape: 'triangle'` for directed edges
  - `wheelSensitivity: 0.5` for smoother zoom control
- **Node coloring by status:** Use `data(status)` with style selectors like `node[status = "pending"]` for conditional coloring. All 6 status values (pending, discussed, planned, executed, complete, merged) map to distinct colors.

### Frontend: cytoscape-dagre (NEW dependency)
- **Required for:** Dagre directed-graph layout in KnowledgeGraph
- **Latest stable:** 2.5.0 (published ~early 2023, 3 years old)
- **Maintenance status:** Inactive -- no releases in 3 years. However, the package is stable and widely used (a layout algorithm wrapper around dagre).
- **TypeScript types:** `@types/cytoscape-dagre` v2.3.4 (published ~Nov 2025)
- **Usage pattern:** Register as Cytoscape extension, then use `layout: { name: 'dagre', rankDir: 'TB' }` for top-to-bottom flow.
- **Risk:** Low. Layout algorithms are inherently stable; no active bugs reported. The underlying dagre library is also stable (v0.8.5).

### Frontend: react-cytoscapejs (EVALUATE -- may skip)
- **Latest stable:** 2.0.0 (last published >12 months ago)
- **Maintenance status:** Inactive. Has not been updated for React 19.
- **Peer dependencies:** `react ^16.0.0 || ^17.0.0 || ^18.0.0` -- does NOT list React 19.
- **Recommendation:** SKIP this wrapper. Instead, use Cytoscape.js directly via `useRef` + `useEffect` pattern. Reasons:
  1. react-cytoscapejs does not declare React 19 peer compatibility
  2. The wrapper is thin (~200 lines) and adds no significant value over direct integration
  3. Direct Cytoscape.js usage provides full API control for layout, events, and styling
  4. Eliminates a dependency with uncertain maintenance future

### Backend: tree-sitter + tree-sitter-language-pack (NEW dependencies)
- **tree-sitter:** v0.25.2 (published Sep 2025). Python >=3.10 required. Project uses Python >=3.12 -- satisfied.
- **tree-sitter-language-pack:** v0.13.0 (published Nov 2025). Bundles 165+ language grammars as pre-compiled wheels.
- **Supported languages for this set:** Python, JavaScript/TypeScript, Go, Rust -- all included in language-pack.
- **API pattern:**
  ```python
  from tree_sitter_language_pack import get_parser
  parser = get_parser("python")
  tree = parser.parse(source_bytes)
  root = tree.root_node
  # Walk tree via root.children, node.type, node.start_point, node.end_point
  ```
- **Performance notes:**
  - `walk()` method preferred over recursive `.children` traversal for large files
  - Parsing is fast (C-native); a 10K-line file parses in ~5ms
  - No built-in caching -- application must implement its own (mtime-based recommended)
- **Alternative considered:** `tree-sitter-languages` (grantjenks) -- older, fewer languages, less maintained. `tree-sitter-language-pack` is the better choice.

### Backend: FastAPI (existing)
- **Current version:** >=0.135,<1.0 (pinned in pyproject.toml)
- **Latest stable:** ~0.115.x (FastAPI versioning is pre-1.0)
- **Relevant for this set:** GET-only endpoints use standard `@router.get()` pattern. No new middleware or lifecycle hooks needed.
- **Confirmed:** Python 3.12+ required, satisfied.

### Frontend: TanStack Query (existing)
- **Current version:** ^5.91.3
- **Auto-refresh via `refetchInterval`:**
  - Set `refetchInterval: 2000` (2 seconds) per-hook for polling
  - `refetchIntervalInBackground: false` (default) -- pauses polling when tab is backgrounded (saves resources)
  - v5 callback signature: `refetchInterval: number | false | ((query: Query) => number | false | undefined)`
  - Can conditionally adjust interval based on query state
- **Interaction with existing queryClient defaults:** Global `staleTime: 30000` and `gcTime: 300000` remain. Per-hook `refetchInterval: 2000` overrides the stale-then-refetch behavior by forcing refetch every 2s regardless of staleness.

## Dependency Health

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| cytoscape | n/a (new) | 3.33.1 | Active | TS support since 3.31.0, ~monthly releases |
| cytoscape-dagre | n/a (new) | 2.5.0 | Stable/Inactive | No releases in 3y, but layout algos are inherently stable |
| @types/cytoscape-dagre | n/a (new) | 2.3.4 | Active | Recently updated Nov 2025 |
| tree-sitter (Python) | n/a (new) | 0.25.2 | Active | Sep 2025 release, pre-compiled wheels |
| tree-sitter-language-pack | n/a (new) | 0.13.0 | Active | Nov 2025, 165+ languages bundled |
| react-cytoscapejs | n/a (skip) | 2.0.0 | Inactive | No React 19 support, recommend direct integration |
| fastapi | >=0.135 | ~0.115 | Active | Pre-1.0, rapid releases |
| @tanstack/react-query | ^5.91.3 | 5.91.3 | Active | Already installed, very frequent releases |
| react | ^19.2.4 | 19.2.4 | Active | Already installed |
| zustand | ^5.0.12 | 5.0.12 | Active | Already installed |

## Compatibility Matrix

| Constraint | Requirement | Satisfied |
|-----------|-------------|-----------|
| cytoscape requires no peer deps | Standalone library | Yes |
| cytoscape-dagre requires cytoscape | ^3.2.0 | Yes (3.33.1) |
| tree-sitter requires Python | >=3.10 | Yes (3.12) |
| tree-sitter-language-pack requires Python | >=3.10 | Yes (3.12) |
| TanStack Query refetchInterval requires | v5 API | Yes (5.91.3) |
| Cytoscape TS types | Built-in since 3.31.0 | Yes |
| Keyboard shortcut "gg" conflict | Already bound to "Scroll to top" in AppLayout | CONFLICT -- see risks |
| Keyboard shortcut "gs", "gw", "gc" | Not bound | Available |

## Upgrade Paths

No outdated dependencies requiring upgrade for this set. All new dependencies are at their latest stable versions. Existing dependencies (React, TanStack Query, Zustand) are already current.

## Tooling Assessment

### Build Tools
- **Frontend:** Vite 8.0.1 -- no changes needed. Cytoscape.js is a standard ESM/CJS package that bundles without issues.
- **Backend:** pip/uv with pyproject.toml -- add tree-sitter and tree-sitter-language-pack to dependencies.

### Test Framework
- **Backend:** pytest + httpx for endpoint testing (already configured in dev dependencies)
- **Frontend:** No test framework installed yet. Vitest recommended for future. For this set, behavioral contracts (read-only enforcement, graph performance) can be verified via backend pytest tests and manual verification.

### Linting/Formatting
- **Backend:** ruff 0.11 (configured, line-length=100, target py312)
- **Frontend:** No ESLint configured yet. TypeScript strict mode provides type checking via `tsc -b --noEmit`.

## Stack Risks

1. **Keyboard shortcut conflict: "gg" is already bound to "Scroll to top"** in AppLayout.tsx (line 69). The CONTEXT.md specifies `gg=graph` for the KnowledgeGraph route. This conflicts directly. **Resolution options:**
   - (a) Change graph shortcut to a different key (e.g., `gk` for knowledge graph, or `gG` with shift)
   - (b) Remove the "scroll to top" binding (vim-style `gg`) and reassign to graph navigation
   - **Recommendation:** Use `gk` for graph (knowledge), keeping `gg` for scroll-to-top which is a more standard vim convention. Impact: low.

2. **react-cytoscapejs lacks React 19 support.** The wrapper has not been updated in >12 months and does not declare React 19 as a peer dependency. **Mitigation:** Use Cytoscape.js directly with a `useRef`/`useEffect` pattern. This is actually the recommended approach in the Cytoscape.js docs for framework integration.

3. **cytoscape-dagre is unmaintained (3 years without release).** **Mitigation:** The package wraps the stable dagre algorithm. No API changes expected. If issues arise, the dagre layout can be applied manually via `cytoscape.use(dagre)` registration. The package has 0 open security advisories.

4. **tree-sitter parsing can be slow on very large codebases.** Parsing every file in a large project (1000+ files) on each API request would be expensive. **Mitigation:** Implement mtime-based caching in the codebase service. Only re-parse files whose modification time has changed. Cache the AST summary (not the full tree) as JSON. Consider limiting tree depth to 3-4 levels for the API response.

5. **tree-sitter-language-pack is a large dependency (~200MB installed).** It bundles 165+ grammars when only 4 are needed (Python, JS/TS, Go, Rust). **Mitigation:** This is acceptable for a server-side dependency. Alternatively, install individual grammar packages (`tree-sitter-python`, `tree-sitter-javascript`, `tree-sitter-go`, `tree-sitter-rust`) for a smaller footprint. Individual packages total ~20MB. **Recommendation:** Use individual grammar packages to reduce install size.

6. **2-second polling interval generates significant HTTP traffic.** Four views polling at 2s = up to 2 requests/second per active tab. For a local dashboard this is fine, but could strain resources if multiple tabs are open. **Mitigation:** `refetchIntervalInBackground: false` (default) pauses polling on backgrounded tabs. Consider adding `enabled: !!projectId` to prevent polling when no project is selected.

7. **Backend reads .planning/ files directly from disk on every request.** The existing `parse_state_json` pattern reads and parses JSON on each call. With 2s polling across 4 endpoints, that is 2 file reads/second. **Mitigation:** For STATE.json, DAG.json, and REGISTRY.json this is negligible (small files, OS-level page cache). For codebase tree-sitter parsing, implement explicit caching (see risk #4).

## Recommendations

1. **Use Cytoscape.js directly (no react-cytoscapejs wrapper):** Create a `<CytoscapeGraph>` component using `useRef` for the container div and `useEffect` for Cytoscape instance lifecycle. This avoids the unmaintained React wrapper and gives full API control. Priority: critical.

2. **Use individual tree-sitter grammar packages instead of language-pack:** Install `tree-sitter`, `tree-sitter-python`, `tree-sitter-javascript`, `tree-sitter-go`, `tree-sitter-rust` individually. Saves ~180MB and makes dependencies explicit. Priority: high.

3. **Implement mtime-based caching for tree-sitter parsing:** Cache parsed AST summaries keyed by `(file_path, mtime)`. Invalidate when mtime changes. This prevents re-parsing unchanged files on every 2s poll. Priority: high.

4. **Resolve keyboard shortcut conflict for graph route:** Use `gk` (knowledge graph) instead of `gg` (conflicts with scroll-to-top). Register `gs`=state, `gw`=worktrees, `gk`=graph, `gc`=codebase. Priority: high.

5. **Add `refetchInterval: 2000` per-hook, not globally:** Each view hook (useProjectState, useWorktrees, useDag, useCodebaseTree) should set its own `refetchInterval: 2000`. Do NOT change the global queryClient defaults. Priority: medium.

6. **Limit tree-sitter API response depth:** Cap the codebase tree at 3-4 levels of nesting to prevent oversized responses. Allow an optional `depth` query parameter for clients that need more. Priority: medium.

7. **Guard polling with `enabled: !!projectId`:** All four view hooks should only poll when an active project is selected. This prevents unnecessary requests and 404 errors. Priority: medium.

8. **Register cytoscape-dagre extension at app startup, not per-render:** Call `cytoscape.use(dagre)` once at module load time (e.g., in a setup file or at the top of the KnowledgeGraph module). Calling it per-render throws warnings. Priority: medium.

## New Dependencies Summary

### Frontend (package.json additions)
```json
{
  "dependencies": {
    "cytoscape": "^3.33.1",
    "cytoscape-dagre": "^2.5.0"
  },
  "devDependencies": {
    "@types/cytoscape-dagre": "^2.3.4"
  }
}
```
Note: `cytoscape` has built-in TypeScript types since 3.31.0; no `@types/cytoscape` needed.

### Backend (pyproject.toml additions)
```toml
dependencies = [
    # ... existing deps ...
    "tree-sitter>=0.25,<1.0",
    "tree-sitter-python>=0.23,<1.0",
    "tree-sitter-javascript>=0.23,<1.0",
    "tree-sitter-go>=0.23,<1.0",
    "tree-sitter-rust>=0.23,<1.0",
]
```

## Data Format Reference

### STATE.json shape (for state view)
```json
{
  "version": 1,
  "projectName": "string",
  "currentMilestone": "string",
  "milestones": [
    {
      "id": "string",
      "name": "string",
      "sets": [
        {
          "id": "string",
          "status": "pending|discussed|planned|executed|complete|merged",
          "waves": [{ "id": "string", "status": "pending|executing|complete", "jobs": [] }],
          "name": "string (optional)",
          "branch": "string (optional)"
        }
      ]
    }
  ],
  "lastUpdatedAt": "ISO8601",
  "createdAt": "ISO8601"
}
```

### DAG.json shape (for knowledge graph)
```json
{
  "nodes": [{ "id": "string", "wave": 0, "status": "string" }],
  "edges": [{ "from": "string", "to": "string" }],
  "waves": { "0": { "sets": ["string"], "checkpoint": {} } },
  "metadata": { "created": "date", "totalSets": 4, "totalWaves": 1, "maxParallelism": 4 }
}
```
Note: Edge convention is `from` = dependency, `to` = dependent. This maps to Cytoscape `source`/`target`.

### REGISTRY.json shape (for worktree view)
```json
{
  "version": 1,
  "worktrees": {
    "set-name": {
      "setName": "string",
      "branch": "string",
      "path": "string",
      "phase": "string",
      "status": "string",
      "wave": "number|null",
      "createdAt": "ISO8601",
      "mergeStatus": "string (optional)",
      "mergedAt": "ISO8601 (optional)",
      "mergeCommit": "string (optional)"
    }
  }
}
```
