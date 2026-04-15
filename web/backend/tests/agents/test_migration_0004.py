"""Tests for Alembic migration 0004 (agent runtime tables)."""

from __future__ import annotations

from pathlib import Path

import pytest
import sqlalchemy
from sqlalchemy import inspect, text

from app.database import get_engine, run_migrations


@pytest.fixture()
def engine_at_head(tmp_path: Path, monkeypatch) -> sqlalchemy.Engine:
    """Engine with migrations upgraded to head via alembic command."""
    import app.database as db_mod

    db_file = tmp_path / "mig.db"
    # Redirect settings so alembic env.py points at the tmp db
    monkeypatch.setattr(db_mod.settings, "rapid_web_db_path", db_file)

    eng = get_engine(db_path=db_file)
    run_migrations(eng)
    return eng


def _alembic_cfg_for(db_file: Path):
    from alembic.config import Config

    alembic_ini = Path(__file__).resolve().parent.parent.parent / "alembic.ini"
    cfg = Config(str(alembic_ini))
    return cfg


def test_upgrade_downgrade_upgrade_roundtrip(tmp_path: Path, monkeypatch):
    from alembic import command

    import app.database as db_mod

    db_file = tmp_path / "roundtrip.db"
    monkeypatch.setattr(db_mod.settings, "rapid_web_db_path", db_file)

    eng = get_engine(db_path=db_file)
    cfg = _alembic_cfg_for(db_file)
    cfg.attributes["engine"] = eng

    command.upgrade(cfg, "head")

    insp = inspect(eng)
    tables = set(insp.get_table_names())
    assert "agentrun" in tables
    assert "agentevent" in tables

    # Verify the partial unique index exists
    with eng.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT name FROM sqlite_master "
                "WHERE type='index' AND name='uq_agent_run_active_set'"
            )
        ).fetchall()
        assert len(rows) == 1

    # Downgrade to 0003 drops the agent tables (regardless of current head).
    command.downgrade(cfg, "0003")
    insp = inspect(eng)
    tables = set(insp.get_table_names())
    assert "agentrun" not in tables
    assert "agentevent" not in tables

    # Re-upgrade restores them.
    command.upgrade(cfg, "head")
    insp = inspect(eng)
    tables = set(insp.get_table_names())
    assert "agentrun" in tables
    assert "agentevent" in tables


def test_partial_index_sql_shape(engine_at_head: sqlalchemy.Engine):
    with engine_at_head.connect() as conn:
        row = conn.execute(
            text(
                "SELECT sql FROM sqlite_master "
                "WHERE type='index' AND name='uq_agent_run_active_set'"
            )
        ).fetchone()
        assert row is not None
        ddl = row[0]
        assert ddl is not None
        upper = ddl.upper()
        # Ensure the partial predicate is actually present (case-insensitive).
        assert "STATUS" in upper
        assert "IN" in upper
        assert "RUNNING" in upper
        assert "WAITING" in upper
