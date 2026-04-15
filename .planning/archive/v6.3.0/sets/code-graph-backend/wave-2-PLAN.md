# PLAN: code-graph-backend / Wave 2 -- Import Extraction and Graph Service

**Set:** code-graph-backend
**Wave:** 2 of 3
**Objective:** Implement per-language import/require extraction via tree-sitter AST queries, build the file-to-file dependency graph, update the cache to store (symbols, edges) tuples, and add the `get_codebase_graph()` service function. Also add Pydantic response schemas for the graph and file-content endpoints.

## Pre-conditions

- Wave 1 is complete: SUPPORTED_LANGUAGES is a 3-tuple, typescript/tsx entries exist, LRU cache works
- tree-sitter-typescript is installed via `uv sync`

---

## Task 1: Add per-language import extraction functions

**File:** `web/backend/app/services/codebase_service.py`

**Action:** Add a set of private functions that extract import paths from a parsed AST root node. Each function returns a `list[str]` of raw import specifiers (the string as written in the source -- resolution to file paths happens later).

1. Add a dispatcher function and per-language extractors after `_classify_kind()` and before `_parse_file()`:

   ```python
   def _extract_imports(root: tree_sitter.Node, language: str) -> list[str]:
       """Extract import/require specifiers from the AST root node."""
       extractors = {
           "python": _extract_python_imports,
           "javascript": _extract_js_imports,
           "typescript": _extract_js_imports,  # same AST shape
           "tsx": _extract_js_imports,          # same AST shape
           "go": _extract_go_imports,
           "rust": _extract_rust_imports,
       }
       fn = extractors.get(language)
       if fn is None:
           return []
       return fn(root)
   ```

2. **Python extractor** -- walk top-level children for `import_statement` and `import_from_statement` nodes:
   - For `import_from_statement`: read the `module_name` field child's text (e.g., `from foo.bar import baz` yields `"foo.bar"`)
   - For `import_statement`: read the `name` field child's text (e.g., `import foo.bar` yields `"foo.bar"`)
   - Return the raw dotted module name strings

3. **JavaScript/TypeScript extractor** -- walk for `import_statement` nodes and `call_expression` nodes:
   - For `import_statement`: find the `source` field child (a `string` node), strip quotes, return the path string
   - For `call_expression`: check if the function child is an `identifier` with text `require`; if so, find the `arguments` child, get the first `string` child, strip quotes, return the path string
   - Only collect specifiers that start with `"."` (relative imports) -- skip bare specifiers like `"react"` or `"fs"` since those cannot map to project files

4. **Go extractor** -- walk for `import_declaration` nodes:
   - Each `import_declaration` contains one or more `import_spec` children
   - Each `import_spec` has a `path` child of type `interpreted_string_literal`
   - Strip quotes and return the path string

5. **Rust extractor** -- walk for `use_declaration` nodes:
   - Extract the full path text from the `use_declaration`'s child (typically `scoped_identifier` or `use_wildcard`)
   - Only collect paths starting with `crate::` (local crate references)
   - Return `"crate::module::submodule"` format strings

**What NOT to do:**
- Do NOT use regex for extraction -- use the parsed AST nodes only
- Do NOT try to resolve specifiers to file paths in these functions -- they return raw strings
- Do NOT extract dynamic imports (`import()` expressions or `__import__()`)
- Do NOT recurse deeply into the AST -- scan top-level children and one level into `import_declaration` blocks

**Verification:**
```bash
cd web/backend && python -c "
import tree_sitter
from app.services.codebase_service import _extract_imports, _get_parser

# Test Python imports
parser = _get_parser('python')
tree = parser.parse(b'import os\nfrom pathlib import Path\nfrom .utils import helper\n')
imports = _extract_imports(tree.root_node, 'python')
assert 'os' in imports, f'Expected os in {imports}'
assert 'pathlib' in imports, f'Expected pathlib in {imports}'
assert '.utils' in imports, f'Expected .utils in {imports}'
print('Python PASS')

# Test JS imports
parser_js = _get_parser('javascript')
tree_js = parser_js.parse(b'import foo from \"./foo\";\nconst bar = require(\"./bar\");\nimport react from \"react\";\n')
imports_js = _extract_imports(tree_js.root_node, 'javascript')
assert './foo' in imports_js, f'Expected ./foo in {imports_js}'
assert './bar' in imports_js, f'Expected ./bar in {imports_js}'
assert 'react' not in imports_js, f'Should not include react in {imports_js}'
print('JS PASS')
"
```

