import json
from pathlib import Path


def _read_version() -> str:
    """Read version from the root package.json (single source of truth)."""
    try:
        pkg = (
            Path(__file__).resolve().parent.parent.parent.parent / "package.json"
        )
        return json.loads(pkg.read_text(encoding="utf-8"))["version"]
    except (FileNotFoundError, KeyError, json.JSONDecodeError):
        return "0.0.0"


__version__ = _read_version()
