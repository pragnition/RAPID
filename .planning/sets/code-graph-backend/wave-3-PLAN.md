# PLAN: code-graph-backend / Wave 3 -- Endpoints, Security, and Tests

**Set:** code-graph-backend
**Wave:** 3 of 3
**Objective:** Wire up the two new REST endpoints (code-graph and file-content), implement path-traversal security for the file endpoint, add integration and unit tests for all new functionality, and document the deferred polling interval task.

## Pre-conditions

- Wave 1 and 2 are complete
- `get_codebase_graph()` is functional and returns the expected dict shape
- Pydantic schemas `CodeGraph` and `FileContent` are defined in `schemas/views.py`

---

## Task 1: Add GET /api/projects/{id}/code-graph endpoint

**File:** `web/backend/app/routers/views.py`

**Action:**

1. Add `get_codebase_graph` to the imports from `app.services.codebase_service`:
   ```python
   from app.services.codebase_service import get_codebase_tree, get_codebase_graph
   ```

2. Add `CodeGraph` and `FileContent` to the imports from `app.schemas.views`:
   ```python
   from app.schemas.views import (
       CodebaseTree,
       CodeGraph,
       DagGraph,
       FileContent,
       ProjectState,
       WorktreeRegistry,
   )
   ```

3. Add the endpoint after the existing `get_codebase_view` endpoint:
   ```python
   @router.get("/{project_id}/code-graph", response_model=CodeGraph)
   def get_code_graph_view(
       project_id: UUID, max_files: int = 500, session: Session = Depends(get_db)
   ):
       """Return file dependency graph for a project."""
       project = _get_project(project_id, session)
       result = get_codebase_graph(Path(project.path), max_files=max_files)
       return CodeGraph(**result)
   ```

**What NOT to do:**
- Do NOT use `async def` -- existing endpoints use sync `def` and the behavioral contract requires this
- Do NOT add any caching headers or middleware here

**Verification:**
```bash
cd web/backend && python -c "
from app.routers.views import router
routes = [r.path for r in router.routes]
assert '/{project_id}/code-graph' in routes, f'Missing code-graph route in {routes}'
print('PASS')
"
```

---

## Task 2: Add GET /api/projects/{id}/file endpoint with security

**File:** `web/backend/app/routers/views.py`

**Action:** Add the file-content endpoint with full path-traversal protection.

```python
@router.get("/{project_id}/file", response_model=FileContent)
def get_file_content_view(
    project_id: UUID,
    path: str,
    session: Session = Depends(get_db),
):
    """Return file content with path traversal protection."""
    project = _get_project(project_id, session)
    project_path = Path(project.path)

    # Reject paths containing '..'
    if ".." in path.split("/") or ".." in path.split("\\"):
        raise HTTPException(status_code=400, detail="Invalid path: contains '..'")

    # Construct absolute path
    abs_path = (project_path / path).resolve()

    # Validate resolved path is within project
    if not abs_path.is_relative_to(project_path.resolve()):
        raise HTTPException(status_code=403, detail="Path traversal denied")

    # Reject symlinks
    if abs_path.is_symlink() or (project_path / path).is_symlink():
        raise HTTPException(status_code=403, detail="Symlinks not allowed")

    # Check existence
    if not abs_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # Check size (1MB limit)
    file_size = abs_path.stat().st_size
    if file_size > 1_048_576:
        raise HTTPException(status_code=400, detail="File too large (>1MB)")

    # Read and check for binary content (null bytes in first 8KB)
    try:
        raw = abs_path.read_bytes()
    except OSError:
        raise HTTPException(status_code=500, detail="Cannot read file")

    if b"\x00" in raw[:8192]:
        raise HTTPException(status_code=400, detail="Binary file not supported")

    content = raw.decode("utf-8", errors="replace")

    # Determine language
    from app.services.codebase_service import _EXT_TO_LANG
    ext = abs_path.suffix
    language = _EXT_TO_LANG.get(ext)

    return FileContent(
        path=path,
        content=content,
        language=language,
        size=file_size,
    )
```