---

## Task 2: Add import path resolution function

**File:** `web/backend/app/services/codebase_service.py`

**Action:** Add a function that resolves a raw import specifier to a file path within the project. This is the bridge between extraction (raw strings) and graph edges (file-to-file).

```python
def _resolve_import_to_file(
    specifier: str,
    source_file: str,
    project_path: str,
    known_files: set[str],
) -> str | None:
```

Parameters:
- `specifier`: raw import string from extraction (e.g., `"./utils"`, `"../lib/foo"`, `".helpers"`)
- `source_file`: absolute path of the file containing the import
- `project_path`: absolute path of the project root
- `known_files`: set of all relative file paths found during the walk (for lookup)

Logic by language pattern:

1. **JS/TS relative imports** (specifier starts with `"./"` or `"../"` or `"."`):
   - Compute candidate absolute path relative to the source file's directory
   - Try the specifier as-is, then with each known extension appended (.js, .jsx, .ts, .tsx, .cjs, .mjs, .cts, .mts), then with `/index` + each extension
   - Return the first match found in `known_files` (as a relative path), or `None`

2. **Python dotted imports** (no slashes):
   - Convert dots to path separators: `foo.bar` becomes `foo/bar`
   - Leading dot means relative to source file's package: `.utils` from `pkg/main.py` becomes `pkg/utils`
   - Try as `foo/bar.py` and `foo/bar/__init__.py`
   - Return the first match found in `known_files`, or `None`

3. **Go imports**: Skip -- Go import paths are module paths, not file paths. Return `None` always. (Go edges would require go.mod resolution which is out of scope.)

4. **Rust `crate::` imports**: Convert `crate::foo::bar` to `src/foo/bar.rs` and `src/foo/bar/mod.rs`. Try both. Return match or `None`.

5. Any specifier that doesn't match these patterns: return `None`.

**What NOT to do:**
- Do NOT follow symlinks during resolution
- Do NOT import `pathlib` for this -- use `os.path` operations for consistency with the rest of the file
- Do NOT try to resolve node_modules or external packages
- Do NOT raise exceptions -- always return `None` for unresolvable imports

**Verification:**
```bash
cd web/backend && python -c "
from app.services.codebase_service import _resolve_import_to_file

known = {'src/utils.py', 'src/lib/foo.js', 'src/lib/index.ts', 'src/main.py'}

# JS relative
result = _resolve_import_to_file('./utils', '/proj/src/main.js', '/proj', known)
# Should not match (utils.py is Python, JS would need .js)
# But utils could match if we try extensions... let's test lib/foo
result2 = _resolve_import_to_file('./lib/foo', '/proj/src/main.js', '/proj', known)
assert result2 == 'src/lib/foo.js', f'Got {result2}'

# JS index resolution
result3 = _resolve_import_to_file('./lib', '/proj/src/main.js', '/proj', known)
assert result3 == 'src/lib/index.ts', f'Got {result3}'

# Python dotted
result4 = _resolve_import_to_file('src.utils', '/proj/main.py', '/proj', known)
assert result4 == 'src/utils.py', f'Got {result4}'

print('PASS')
"
```

---

## Task 3: Update cache value type and _parse_file to extract imports

**File:** `web/backend/app/services/codebase_service.py`

**Action:**

1. Update the cache type annotation:
   ```python
   _parse_cache: OrderedDict[tuple[str, float], tuple[list[dict], list[str]]] = OrderedDict()
   ```
   The value is now `(symbols, raw_imports)` instead of just `symbols`.

