# SET-OVERVIEW: code-graph-backend

## Approach

This set extends the existing tree-sitter-based `codebase_service.py` to produce a full dependency graph -- not just a symbol tree, but a graph of file-to-file edges derived from import/require statements. The current service already walks the project directory, parses files with tree-sitter, and extracts symbols. The new work adds import extraction on top of that parse pass, producing a `{ nodes, edges }` graph structure suitable for frontend visualization.

Alongside the graph service, two new REST endpoints are introduced: a code-graph endpoint that returns the full dependency graph, and a file-content endpoint that serves raw file contents with strict path-traversal protection. Both endpoints use synchronous `def` handlers (not `async def`) because tree-sitter is a C-extension that releases the GIL and should not block the event loop when run in FastAPI's default threadpool.

A secondary concern is filling coverage gaps in the current parser: TypeScript files are currently routed through the JavaScript grammar, and CommonJS/ESM variant extensions (.cjs, .mjs, .cts, .mts) are not recognized at all. This set adds `tree-sitter-typescript` as a proper dependency and maps all variant extensions to the correct grammar. Finally, the unbounded `_parse_cache` dict is given an LRU eviction cap, and the frontend polling interval is tuned from 2s to 30s+.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `web/backend/app/services/codebase_service.py` | Core tree-sitter parsing, import extraction, graph building | Existing -- extend |
| `web/backend/app/routers/views.py` | REST endpoints for code-graph and file-content | Existing -- extend |
| `web/backend/app/schemas/views.py` | Pydantic response models for new endpoints | Existing -- extend |
| `web/backend/pyproject.toml` | Add `tree-sitter-typescript` dependency | Existing -- modify |

## Integration Points

- **Exports:**
  - `GET /api/projects/{id}/code-graph` -- returns `{ nodes, edges, total_files, total_edges }` dependency graph
  - `GET /api/projects/{id}/file?path=<relative_path>` -- returns `{ path, content, language, size }` with traversal protection
  - `get_codebase_graph()` function -- new service function returning nodes + edges dict
  - tree-sitter-typescript language parser integration
- **Imports:** None -- this set has no dependencies on other sets
- **Side Effects:**
  - `_parse_cache` now has a bounded size (LRU eviction); callers may see cache misses under memory pressure that previously would have been hits
  - `.cjs`/`.mjs`/`.cts`/`.mts` files will now appear in codebase output where they were previously invisible
  - `.ts`/`.tsx` files will be parsed with the TypeScript grammar instead of the JavaScript grammar, which may surface different or additional symbols

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| tree-sitter-typescript may have version incompatibility with existing tree-sitter 0.24 | High | Pin compatible version range in pyproject.toml; test import in isolation before wiring up |
| Import extraction regex/AST approach may miss dynamic imports or re-exports | Medium | Start with static `import`/`require`/`from...import` patterns; document known gaps; iterate |
| Large repos may produce thousands of edges, making the response payload too large | Medium | The existing `max_files` cap (default 500) naturally bounds the graph; add edge-count logging |
| Path-traversal protection bypass via symlinks or encoded characters | High | Use `Path.resolve()` + `is_relative_to()` check; reject any path containing `..`; add explicit tests for symlink escaping |
| Switching .ts/.tsx from JavaScript to TypeScript grammar may change symbol output for existing users | Low | This is a correctness fix; document the change; existing `/codebase` endpoint is unaffected since it uses the same parse pipeline |
| LRU cache eviction may regress performance for very active projects | Low | Set a generous default cap (e.g., 1000 entries); make it configurable |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- add `tree-sitter-typescript` dependency, map `.cjs`/`.mjs`/`.cts`/`.mts` extensions, separate TypeScript language entry in `SUPPORTED_LANGUAGES`, add LRU cap to `_parse_cache`
- **Wave 2:** Core graph -- implement import/require extraction per language, build `get_codebase_graph()` returning nodes + edges, add Pydantic schemas for graph and file-content responses
- **Wave 3:** Endpoints and polish -- wire up `GET /code-graph` and `GET /file` endpoints in `views.py`, add path-traversal protection, tune polling interval to 30s+, write tests

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
