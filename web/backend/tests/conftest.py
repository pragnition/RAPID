"""Shared fixtures for database and migration tests."""

from pathlib import Path

import pytest
import sqlalchemy
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from app.database import _set_sqlite_pragmas


@pytest.fixture()
def db_path(tmp_path: Path) -> Path:
    """Return a temporary database file path (file does not yet exist)."""
    return tmp_path / "test.db"


@pytest.fixture()
def engine(db_path: Path) -> sqlalchemy.Engine:
    """Create a fresh SQLite engine pointed at a temp file with WAL pragmas."""
    eng = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
    event.listen(eng, "connect", _set_sqlite_pragmas)
    return eng


@pytest.fixture()
def tables(engine: sqlalchemy.Engine) -> sqlalchemy.Engine:
    """Create all SQLModel tables and return the engine."""
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture()
def session(tables: sqlalchemy.Engine):
    """Yield a SQLModel session backed by a temp database with tables created."""
    with Session(tables) as sess:
        yield sess