2. Update `_parse_file()` to return `tuple[list[dict], list[str]] | None`:
   - After parsing, call `_extract_imports(tree.root_node, language)` to get raw import specifiers
   - Store `(symbols, raw_imports)` in the cache
   - Return `(symbols, raw_imports)`

3. Update the cache-hit path in `_parse_file()` to return the cached tuple.

4. Update `get_codebase_tree()` to unpack the new return type:
   - Where it currently does `symbols = _parse_file(filepath, language)`, change to:
     ```python
     result = _parse_file(filepath, language)
     if result is None:
         ...
         continue
     symbols, _imports = result
     ```
   - The `_imports` are discarded in `get_codebase_tree()` -- they are only used by the new `get_codebase_graph()` (Task 4).

**What NOT to do:**
- Do NOT change the public return type of `get_codebase_tree()` -- it still returns `{"files": [...], ...}`
- Do NOT add import data to the `get_codebase_tree()` response

**Verification:**
```bash
cd web/backend && python -c "
from pathlib import Path
from app.services.codebase_service import _parse_file, get_codebase_tree
import tempfile, os

# Create a small Python file
with tempfile.NamedTemporaryFile(suffix='.py', mode='w', delete=False) as f:
    f.write('import os\nfrom pathlib import Path\ndef hello(): pass\n')
    fpath = f.name

result = _parse_file(fpath, 'python')
assert result is not None
symbols, imports = result
assert isinstance(symbols, list)
assert isinstance(imports, list)
assert len(symbols) == 1  # hello
assert 'os' in imports
assert 'pathlib' in imports
os.unlink(fpath)
print('PASS: _parse_file returns (symbols, imports)')

# Verify get_codebase_tree still works
with tempfile.TemporaryDirectory() as td:
    with open(os.path.join(td, 'test.py'), 'w') as f:
        f.write('def foo(): pass\n')
    tree = get_codebase_tree(Path(td))
    assert 'files' in tree
    assert tree['total_files'] == 1
    print('PASS: get_codebase_tree unchanged')
"
```

---

## Task 4: Implement get_codebase_graph() service function

**File:** `web/backend/app/services/codebase_service.py`

**Action:** Add the `get_codebase_graph()` function after `get_codebase_tree()`. This function walks the project (reusing the same walk logic), extracts symbols AND imports, resolves imports to file edges, and returns a graph structure.

```python
def get_codebase_graph(project_path: Path, max_files: int = 500) -> dict:
```

Implementation:

1. Walk the project directory using the same `os.walk` + `_SKIP_DIRS` pattern as `get_codebase_tree()`.

2. First pass: collect all files into a list with their paths, languages, and sizes. Build `known_files: set[str]` of all relative paths for import resolution. Respect `max_files` limit.

3. Second pass: parse each collected file with `_parse_file()`, getting `(symbols, raw_imports)`. For each file, build a node and resolve each raw import against `known_files`.

4. Build the return dict:
   ```python
   {
       "nodes": [{"id": rel_path, "path": rel_path, "language": lang, "size": size}, ...],
       "edges": [{"source": source_rel, "target": target_rel}, ...],
       "total_files": len(nodes),
       "total_edges": len(edges),
       "scanned_files": file_count,  # before max_files truncation may differ
       "truncated": file_count >= max_files,
       "parse_errors": [...],
       "unresolved_imports": [...],
   }
   ```

5. Edges are deduplicated: if file A imports file B twice (via different specifiers), only one edge `{source: A, target: B}` appears.

6. For unresolved imports: collect specifiers that look like local paths (start with `.` for JS/TS, or start with relative dot for Python) but could not be resolved. External packages are silently dropped, not listed.

7. Files that fail to parse appear as nodes (with their path/language/size) but have no outgoing edges. Their path is added to `parse_errors`.

