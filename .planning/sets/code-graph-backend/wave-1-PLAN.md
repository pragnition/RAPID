# PLAN: code-graph-backend / Wave 1 -- Foundation

**Set:** code-graph-backend
**Wave:** 1 of 3
**Objective:** Lay the groundwork for graph building by adding tree-sitter-typescript as a dependency, refactoring SUPPORTED_LANGUAGES to support per-language function names, mapping all missing file extensions, and converting the parse cache to a bounded LRU.

## Pre-conditions

- Working directory is the code-graph-backend worktree
- `web/backend/pyproject.toml` is the dependency manifest
- `web/backend/app/services/codebase_service.py` contains all parser infrastructure

---

## Task 1: Add tree-sitter-typescript dependency

**File:** `web/backend/pyproject.toml`

**Action:** Add `"tree-sitter-typescript>=0.23,<1.0"` to the `dependencies` list, directly after the `tree-sitter-javascript` line.

**Verification:**
```bash
cd web/backend && grep 'tree-sitter-typescript' pyproject.toml
```
Expected: line containing `"tree-sitter-typescript>=0.23,<1.0"`

---

## Task 2: Refactor SUPPORTED_LANGUAGES to 3-tuple format

**File:** `web/backend/app/services/codebase_service.py`

**Why:** `tree_sitter_typescript` exports `language_typescript()` and `language_tsx()` -- NOT `language()`. Every other language package exports `language()`. The current 2-tuple `(module_name, [extensions])` cannot express this difference.

**Action:**

1. Change the `SUPPORTED_LANGUAGES` type annotation from `dict[str, tuple[str, list[str]]]` to `dict[str, tuple[str, str, list[str]]]` (adding function name as the second element).

2. Rewrite the dict entries to 3-tuples:
   ```python
   SUPPORTED_LANGUAGES: dict[str, tuple[str, str, list[str]]] = {
       "python":     ("tree_sitter_python",     "language",            [".py"]),
       "javascript": ("tree_sitter_javascript", "language",            [".js", ".jsx", ".cjs", ".mjs"]),
       "typescript": ("tree_sitter_typescript", "language_typescript", [".ts", ".cts", ".mts"]),
       "tsx":        ("tree_sitter_typescript", "language_tsx",        [".tsx"]),
       "go":         ("tree_sitter_go",         "language",            [".go"]),
       "rust":       ("tree_sitter_rust",       "language",            [".rs"]),
   }
   ```
   Note: `.cjs` and `.mjs` are added to javascript; `.cts` and `.mts` go to typescript. `.tsx` becomes its own language entry. The old javascript entry had `.ts` and `.tsx` -- those are removed from javascript.

3. Update the `_EXT_TO_LANG` builder loop to unpack the new 3-tuple:
   ```python
   for _lang_name, (_mod_name, _func_name, _exts) in SUPPORTED_LANGUAGES.items():
       for _ext in _exts:
           _EXT_TO_LANG[_ext] = _lang_name
   ```

4. Update `_get_parser()` to use the function name from the tuple:
   ```python
   def _get_parser(language: str) -> tree_sitter.Parser | None:
       if language in _parsers:
           return _parsers[language]
       mod_name, func_name, _ = SUPPORTED_LANGUAGES[language]
       try:
           mod = __import__(mod_name)
           lang = tree_sitter.Language(getattr(mod, func_name)())
           parser = tree_sitter.Parser(lang)
           _parsers[language] = parser
           return parser
       except Exception:
           logger.warning("Failed to load tree-sitter grammar for %s", language)
           return None
   ```

**What NOT to do:**
- Do NOT add a fallback to `mod.language()` -- every entry explicitly specifies its function name.
- Do NOT change the `_parsers` cache key format -- it remains the language string.

**Verification:**
```bash
cd web/backend && python -c "
from app.services.codebase_service import SUPPORTED_LANGUAGES, _EXT_TO_LANG
assert len(SUPPORTED_LANGUAGES) == 6
assert _EXT_TO_LANG['.ts'] == 'typescript'
assert _EXT_TO_LANG['.tsx'] == 'tsx'
assert _EXT_TO_LANG['.cjs'] == 'javascript'
assert _EXT_TO_LANG['.mjs'] == 'javascript'
assert _EXT_TO_LANG['.cts'] == 'typescript'
assert _EXT_TO_LANG['.mts'] == 'typescript'
assert '.ts' not in dict(SUPPORTED_LANGUAGES['javascript'][2:])  # not in JS exts
print('PASS')
"
```

---

## Task 3: Add TypeScript symbol queries and classify_kind entries