**Security checks in order:**
1. Reject `..` path components
2. Resolve path and validate `is_relative_to`
3. Reject symlinks (check both the constructed path and the resolved path)
4. Check file exists
5. Check file size <= 1MB
6. Read file and check for null bytes in first 8KB (binary detection)
7. Decode as UTF-8 with replacement for invalid chars

**What NOT to do:**
- Do NOT follow symlinks -- reject them outright
- Do NOT use `os.path.realpath` without also checking `is_relative_to` on the resolved path
- Do NOT expose absolute file paths in the response -- return the relative `path` as provided
- Do NOT use `async def`

**Verification:**
```bash
cd web/backend && python -c "
from app.routers.views import router
routes = [r.path for r in router.routes]
assert '/{project_id}/file' in routes, f'Missing file route in {routes}'
print('PASS')
"
```

---

## Task 3: Write integration tests for code-graph endpoint

**File:** `web/backend/tests/test_views_api.py`

**Action:** Add a new test class `TestCodeGraphEndpoint` to the existing test file, following the same patterns as the existing `TestCodebaseEndpoint` class.

Tests to add:

1. `test_code_graph_200` -- Register project with a few JS files that import each other, hit the endpoint, verify response contains nodes, edges, total_files, total_edges.

2. `test_code_graph_edges` -- Create `main.js` importing `./utils`, create `utils.js`. Verify an edge from `main.js` to `utils.js` exists in the response.

3. `test_code_graph_max_files` -- Create 5 Python files, request with `max_files=2`, verify `truncated` is true and response has at most 2 nodes.

4. `test_code_graph_parse_errors` -- Create a file with a recognized extension but unparse-able content (e.g., a `.py` file with raw binary garbage). Verify it appears in `parse_errors`.

5. `test_code_graph_404_no_project` -- Request with a fake UUID, expect 404.

**Fixture update:** The `project_dir` fixture already creates `sample.py`. Add additional JS files inline in each test method that needs them (using `project_dir` path directly).

**What NOT to do:**
- Do NOT modify the existing `project_dir` fixture -- create test-specific files inline
- Do NOT test import extraction logic here -- that is tested in Task 5

**Verification:**
```bash
cd web/backend && uv run pytest tests/test_views_api.py::TestCodeGraphEndpoint -x -v 2>&1 | tail -20
```

---

## Task 4: Write integration tests for file endpoint

**File:** `web/backend/tests/test_views_api.py`

**Action:** Add a new test class `TestFileEndpoint` with comprehensive security tests.

Tests to add:

1. `test_file_200` -- Create a Python file, request its content, verify response has correct path, content, language, size.

2. `test_file_traversal_dotdot_400` -- Request with `path=../../etc/passwd`, expect 400.

3. `test_file_traversal_resolved_403` -- Request with a path that resolves outside project root (e.g., path containing symlink). Expect 403.

4. `test_file_symlink_403` -- Create a symlink inside the project dir pointing to a file outside, request the symlink path, expect 403.

5. `test_file_not_found_404` -- Request a non-existent file path, expect 404.

6. `test_file_too_large_400` -- Create a file >1MB, request it, expect 400.

7. `test_file_binary_400` -- Create a file with null bytes, request it, expect 400.

8. `test_file_unknown_language` -- Request a `.txt` file, verify `language` is `null` in response.

**What NOT to do:**
- Do NOT test path traversal by creating actual sensitive files -- use the HTTP response codes
- Do NOT skip the symlink test -- use `os.symlink` to create a test symlink

**Verification:**
```bash
cd web/backend && uv run pytest tests/test_views_api.py::TestFileEndpoint -x -v 2>&1 | tail -20
```

---

## Task 5: Write unit tests for import extraction and resolution

**File:** `web/backend/tests/test_views_api.py` (append to same file, OR create `web/backend/tests/test_codebase_service.py` if the test file is getting too large)

**Action:** Add a test class `TestImportExtraction` with focused unit tests for the import extraction and resolution logic.

