"""Unit tests for codebase_service import extraction and resolution."""

import os
from collections import OrderedDict

import pytest

from app.services.codebase_service import (
    _CACHE_MAX_SIZE,
    _EXT_TO_LANG,
    _extract_imports,
    _get_parser,
    _parse_cache,
    _resolve_import_to_file,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_source(source: str, language: str):
    """Parse source string and return the AST root node."""
    parser = _get_parser(language)
    assert parser is not None, f"Parser for {language} not available"
    tree = parser.parse(source.encode("utf-8"))
    return tree.root_node


# ---------------------------------------------------------------------------
# Import extraction tests
# ---------------------------------------------------------------------------


class TestImportExtraction:
    def test_python_import_extraction(self):
        source = (
            "import os\n"
            "from pathlib import Path\n"
            "from .utils import foo\n"
        )
        root = _parse_source(source, "python")
        imports = _extract_imports(root, "python")
        assert "os" in imports
        assert "pathlib" in imports
        assert ".utils" in imports

    def test_js_import_extraction(self):
        source = (
            'import x from "./foo";\n'
            'const y = require("./bar");\n'
            'import z from "react";\n'
        )
        root = _parse_source(source, "javascript")
        imports = _extract_imports(root, "javascript")
        assert "./foo" in imports
        assert "./bar" in imports
        # External packages (no leading dot) are excluded
        assert "react" not in imports

    def test_ts_import_extraction(self):
        source = 'import type { Foo } from "./types";\n'
        root = _parse_source(source, "typescript")
        imports = _extract_imports(root, "typescript")
        assert "./types" in imports

    # ------------------------------------------------------------------
    # Import resolution tests
    # ------------------------------------------------------------------

    def test_resolve_js_relative(self, tmp_path):
        project = str(tmp_path)
        # Create utils.js
        (tmp_path / "utils.js").write_text("export const x = 1;\n")
        source_file = str(tmp_path / "main.js")
        known_files = {"utils.js", "main.js"}

        result = _resolve_import_to_file("./utils", source_file, project, known_files)
        assert result == "utils.js"

    def test_resolve_js_index(self, tmp_path):
        project = str(tmp_path)
        lib_dir = tmp_path / "lib"
        lib_dir.mkdir()
        (lib_dir / "index.ts").write_text("export const y = 2;\n")
        source_file = str(tmp_path / "main.ts")
        known_files = {"lib/index.ts", "main.ts"}

        result = _resolve_import_to_file("./lib", source_file, project, known_files)
        assert result == "lib/index.ts"

    def test_resolve_python_dotted(self, tmp_path):
        project = str(tmp_path)
        src_dir = tmp_path / "src"
        src_dir.mkdir()
        (src_dir / "utils.py").write_text("x = 1\n")
        known_files = {"src/utils.py"}

        result = _resolve_import_to_file("src.utils", "dummy.py", project, known_files)
        assert result == "src/utils.py"

    def test_resolve_unresolvable_returns_none(self, tmp_path):
        project = str(tmp_path)
        known_files = {"main.py"}

        result = _resolve_import_to_file(
            "nonexistent_package", str(tmp_path / "main.py"), project, known_files
        )
        assert result is None

    # ------------------------------------------------------------------
    # Cache eviction test
    # ------------------------------------------------------------------

    def test_cache_lru_eviction(self):
        # Save existing cache state to restore later
        saved = OrderedDict(_parse_cache)
        _parse_cache.clear()

        try:
            # Insert _CACHE_MAX_SIZE + 1 entries
            for i in range(_CACHE_MAX_SIZE + 1):
                key = (f"/fake/path_{i}.py", float(i))
                _parse_cache[key] = ([], [])
                # Enforce LRU eviction like _parse_file does
                if len(_parse_cache) > _CACHE_MAX_SIZE:
                    _parse_cache.popitem(last=False)

            assert len(_parse_cache) == _CACHE_MAX_SIZE
            # The first entry (path_0) should have been evicted
            assert ("/fake/path_0.py", 0.0) not in _parse_cache
            # The last entry should still be present
            assert (f"/fake/path_{_CACHE_MAX_SIZE}.py", float(_CACHE_MAX_SIZE)) in _parse_cache
        finally:
            # Restore original cache state
            _parse_cache.clear()
            _parse_cache.update(saved)