**File:** `web/backend/app/services/codebase_service.py`

**Action:**

1. Add entries to `SYMBOL_QUERIES` for `typescript` and `tsx`:
   ```python
   "typescript": [
       "function_declaration", "class_declaration",
       "arrow_function", "method_definition",
       "interface_declaration", "type_alias_declaration", "enum_declaration",
   ],
   "tsx": [
       "function_declaration", "class_declaration",
       "arrow_function", "method_definition",
       "interface_declaration", "type_alias_declaration", "enum_declaration",
   ],
   ```

2. Add 3 new entries to the `mapping` dict inside `_classify_kind()`:
   ```python
   "interface_declaration": "interface",
   "type_alias_declaration": "type",
   "enum_declaration": "enum",
   ```

**What NOT to do:**
- Do NOT merge typescript and tsx into a shared variable reference -- keep them as two separate dict entries for explicitness.
- Do NOT remove the existing `"enum_item": "enum"` entry (that is for Rust).

**Verification:**
```bash
cd web/backend && python -c "
from app.services.codebase_service import SYMBOL_QUERIES, _classify_kind
assert 'typescript' in SYMBOL_QUERIES
assert 'tsx' in SYMBOL_QUERIES
assert 'interface_declaration' in SYMBOL_QUERIES['typescript']
assert _classify_kind('interface_declaration') == 'interface'
assert _classify_kind('type_alias_declaration') == 'type'
assert _classify_kind('enum_declaration') == 'enum'
# Existing entries still work
assert _classify_kind('enum_item') == 'enum'
print('PASS')
"
```

---

## Task 4: Convert _parse_cache to bounded LRU

**File:** `web/backend/app/services/codebase_service.py`

**Action:**

1. Add `from collections import OrderedDict` to the imports section.

2. Add a constant `_CACHE_MAX_SIZE = 1000` after `_MAX_FILE_SIZE`.

3. Change the cache declaration from:
   ```python
   _parse_cache: dict[tuple[str, float], list[dict]] = {}
   ```
   to:
   ```python
   _parse_cache: OrderedDict[tuple[str, float], list[dict]] = OrderedDict()
   ```

4. In `_parse_file()`, after the cache hit check (`if cache_key in _parse_cache`), add LRU touch:
   ```python
   if cache_key in _parse_cache:
       _parse_cache.move_to_end(cache_key)
       return _parse_cache[cache_key]
   ```

5. In `_parse_file()`, after `_parse_cache[cache_key] = symbols`, add eviction:
   ```python
   _parse_cache[cache_key] = symbols
   if len(_parse_cache) > _CACHE_MAX_SIZE:
       _parse_cache.popitem(last=False)
   ```

**What NOT to do:**
- Do NOT use `functools.lru_cache` -- the cache key includes mtime and the cache stores mutable dicts.
- Do NOT change the cache value type yet -- that happens in Wave 2 when edges are added.

**Verification:**
```bash
cd web/backend && python -c "
from collections import OrderedDict
from app.services.codebase_service import _parse_cache, _CACHE_MAX_SIZE
assert isinstance(_parse_cache, OrderedDict), f'Expected OrderedDict, got {type(_parse_cache)}'
assert _CACHE_MAX_SIZE == 1000
print('PASS')
"
```

---

## Task 5: Run existing test suite to confirm no regressions

**File:** None (verification only)

**Action:** Run the full backend test suite to confirm that the SUPPORTED_LANGUAGES refactor did not break existing parsing, and that the LRU cache conversion is transparent to callers.

**Verification:**
```bash
cd web/backend && uv run pytest tests/ -x -q 2>&1 | tail -20
```
Expected: all tests pass. If tree-sitter-typescript is not yet installed, the `_get_parser("typescript")` path will return `None` gracefully -- existing tests only exercise Python parsing.

If `uv sync` is needed first:
```bash
cd web/backend && uv sync && uv run pytest tests/ -x -q
```

---

## Success Criteria

1. `pyproject.toml` lists `tree-sitter-typescript>=0.23,<1.0`
2. `SUPPORTED_LANGUAGES` has 6 entries (python, javascript, typescript, tsx, go, rust) as 3-tuples
3. `.cjs`, `.mjs` mapped to javascript; `.ts`, `.cts`, `.mts` mapped to typescript; `.tsx` mapped to tsx
4. `SYMBOL_QUERIES` has entries for typescript and tsx with interface/type_alias/enum nodes
5. `_classify_kind` maps interface_declaration, type_alias_declaration, enum_declaration correctly
6. `_parse_cache` is an `OrderedDict` with eviction at 1000 entries
7. All existing tests pass