Tests to add:

1. `test_python_import_extraction` -- Parse a Python source with `import os`, `from pathlib import Path`, `from .utils import foo`. Verify all three specifiers are returned.

2. `test_js_import_extraction` -- Parse JS source with `import x from "./foo"`, `const y = require("./bar")`, `import z from "react"`. Verify `./foo` and `./bar` are returned, `react` is NOT returned.

3. `test_ts_import_extraction` -- Parse TypeScript source with `import type { Foo } from "./types"`. Verify `./types` is returned.

4. `test_resolve_js_relative` -- Test `_resolve_import_to_file` with a `./utils` specifier, verify it resolves to `utils.js` or `utils.ts` in the known files set.

5. `test_resolve_js_index` -- Test resolution of `./lib` to `lib/index.ts`.

6. `test_resolve_python_dotted` -- Test `src.utils` resolving to `src/utils.py`.

7. `test_resolve_unresolvable_returns_none` -- Test that an external package specifier returns `None`.

8. `test_cache_lru_eviction` -- Insert `_CACHE_MAX_SIZE + 1` entries into `_parse_cache`, verify size equals `_CACHE_MAX_SIZE` and the first entry was evicted.

**What NOT to do:**
- Do NOT test the full graph building pipeline here -- that is tested via the integration tests in Task 3
- Do NOT mock tree-sitter -- use real parsing with small source strings

**Verification:**
```bash
cd web/backend && uv run pytest tests/ -k "TestImportExtraction" -x -v 2>&1 | tail -20
```

---

## Task 6: Document deferred polling interval task

**File:** `web/backend/app/services/codebase_service.py` (comment only)

**Action:** The task "Tune codebase polling interval to 30s+" cannot be completed in this set because the polling interval is configured in `web/frontend/src/hooks/useViews.ts` (`refetchInterval: 2000`), which is NOT in the owned files list. Add a comment at the top of `codebase_service.py` noting this:

```python
# NOTE: Frontend polling interval (refetchInterval in useViews.ts) is 2s.
# Tuning to 30s+ is deferred to a frontend set -- see .planning/sets/code-graph-backend/DEFERRED.md
```

Also update the DEFERRED.md file to record this item.

**File:** `.planning/sets/code-graph-backend/DEFERRED.md`

**Action:** Add the deferred item to the table:

```
| 1 | Tune codebase polling interval to 30s+ | SET-OVERVIEW research | Frontend set (useViews.ts is not in owned files) |
```

**Verification:**
```bash
grep -q "refetchInterval" /home/kek/Projects/RAPID/web/backend/app/services/codebase_service.py && echo "Comment added" || echo "MISSING"
grep -q "polling" /home/kek/Projects/RAPID/.planning/sets/code-graph-backend/DEFERRED.md && echo "Deferred item added" || echo "MISSING"
```

---

## Task 7: Run full test suite -- final regression check

**File:** None (verification only)

**Action:** Run the complete backend test suite to confirm all existing and new tests pass.

**Verification:**
```bash
cd web/backend && uv run pytest tests/ -x -v 2>&1 | tail -40
```
Expected: all tests pass, including the new `TestCodeGraphEndpoint`, `TestFileEndpoint`, and `TestImportExtraction` classes.

---

## Success Criteria

1. `GET /api/projects/{id}/code-graph` returns 200 with `{nodes, edges, total_files, total_edges, scanned_files, truncated}` for a valid project
2. `GET /api/projects/{id}/file?path=<rel>` returns 200 with `{path, content, language, size}` for valid files
3. Path traversal attacks (`..`, symlinks, resolved-outside-root) return 400 or 403
4. Binary files (null bytes) return 400; files >1MB return 400
5. All endpoints use sync `def` (not `async def`)
6. Integration tests cover both endpoints with happy-path and error cases
7. Unit tests cover import extraction for Python, JS, TS and import resolution
8. LRU cache eviction is tested
9. Polling interval deferral is documented
10. Full test suite passes with zero failures
