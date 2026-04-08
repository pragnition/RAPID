# Wave 1 Plan Digest

**Objective:** Lay the groundwork for graph building by adding tree-sitter-typescript, refactoring SUPPORTED_LANGUAGES to 3-tuple format, mapping missing file extensions, and converting parse cache to bounded LRU.
**Tasks:** 5 tasks completed
**Key files:** web/backend/pyproject.toml, web/backend/app/services/codebase_service.py
**Approach:** Added tree-sitter-typescript dependency, refactored SUPPORTED_LANGUAGES from 2-tuple to 3-tuple (module, function_name, extensions) to support typescript's non-standard exports, added TypeScript/TSX symbol queries and classify_kind entries, converted _parse_cache to OrderedDict with 1000-entry LRU eviction.
**Status:** Complete
