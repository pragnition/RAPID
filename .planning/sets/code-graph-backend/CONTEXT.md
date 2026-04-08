# CONTEXT: code-graph-backend

**Set:** code-graph-backend
**Generated:** 2026-04-08
**Mode:** interactive

<domain>
## Set Boundary
Extend the existing tree-sitter-based `codebase_service.py` to support full codebase dependency graph generation. This includes: adding missing file extension support (.cjs, .mjs, .cts, .mts), adding tree-sitter-typescript as a proper language, implementing import/require extraction to build file-to-file dependency edges, creating two new API endpoints (/code-graph and /file), bounding the parse cache with LRU eviction, and tuning the codebase polling interval.

Owned files: `codebase_service.py`, `routers/views.py`, `schemas/views.py`, `pyproject.toml`.
</domain>

<decisions>
## Implementation Decisions

### Import Extraction Approach
- Use tree-sitter AST queries for import extraction, not regex
- Static imports only (import/require/from statements) -- no dynamic imports
- **Rationale:** The parsed AST is already available from the existing tree-sitter pass, making AST-based extraction both more accurate and zero-cost for I/O. Static-only keeps the scope bounded since the frontend needs structural dependencies, not runtime behavior.

### Service Function Architecture
- Single-pass extension: add import extraction alongside symbol extraction in the existing get_codebase_tree() walk
- get_codebase_graph() returns graph + symbols combined in one response
- **Rationale:** Single-pass avoids redundant I/O and parsing. Combined response lets the frontend fetch everything in one call rather than hitting two separate endpoints, reducing latency and simplifying the frontend data layer.

### Cache Eviction Strategy
- Use collections.OrderedDict with manual LRU eviction (move_to_end + popitem)
- Single cache stores both symbols and import edges per file (same mtime key)
- **Rationale:** Stdlib-only avoids adding a dependency for a simple need. Shared cache entries simplify invalidation since both data types are derived from the same parse pass and share the same mtime-based key.

### TypeScript Language Handling
- Fully separate 'typescript' language entry in SUPPORTED_LANGUAGES with its own grammar and symbol queries
- Include TypeScript-specific constructs: interfaces, type aliases, and enums in symbol extraction
- **Rationale:** TypeScript's grammar differs meaningfully from JavaScript. A separate entry allows correct parsing and extraction of TS-specific structural elements that are invisible to the JS grammar.

### Graph Response Bounding
- Reuse the existing max_files parameter to cap graph size
- Add `truncated: bool` and `scanned_files: int` fields to the response
- **Rationale:** max_files naturally bounds both nodes and edges without adding a second parameter. Truncation signaling lets the frontend display "Showing N of M files" for transparency.

### Edge Type Granularity
- Flat file-to-file edges with no type metadata
- Drop unresolvable imports (external packages, stdlib) -- only create edges between files in the scanned set
- **Rationale:** The code graph frontend's primary use case is dependency visualization, not import semantics analysis. Flat edges keep the payload small and the schema simple.

### File Endpoint Security Model
- Reject all symlinks entirely (don't follow, don't resolve)
- Use null-byte detection (first 8KB) + 1MB size limit for binary file rejection
- **Rationale:** Total symlink rejection is the simplest and most secure approach, aligning with the CONTRACT behavioral spec. Null-byte detection is more reliable than extension allowlists for identifying binary content.

### Error Resilience in Graph Building
- Unparseable files appear as orphan nodes without edges; failures listed in parse_errors
- Broken local imports (look like local paths but don't resolve) reported in a separate `unresolved_imports` field
- **Rationale:** Including unparseable files as orphan nodes prevents silent data loss. Separating unresolved imports from the edge graph keeps the graph clean while still surfacing potential code quality issues.
</decisions>

<specifics>
## Specific Ideas
- Cache stores tuples of (symbols, edges) per file entry, keyed by (filepath, mtime)
- TypeScript symbol queries should include: function_declaration, class_declaration, arrow_function, method_definition, interface_declaration, type_alias_declaration, enum_declaration
- Per-language AST import extraction functions (Python: import_statement/import_from_statement, JS/TS: import_statement/call_expression[require], Go: import_declaration, Rust: use_declaration)
- Graph node schema: { id, path, language, size } -- id is the relative file path
- Graph edge schema: { source, target } -- flat, no type field
</specifics>

<code_context>
## Existing Code Insights
- `codebase_service.py` already has lazy parser loading via `_get_parser()`, directory walking with `_SKIP_DIRS`, and file size limits via `_MAX_FILE_SIZE`
- `_parse_cache` is currently a plain dict keyed by `(filepath, mtime)` -- convert to OrderedDict with maxsize
- `_EXT_TO_LANG` mapping is auto-built from `SUPPORTED_LANGUAGES` -- adding new entries there automatically populates the extension map
- `views.py` has 4 existing endpoints all following the same pattern: get_db dependency, _get_project lookup, service call, schema return
- `schemas/views.py` uses Pydantic BaseModel with `model_config = {"populate_by_name": True}` for alias support
- `pyproject.toml` pins tree-sitter>=0.24,<1.0 with per-language grammars at >=0.23,<1.0 -- tree-sitter-typescript should follow the same version range
- All existing endpoints use synchronous `def` (not `async def`) -- new endpoints must follow the same pattern per CONTRACT behavioral spec
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
