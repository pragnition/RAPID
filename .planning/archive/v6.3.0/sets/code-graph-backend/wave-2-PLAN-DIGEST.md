# Wave 2 Plan Digest

**Objective:** Implement per-language import extraction via tree-sitter AST queries, build file-to-file dependency graph, update cache to store (symbols, imports) tuples, and add Pydantic response schemas.
**Tasks:** 6 tasks completed
**Key files:** web/backend/app/services/codebase_service.py, web/backend/app/schemas/views.py
**Approach:** Added _extract_imports dispatcher with per-language extractors (Python, JS/TS, Go, Rust) using AST node traversal. Added _resolve_import_to_file with extension/index probing for JS/TS, dotted-path resolution for Python, and crate:: resolution for Rust. Updated _parse_file cache to store (symbols, raw_imports) tuples. Implemented get_codebase_graph() with two-pass walk, deduplicated edges, and unresolved import tracking. Added GraphNode, GraphEdge, CodeGraph, FileContent Pydantic schemas.
**Status:** Complete
