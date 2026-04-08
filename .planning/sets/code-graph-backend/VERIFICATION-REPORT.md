# VERIFICATION-REPORT: code-graph-backend

**Set:** code-graph-backend
**Waves:** 1, 2, 3
**Verified:** 2026-04-08
**Verdict:** PASS_WITH_GAPS

## Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| Add .cjs, .mjs, .cts, .mts extensions | Wave 1 Task 2 | PASS | All extensions mapped correctly in 3-tuple refactor |
| Add tree-sitter-typescript dependency | Wave 1 Task 1 | PASS | Added to pyproject.toml dependencies |
| Separate TypeScript language entry | Wave 1 Tasks 2-3 | PASS | Separate typescript/tsx entries with proper function names |
| TypeScript-specific constructs (interface, type, enum) | Wave 1 Task 3 | PASS | Added to SYMBOL_QUERIES and _classify_kind |
| Implement import/require extraction | Wave 2 Tasks 1-3 | PASS | Per-language extractors using tree-sitter AST |
| Build file-to-file dependency edges | Wave 2 Tasks 2, 4 | PASS | Resolution function + graph builder |
| Create GET /code-graph endpoint | Wave 3 Task 1 | PASS | Sync def, returns CodeGraph schema |
| Create GET /file endpoint | Wave 3 Task 2 | PASS | 6-layer security with path traversal protection |
| Path traversal protection | Wave 3 Task 2 | PASS | Rejects .., validates is_relative_to, rejects symlinks |
| LRU eviction on _parse_cache | Wave 1 Task 4 | PASS | OrderedDict with 1000-entry cap |
| Tune polling interval to 30s+ | Wave 3 Task 6 | GAP | Correctly deferred -- interval is in frontend useViews.ts, not in owned files. Documented in DEFERRED.md. |
| Sync endpoints only (behavioral) | Wave 3 Tasks 1-2 | PASS | Both endpoints use sync def |
| Cache bounded (behavioral) | Wave 1 Task 4 | PASS | LRU eviction at _CACHE_MAX_SIZE |
| Use tree-sitter AST queries, not regex | Wave 2 Task 1 | PASS | Explicit in "What NOT to do" sections |
| Static imports only | Wave 2 Task 1 | PASS | Dynamic imports explicitly excluded |
| get_codebase_graph() returns graph+symbols | Wave 2 Task 4 | PASS | Returns nodes, edges, total_files, total_edges, scanned_files, truncated, parse_errors, unresolved_imports |
| OrderedDict with manual LRU eviction | Wave 1 Task 4 | PASS | move_to_end on hit, popitem(last=False) on overflow |
| Single cache stores symbols and edges | Wave 2 Task 3 | PASS | Cache value changed to (symbols, raw_imports) tuple |
| Reuse max_files parameter | Wave 2 Task 4 | PASS | Same parameter, default 500 |
| truncated: bool and scanned_files: int | Wave 2 Task 4, Task 5 | PASS | In return dict and CodeGraph schema |
| Flat edges without type metadata | Wave 2 Tasks 4-5 | PASS | GraphEdge has source/target only |
| Drop unresolvable imports | Wave 2 Task 4 | PASS | Only edges to known_files created |
| Reject all symlinks | Wave 3 Task 2 | PASS | Both symlink checks present |
| Null-byte detection + 1MB size limit | Wave 3 Task 2 | PASS | First 8KB null-byte check + 1MB cap |
| Unparseable files as orphan nodes | Wave 2 Task 4 | PASS | Nodes added with no outgoing edges |
| Broken local imports in unresolved_imports | Wave 2 Task 4 | PASS | Collected in response dict |
| Integration tests for new endpoints | Wave 3 Tasks 3-4 | PASS | TestCodeGraphEndpoint and TestFileEndpoint classes |
| Unit tests for import extraction/resolution | Wave 3 Task 5 | PASS | TestImportExtraction class |
| All backend tests pass | Wave 1 Task 5, Wave 2 Task 6, Wave 3 Task 7 | PASS | Regression checks at end of each wave |

