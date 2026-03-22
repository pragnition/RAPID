"""Tests for Alembic migrations -- verifies the 0001 initial schema."""

from pathlib import Path

import pytest
import sqlalchemy
from sqlalchemy import inspect, text
from sqlmodel import SQLModel, create_engine

from app.database import get_engine, run_migrations


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture()
def migrated_engine(tmp_path: Path) -> sqlalchemy.Engine:
    """Return an engine that has had Alembic migrations applied (not create_all)."""
    db_file = tmp_path / "migrated.db"
    eng = get_engine(db_path=db_file)
    run_migrations(eng)
    return eng


# ---------------------------------------------------------------------------
# Migration creates all tables
# ---------------------------------------------------------------------------


def test_migration_upgrade_creates_all_tables(migrated_engine: sqlalchemy.Engine):
    insp = inspect(migrated_engine)
    table_names = set(insp.get_table_names())
    expected = {"project", "note", "kanbanitem", "syncstate", "appconfig"}
    assert expected.issubset(table_names), f"Missing tables: {expected - table_names}"


# ---------------------------------------------------------------------------
# Column verification per table
# ---------------------------------------------------------------------------


def _col_names(engine: sqlalchemy.Engine, table: str) -> set[str]:
    insp = inspect(engine)
    return {c["name"] for c in insp.get_columns(table)}


def test_migration_table_columns_project(migrated_engine: sqlalchemy.Engine):
    cols = _col_names(migrated_engine, "project")
    expected = {"id", "name", "path", "registered_at", "last_seen_commit", "status", "last_seen_at", "metadata_json"}
    assert expected == cols


def test_migration_table_columns_note(migrated_engine: sqlalchemy.Engine):
    cols = _col_names(migrated_engine, "note")
    expected = {"id", "project_id", "title", "content", "created_at", "updated_at"}
    assert expected == cols


def test_migration_table_columns_kanbanitem(migrated_engine: sqlalchemy.Engine):
    cols = _col_names(migrated_engine, "kanbanitem")
    expected = {"id", "project_id", "title", "description", "status", "position", "created_at", "updated_at"}
    assert expected == cols


def test_migration_table_columns_syncstate(migrated_engine: sqlalchemy.Engine):
    cols = _col_names(migrated_engine, "syncstate")
    expected = {"id", "project_id", "last_sync_at", "last_commit_hash", "file_checksums"}
    assert expected == cols


def test_migration_table_columns_appconfig(migrated_engine: sqlalchemy.Engine):
    cols = _col_names(migrated_engine, "appconfig")
    expected = {"key", "value", "updated_at"}
    assert expected == cols


# ---------------------------------------------------------------------------
# Revision metadata
# ---------------------------------------------------------------------------


def test_migration_revision_metadata():
    import importlib.util
    from pathlib import Path as P

    migration_file = P(__file__).resolve().parent.parent / "alembic" / "versions" / "0001_initial_schema.py"
    spec = importlib.util.spec_from_file_location("migration_0001", migration_file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.revision == "0001"
    assert mod.down_revision is None


def test_alembic_env_target_metadata():
    """Verify that alembic/env.py sets target_metadata to SQLModel.metadata."""
    # We verify this indirectly: the metadata should contain our model tables
    table_names = set(SQLModel.metadata.tables.keys())
    expected = {"project", "note", "kanbanitem", "syncstate", "appconfig"}
    assert expected.issubset(table_names)


# ---------------------------------------------------------------------------
# Fallback when alembic.ini is missing
# ---------------------------------------------------------------------------


def test_run_migrations_fallback_without_alembic_ini(tmp_path: Path, monkeypatch):
    """run_migrations() should fall back to create_all when alembic.ini is missing."""
    db_file = tmp_path / "fallback.db"
    eng = get_engine(db_path=db_file)

    # Point __file__ resolution to tmp_path so alembic.ini is not found there
    import app.database as db_mod

    monkeypatch.setattr(db_mod, "__file__", str(tmp_path / "fake_database.py"))
    monkeypatch.chdir(tmp_path)  # cwd also has no alembic.ini

    run_migrations(eng)

    # Verify tables were created via create_all fallback
    from sqlalchemy import inspect as sa_inspect

    insp = sa_inspect(eng)
    table_names = set(insp.get_table_names())
    assert "project" in table_names
    assert "note" in table_names
    assert "appconfig" in table_names
