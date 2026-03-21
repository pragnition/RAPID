"""Service for parsing project codebase structure using tree-sitter."""

import logging
import os
from pathlib import Path

import tree_sitter

logger = logging.getLogger(__name__)

# Module-level cache: dict mapping (filepath, mtime) -> list of symbols
_parse_cache: dict[tuple[str, float], list[dict]] = {}

# Max file size to parse (1MB)
_MAX_FILE_SIZE = 1_048_576

# Directories to skip during walk
_SKIP_DIRS = frozenset({
    ".git", ".rapid-worktrees", ".planning", "node_modules",
    "__pycache__", ".venv", "venv", "target", "dist", "build",
})

SUPPORTED_LANGUAGES: dict[str, tuple[str, list[str]]] = {
    "python": ("tree_sitter_python", [".py"]),
    "javascript": ("tree_sitter_javascript", [".js", ".jsx", ".ts", ".tsx"]),
    "go": ("tree_sitter_go", [".go"]),
    "rust": ("tree_sitter_rust", [".rs"]),
}

# Node types to extract per language
SYMBOL_QUERIES: dict[str, list[str]] = {
    "python": ["function_definition", "class_definition"],
    "javascript": [
        "function_declaration", "class_declaration",
        "arrow_function", "method_definition",
    ],
    "go": ["function_declaration", "method_declaration", "type_declaration"],
    "rust": ["function_item", "struct_item", "impl_item", "enum_item"],
}

# Map of extension -> language name
_EXT_TO_LANG: dict[str, str] = {}
for _lang_name, (_mod_name, _exts) in SUPPORTED_LANGUAGES.items():
    for _ext in _exts:
        _EXT_TO_LANG[_ext] = _lang_name

# Lazy-loaded parsers: language name -> Parser
_parsers: dict[str, tree_sitter.Parser] = {}


def _get_parser(language: str) -> tree_sitter.Parser | None:
    """Get or create a tree-sitter parser for the given language."""
    if language in _parsers:
        return _parsers[language]

    mod_name = SUPPORTED_LANGUAGES[language][0]
    try:
        mod = __import__(mod_name)
        lang = tree_sitter.Language(mod.language())
        parser = tree_sitter.Parser(lang)
        _parsers[language] = parser
        return parser
    except Exception:
        logger.warning("Failed to load tree-sitter grammar for %s", language)
        return None


def _get_symbol_name(node: tree_sitter.Node, language: str) -> str:
    """Extract the name identifier from an AST node."""
    # For most node types, the name is in the first 'identifier' child
    # For Rust structs/enums, look for 'type_identifier'
    for child in node.children:
        if child.type == "identifier":
            return child.text.decode("utf-8") if isinstance(child.text, bytes) else child.text
        if child.type == "type_identifier":
            return child.text.decode("utf-8") if isinstance(child.text, bytes) else child.text
        # For Go type declarations, the spec child has the name
        if child.type == "type_spec":
            for gc in child.children:
                if gc.type == "type_identifier":
                    return gc.text.decode("utf-8") if isinstance(gc.text, bytes) else gc.text
    return "<anonymous>"


def _extract_symbols(node: tree_sitter.Node, language: str, depth: int = 0) -> list[dict]:
    """Walk AST and extract top-level symbols. Recurse one level for class methods."""
    target_types = SYMBOL_QUERIES.get(language, [])
    symbols = []

    for child in node.children:
        if child.type in target_types:
            name = _get_symbol_name(child, language)
            kind = _classify_kind(child.type)
            symbol: dict = {
                "name": name,
                "kind": kind,
                "start_line": child.start_point.row + 1,
                "end_line": child.end_point.row + 1,
                "children": [],
            }

            # Recurse one level for container types (classes, structs, impls)
            if depth == 0 and kind in ("class", "struct", "impl"):
                body = child.child_by_field_name("body")
                if body is not None:
                    symbol["children"] = _extract_symbols(body, language, depth=1)

            symbols.append(symbol)

    return symbols


def _classify_kind(node_type: str) -> str:
    """Map tree-sitter node type to a simplified kind string."""
    mapping = {
        "function_definition": "function",
        "function_declaration": "function",
        "function_item": "function",
        "arrow_function": "function",
        "method_definition": "method",
        "method_declaration": "method",
        "class_definition": "class",
        "class_declaration": "class",
        "type_declaration": "type",
        "struct_item": "struct",
        "impl_item": "impl",
        "enum_item": "enum",
    }
    return mapping.get(node_type, "unknown")


def _parse_file(filepath: str, language: str) -> list[dict] | None:
    """Parse a single file and return symbols, using mtime cache."""
    try:
        mtime = os.path.getmtime(filepath)
    except OSError:
        return None

    cache_key = (filepath, mtime)
    if cache_key in _parse_cache:
        return _parse_cache[cache_key]

    try:
        size = os.path.getsize(filepath)
        if size > _MAX_FILE_SIZE:
            return None  # caller adds to parse_errors

        with open(filepath, "rb") as f:
            source = f.read()
    except OSError:
        return None

    parser = _get_parser(language)
    if parser is None:
        return None

    try:
        tree = parser.parse(source)
        symbols = _extract_symbols(tree.root_node, language)
        _parse_cache[cache_key] = symbols
        return symbols
    except Exception:
        logger.debug("tree-sitter parse failed for %s", filepath)
        return None


def get_codebase_tree(project_path: Path, max_files: int = 500) -> dict:
    """Walk project directory, parse supported files with tree-sitter, return symbol tree.

    Returns dict with keys: files, languages, total_files, parse_errors.

    Skips directories: .git, .rapid-worktrees, .planning, node_modules,
    __pycache__, .venv, venv, target, dist, build
    """
    files: list[dict] = []
    languages_found: set[str] = set()
    parse_errors: list[str] = []
    file_count = 0

    project_str = str(project_path)

    for dirpath, dirnames, filenames in os.walk(project_path, followlinks=False):
        # Filter out skip directories in-place
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]

        for filename in filenames:
            if file_count >= max_files:
                break

            ext = os.path.splitext(filename)[1]
            language = _EXT_TO_LANG.get(ext)
            if language is None:
                continue

            filepath = os.path.join(dirpath, filename)
            file_count += 1

            # Check size before parsing
            try:
                size = os.path.getsize(filepath)
            except OSError:
                parse_errors.append(f"Cannot stat: {filepath}")
                continue

            if size > _MAX_FILE_SIZE:
                rel = os.path.relpath(filepath, project_str)
                parse_errors.append(f"File too large (>{_MAX_FILE_SIZE} bytes): {rel}")
                continue

            symbols = _parse_file(filepath, language)
            if symbols is None:
                rel = os.path.relpath(filepath, project_str)
                parse_errors.append(f"Parse failed: {rel}")
                continue

            rel = os.path.relpath(filepath, project_str)
            languages_found.add(language)
            files.append({
                "path": rel,
                "language": language,
                "symbols": symbols,
            })

        if file_count >= max_files:
            break

    return {
        "files": files,
        "languages": sorted(languages_found),
        "total_files": len(files),
        "parse_errors": parse_errors,
    }
