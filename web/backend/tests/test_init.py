"""Tests for app/__init__.py — version metadata."""

from app import __version__


def test_version_is_string():
    assert isinstance(__version__, str)


def test_version_matches_pyproject():
    from pathlib import Path
    import tomllib

    pyproject = Path(__file__).resolve().parent.parent / "pyproject.toml"
    with open(pyproject, "rb") as f:
        data = tomllib.load(f)
    assert __version__ == data["project"]["version"]