**What NOT to do:**
- Do NOT duplicate the directory walk logic -- factor it out or inline but keep consistent with `get_codebase_tree()`
- Do NOT include self-edges (file importing itself)
- Do NOT follow symlinks during the walk (same as `get_codebase_tree` which uses `followlinks=False`)

**Verification:**
```bash
cd web/backend && python -c "
import tempfile, os
from pathlib import Path
from app.services.codebase_service import get_codebase_graph

with tempfile.TemporaryDirectory() as td:
    # Create two JS files that import each other
    with open(os.path.join(td, 'main.js'), 'w') as f:
        f.write('import { helper } from \"./utils\";\nfunction main() {}\n')
    with open(os.path.join(td, 'utils.js'), 'w') as f:
        f.write('export function helper() {}\n')

    graph = get_codebase_graph(Path(td))
    print('nodes:', [n['id'] for n in graph['nodes']])
    print('edges:', graph['edges'])
    print('total_files:', graph['total_files'])
    print('total_edges:', graph['total_edges'])
    assert graph['total_files'] == 2
    assert graph['total_edges'] >= 1
    # main.js -> utils.js edge should exist
    edge_pairs = [(e['source'], e['target']) for e in graph['edges']]
    assert ('main.js', 'utils.js') in edge_pairs, f'Missing edge in {edge_pairs}'
    print('PASS')
"
```

---

## Task 5: Add Pydantic schemas for graph and file-content responses

**File:** `web/backend/app/schemas/views.py`

**Action:** Add new schema classes at the bottom of the file, after the Codebase View section.

```python
# ---------------------------------------------------------------------------
# Code Graph View
# ---------------------------------------------------------------------------


class GraphNode(BaseModel):
    id: str
    path: str
    language: str
    size: int


class GraphEdge(BaseModel):
    source: str
    target: str


class CodeGraph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    total_files: int
    total_edges: int
    scanned_files: int
    truncated: bool
    parse_errors: list[str] = []
    unresolved_imports: list[str] = []


# ---------------------------------------------------------------------------
# File Content View
# ---------------------------------------------------------------------------


class FileContent(BaseModel):
    path: str
    content: str
    language: str | None = None
    size: int
```

**What NOT to do:**
- Do NOT add `type` field to `GraphEdge` -- CONTEXT.md specifies flat edges without type metadata
- Do NOT use Field(alias=...) for these schemas -- they match the service dict keys directly

**Verification:**
```bash
cd web/backend && python -c "
from app.schemas.views import GraphNode, GraphEdge, CodeGraph, FileContent

# Test instantiation
node = GraphNode(id='src/main.py', path='src/main.py', language='python', size=1024)
edge = GraphEdge(source='a.py', target='b.py')
graph = CodeGraph(nodes=[node], edges=[edge], total_files=1, total_edges=1, scanned_files=5, truncated=False)
fc = FileContent(path='main.py', content='hello', language='python', size=5)

assert graph.model_dump()['total_edges'] == 1
assert fc.model_dump()['language'] == 'python'
print('PASS')
"
```

---

## Task 6: Run full test suite

**File:** None (verification only)

**Action:** Run the full backend test suite to confirm Wave 2 changes are compatible with all existing functionality.

**Verification:**
```bash
cd web/backend && uv run pytest tests/ -x -q 2>&1 | tail -20
```
Expected: all tests pass. The `get_codebase_tree()` return type is unchanged, so existing endpoint tests should pass without modification.

---

## Success Criteria

1. `_extract_imports()` correctly extracts import specifiers for Python, JS/TS, Go, and Rust ASTs
2. `_resolve_import_to_file()` resolves relative JS/TS imports and Python dotted imports to project files
3. `_parse_file()` returns `(symbols, raw_imports)` tuples; cache stores the same
4. `get_codebase_graph()` produces `{nodes, edges, total_files, total_edges, scanned_files, truncated, parse_errors, unresolved_imports}`
5. Graph edges are deduplicated and exclude self-edges
6. Pydantic schemas `GraphNode`, `GraphEdge`, `CodeGraph`, `FileContent` are defined and importable
7. All existing tests still pass
