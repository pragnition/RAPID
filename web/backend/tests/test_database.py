"""Tests for app.database -- models, engine, and session management."""

from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import pytest
import sqlalchemy
from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, select

from app.database import (
    AppConfig,
    KanbanItem,
    Note,
    Project,
    SyncState,
    _utcnow,
    get_engine,
    get_session,
)


# ---------------------------------------------------------------------------
# _utcnow helper
# ---------------------------------------------------------------------------


def test_utcnow_returns_utc_datetime():
    result = _utcnow()
    assert isinstance(result, datetime)
    assert result.tzinfo is not None
    assert result.tzinfo == timezone.utc


# ---------------------------------------------------------------------------
# Model defaults
# ---------------------------------------------------------------------------


def test_project_model_defaults(session: Session):
    proj = Project(name="demo", path="/tmp/demo")
    session.add(proj)
    session.commit()
    session.refresh(proj)

    assert isinstance(proj.id, UUID)
    assert proj.name == "demo"
    assert proj.path == "/tmp/demo"
    assert isinstance(proj.registered_at, datetime)
    assert proj.last_seen_commit is None
    assert proj.status == "active"


def test_project_path_unique_constraint(session: Session):
    session.add(Project(name="a", path="/unique/path"))
    session.commit()
    session.add(Project(name="b", path="/unique/path"))
    with pytest.raises(sqlalchemy.exc.IntegrityError):
        session.commit()


def test_note_model_defaults(session: Session):
    proj = Project(name="p", path="/tmp/p")
    session.add(proj)
    session.commit()
    session.refresh(proj)

    note = Note(project_id=proj.id, title="Hello")
    session.add(note)
    session.commit()
    session.refresh(note)

    assert isinstance(note.id, UUID)
    assert note.project_id == proj.id
    assert note.title == "Hello"
    assert note.content == ""
    assert isinstance(note.created_at, datetime)
    assert isinstance(note.updated_at, datetime)


def test_note_foreign_key_to_project(tables: sqlalchemy.Engine):
    """With PRAGMA foreign_keys=ON, inserting a note with a bogus project_id fails."""
    from uuid import uuid4

    with tables.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys=ON"))
        # Insert a note referencing a non-existent project
        with pytest.raises(sqlalchemy.exc.IntegrityError):
            conn.execute(
                text(
                    "INSERT INTO note (id, project_id, title, content, created_at, updated_at) "
                    "VALUES (:id, :pid, 'x', '', '2026-01-01', '2026-01-01')"
                ),
                {"id": str(uuid4()), "pid": str(uuid4())},
            )


def test_kanbanitem_model_defaults(session: Session):
    proj = Project(name="k", path="/tmp/k")
    session.add(proj)
    session.commit()
    session.refresh(proj)

    item = KanbanItem(project_id=proj.id, title="Task 1")
    session.add(item)
    session.commit()
    session.refresh(item)

    assert isinstance(item.id, UUID)
    assert item.description == ""
    assert item.status == "backlog"
    assert item.position == 0
    assert isinstance(item.created_at, datetime)
    assert isinstance(item.updated_at, datetime)


def test_kanbanitem_tablename():
    assert KanbanItem.__tablename__ == "kanbanitem"


def test_syncstate_model_defaults(session: Session):
    proj = Project(name="s", path="/tmp/s")
    session.add(proj)
    session.commit()
    session.refresh(proj)

    ss = SyncState(project_id=proj.id)
    session.add(ss)
    session.commit()
    session.refresh(ss)

    assert isinstance(ss.id, int)
    assert ss.last_sync_at is None
    assert ss.last_commit_hash is None
    assert ss.file_checksums == "{}"


def test_syncstate_project_id_unique(session: Session):
    proj = Project(name="u", path="/tmp/u")
    session.add(proj)
    session.commit()
    session.refresh(proj)

    session.add(SyncState(project_id=proj.id))
    session.commit()
    session.add(SyncState(project_id=proj.id))
    with pytest.raises(sqlalchemy.exc.IntegrityError):
        session.commit()


def test_appconfig_model_key_is_primary(session: Session):
    cfg = AppConfig(key="theme", value="dark")
    session.add(cfg)
    session.commit()
    session.refresh(cfg)

    assert cfg.key == "theme"
    assert cfg.value == "dark"
    assert isinstance(cfg.updated_at, datetime)

    # Duplicate key should fail
    session.add(AppConfig(key="theme", value="light"))
    with pytest.raises(sqlalchemy.exc.IntegrityError):
        session.commit()


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------


def test_get_engine_creates_sqlite_file(tmp_path: Path):
    db_file = tmp_path / "sub" / "test.db"
    eng = get_engine(db_path=db_file)
    # Force a connection to create the file
    with eng.connect() as conn:
        conn.execute(text("SELECT 1"))
    assert db_file.exists()


def test_get_engine_wal_mode(tmp_path: Path):
    db_file = tmp_path / "wal.db"
    eng = get_engine(db_path=db_file)
    with eng.connect() as conn:
        result = conn.execute(text("PRAGMA journal_mode")).scalar()
        assert result == "wal"


def test_get_engine_busy_timeout(tmp_path: Path):
    db_file = tmp_path / "busy.db"
    eng = get_engine(db_path=db_file)
    with eng.connect() as conn:
        result = conn.execute(text("PRAGMA busy_timeout")).scalar()
        assert result == 5000


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------


def test_get_session_yields_session(tmp_path: Path):
    db_file = tmp_path / "sess.db"
    eng = get_engine(db_path=db_file)
    SQLModel.metadata.create_all(eng)
    gen = get_session(engine=eng)
    sess = next(gen)
    assert isinstance(sess, Session)
    # Clean up the generator
    try:
        next(gen)
    except StopIteration:
        pass


def test_get_session_commits_and_queries(tmp_path: Path):
    db_file = tmp_path / "cq.db"
    eng = get_engine(db_path=db_file)
    SQLModel.metadata.create_all(eng)

    # Insert via one session
    gen1 = get_session(engine=eng)
    s1 = next(gen1)
    s1.add(Project(name="test-proj", path="/tmp/test-proj"))
    s1.commit()
    try:
        next(gen1)
    except StopIteration:
        pass

    # Query via another session
    gen2 = get_session(engine=eng)
    s2 = next(gen2)
    results = s2.exec(select(Project)).all()
    assert len(results) == 1
    assert results[0].name == "test-proj"
    try:
        next(gen2)
    except StopIteration:
        pass


# ---------------------------------------------------------------------------
# Metadata / table creation
# ---------------------------------------------------------------------------


def test_all_five_models_create_tables(tables: sqlalchemy.Engine):
    insp = inspect(tables)
    table_names = set(insp.get_table_names())
    expected = {"project", "note", "kanbanitem", "syncstate", "appconfig"}
    assert expected.issubset(table_names)


def test_naming_convention_applied():
    nc = SQLModel.metadata.naming_convention
    assert "ix" in nc
    assert "uq" in nc
    assert "ck" in nc
    assert "fk" in nc
    assert "pk" in nc
    assert "%(table_name)s" in nc["uq"]
