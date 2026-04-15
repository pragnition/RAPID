"""Tests for Alembic migration 0005 (agentprompt table).

Mirrors the structure of ``test_migration_0004.py``.
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

    alembic_ini = Path(__file__).resolve().parent.parent.parent / "alembic.ini"
    cfg = Config(str(alembic_ini))
    return cfg


_EXPECTED_COLUMNS = {
    "id",
    "run_id",
    "kind",
    "payload",
    "status",
    "answer",
    "created_at",
    "answered_at",
    "consumed_at",
    "batch_id",
    "batch_position",
}


def test_upgrade_creates_agentprompt_table_with_expected_columns(
    engine_at_head: sqlalchemy.Engine,
) -> None:
    insp = inspect(engine_at_head)
    tables = set(insp.get_table_names())
    assert "agentprompt" in tables

    cols = {c["name"] for c in insp.get_columns("agentprompt")}
    assert _EXPECTED_COLUMNS.issubset(cols), (
        f"missing columns: {_EXPECTED_COLUMNS - cols}"
    )


def test_upgrade_creates_partial_unique_index(
    engine_at_head: sqlalchemy.Engine,
) -> None:
    with engine_at_head.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT name, sql FROM sqlite_master "
                "WHERE type='index' AND name='uq_agent_prompt_run_pending'"
            )
        ).fetchall()
        assert len(rows) == 1
        ddl = rows[0][1]
        assert ddl is not None
        upper = ddl.upper()
        # WHERE clause for the partial index — value depends on quoting style.
        assert "STATUS" in upper
        assert "PENDING" in upper


def test_upgrade_creates_composite_index(
    engine_at_head: sqlalchemy.Engine,
) -> None:
    with engine_at_head.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT name FROM sqlite_master "
                "WHERE type='index' AND name='ix_agent_prompt_run_created'"
            )
        ).fetchall()
        assert len(rows) == 1


def test_downgrade_drops_table_and_reupgrade_restores(
    tmp_path: Path, monkeypatch
) -> None:
    from alembic import command

    import app.database as db_mod

    db_file = tmp_path / "roundtrip.db"
    monkeypatch.setattr(db_mod.settings, "rapid_web_db_path", db_file)

    eng = get_engine(db_path=db_file)
    cfg = _alembic_cfg_for(db_file)
    cfg.attributes["engine"] = eng

    command.upgrade(cfg, "head")
    insp = inspect(eng)
    assert "agentprompt" in set(insp.get_table_names())

    # Step back one revision and confirm agentprompt is gone (0004 is the
    # immediate predecessor of 0005).
    command.downgrade(cfg, "0004")
    insp = inspect(eng)
    tables_after_down = set(insp.get_table_names())
    assert "agentprompt" not in tables_after_down
    # 0004's tables still present.
    assert "agentrun" in tables_after_down
    assert "agentevent" in tables_after_down

    # Re-upgrade restores agentprompt.
    command.upgrade(cfg, "head")
    insp = inspect(eng)
    tables_after_up = set(insp.get_table_names())
    assert "agentprompt" in tables_after_up
