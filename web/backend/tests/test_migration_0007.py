"""Tests for Alembic migration 0007 (chat persistence tables).

Mirrors the structure of ``tests/agents/test_migration_0005.py``.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import sqlalchemy
from sqlalchemy import inspect, text

from app.database import get_engine, run_migrations


@pytest.fixture()
def engine_at_head(tmp_path: Path, monkeypatch) -> sqlalchemy.Engine:
    import app.database as db_mod

    db_file = tmp_path / "mig.db"
    monkeypatch.setattr(db_mod.settings, "rapid_web_db_path", db_file)

    eng = get_engine(db_path=db_file)
    run_migrations(eng)
    return eng


def _alembic_cfg_for(_db_file: Path):
    from alembic.config import Config

    alembic_ini = Path(__file__).resolve().parent.parent / "alembic.ini"
    cfg = Config(str(alembic_ini))
    return cfg


def test_migration_0007_creates_tables(engine_at_head: sqlalchemy.Engine) -> None:
    """All three chat tables must exist after upgrade to head."""
    insp = inspect(engine_at_head)
    tables = set(insp.get_table_names())
    assert "chat" in tables
    assert "chatmessage" in tables
    assert "chatattachment" in tables


_CHAT_EXPECTED_COLUMNS = {
    "id",
    "project_id",
    "skill_name",
    "title",
    "session_status",
    "created_at",
    "last_message_at",
    "archived_at",
}


def test_migration_0007_columns_chat(engine_at_head: sqlalchemy.Engine) -> None:
    """Chat table must have all expected columns."""
    insp = inspect(engine_at_head)
    cols = {c["name"] for c in insp.get_columns("chat")}
    assert _CHAT_EXPECTED_COLUMNS.issubset(cols), (
        f"missing columns: {_CHAT_EXPECTED_COLUMNS - cols}"
    )


_CHATMESSAGE_EXPECTED_COLUMNS = {
    "id",
    "chat_id",
    "seq",
    "role",
    "content",
    "tool_calls",
    "tool_use_id",
    "agent_run_id",
    "temp_id",
    "created_at",
}


def test_migration_0007_columns_chatmessage(engine_at_head: sqlalchemy.Engine) -> None:
    """ChatMessage table must have all expected columns."""
    insp = inspect(engine_at_head)
    cols = {c["name"] for c in insp.get_columns("chatmessage")}
    assert _CHATMESSAGE_EXPECTED_COLUMNS.issubset(cols), (
        f"missing columns: {_CHATMESSAGE_EXPECTED_COLUMNS - cols}"
    )


def test_migration_0007_unique_index_chat_seq(engine_at_head: sqlalchemy.Engine) -> None:
    """The composite unique index on (chat_id, seq) must exist."""
    with engine_at_head.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT name FROM sqlite_master "
                "WHERE type='index' AND name='uq_chat_message_chat_seq'"
            )
        ).fetchall()
        assert len(rows) == 1


def test_migration_0007_downgrade_roundtrip(tmp_path: Path, monkeypatch) -> None:
    """upgrade -> downgrade -> tables gone -> upgrade -> tables back."""
    from alembic import command

    import app.database as db_mod

    db_file = tmp_path / "roundtrip.db"
    monkeypatch.setattr(db_mod.settings, "rapid_web_db_path", db_file)

    eng = get_engine(db_path=db_file)
    cfg = _alembic_cfg_for(db_file)
    cfg.attributes["engine"] = eng

    # Upgrade to head
    command.upgrade(cfg, "head")
    insp = inspect(eng)
    assert "chat" in set(insp.get_table_names())

    # Downgrade one step -- chat tables should be gone
    command.downgrade(cfg, "0006")
    insp = inspect(eng)
    tables_after_down = set(insp.get_table_names())
    assert "chat" not in tables_after_down
    assert "chatmessage" not in tables_after_down
    assert "chatattachment" not in tables_after_down
    # 0006's tables still present
    assert "agentrun" in tables_after_down

    # Re-upgrade restores tables
    command.upgrade(cfg, "head")
    insp = inspect(eng)
    tables_after_up = set(insp.get_table_names())
    assert "chat" in tables_after_up
    assert "chatmessage" in tables_after_up
    assert "chatattachment" in tables_after_up


def test_migration_0007_revision_metadata() -> None:
    """Verify revision and down_revision values."""
    import importlib
    import sys

    alembic_dir = Path(__file__).resolve().parent.parent / "alembic" / "versions"
    sys.path.insert(0, str(alembic_dir))
    try:
        mod = importlib.import_module("0007_chat_persistence")
        assert mod.revision == "0007"
        assert mod.down_revision == "0006"
    finally:
        sys.path.pop(0)