## Implementability

| File | Wave | Action | Status | Notes |
|------|------|--------|--------|-------|
| web/backend/pyproject.toml | 1 | Modify | PASS | File exists on disk |
| web/backend/app/services/codebase_service.py | 1 | Modify | PASS | File exists; current structure matches plan assumptions (2-tuple SUPPORTED_LANGUAGES, dict _parse_cache) |
| web/backend/app/services/codebase_service.py | 2 | Modify | PASS | Depends on Wave 1 completion; sequential ordering is correct |
| web/backend/app/services/codebase_service.py | 3 | Modify | PASS | Comment-only change; depends on Waves 1-2 |
| web/backend/app/schemas/views.py | 2 | Modify | PASS | File exists; plan appends to end of file |
| web/backend/app/routers/views.py | 3 | Modify | PASS | File exists; current import structure matches plan assumptions |
| web/backend/tests/test_views_api.py | 3 | Modify | PASS | File exists; plan appends new test classes |
| .planning/sets/code-graph-backend/DEFERRED.md | 3 | Modify | PASS | File exists with empty table ready for entries |

## Consistency

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| web/backend/app/services/codebase_service.py | Wave 1 Tasks 2-4, Wave 2 Tasks 1-4, Wave 3 Task 6 | PASS | Sequential wave ordering -- no parallel conflict. Within each wave, tasks are sequential. |
| web/backend/tests/test_views_api.py | Wave 3 Tasks 3-5 | PASS | All tasks append distinct test classes to the same file within one wave; sequential execution prevents conflict. |

## Cross-Job Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Wave 2 depends on Wave 1 (SUPPORTED_LANGUAGES 3-tuple, LRU cache) | PASS | Wave ordering is sequential; pre-conditions correctly stated |
| Wave 3 depends on Wave 2 (get_codebase_graph(), Pydantic schemas) | PASS | Wave ordering is sequential; pre-conditions correctly stated |
| Wave 3 Task 1 imports get_codebase_graph from codebase_service | PASS | Function created in Wave 2 Task 4 |
| Wave 3 Tasks 1-2 import CodeGraph/FileContent from schemas | PASS | Schemas created in Wave 2 Task 5 |
| Wave 2 Task 3 changes _parse_file return type; Wave 2 Task 4 depends on it | PASS | Sequential task ordering within wave |

## Edits Made

| File | Change | Reason |
|------|--------|--------|
| (none) | (no edits needed) | All plans are structurally sound |

## Advisory Notes

| Topic | Details |
|-------|---------|
| CONTRACT.json edge type field mismatch | CONTRACT.json exports specify `edges: Array<{source, target, type}>` but CONTEXT.md decision is "Flat file-to-file edges with no type metadata" and the plan follows this. GraphEdge schema omits `type`. This is intentional per CONTEXT.md but creates a minor contract deviation. Consider updating CONTRACT.json to remove `type` from the edge signature if this set proceeds. |
| Wave 3 Task 5 test file location | Plan says tests go in `test_views_api.py` OR optionally `test_codebase_service.py` (create). The choice is left to executor discretion. Either path is valid -- test_codebase_service.py does not exist yet. |

## Summary

All three waves pass structural verification. Every requirement from the CONTRACT.json and CONTEXT.md decisions is addressed by at least one wave task. All files marked for modification exist on disk with the expected structure. No file ownership conflicts exist -- waves execute sequentially, and tasks within each wave are sequential. The only gap is the polling interval tuning task, which is correctly identified as out of scope (the relevant code is in the frontend, not in the owned backend files) and properly deferred. One advisory note: the CONTRACT.json edge signature includes a `type` field that the CONTEXT.md decisions explicitly dropped -- the plan correctly follows CONTEXT.md but the contract should be updated for consistency. Verdict is PASS_WITH_GAPS due to the deferred polling interval task.
