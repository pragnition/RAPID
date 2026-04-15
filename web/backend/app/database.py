import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator
from uuid import UUID, uuid4

import sqlalchemy
from sqlalchemy import event
from sqlmodel import Field, Session, SQLModel, create_engine
from sqlmodel.main import SQLModelMetaclass

from app.config import settings

logger = logging.getLogger(__name__)

# Naming convention for Alembic batch mode compatibility
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
SQLModel.metadata.naming_convention = convention


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class Project(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    path: str = Field(unique=True)
    registered_at: datetime = Field(default_factory=_utcnow)
    last_seen_commit: str | None = None
    status: str = Field(default="active")
    last_seen_at: datetime | None = None
    metadata_json: str = Field(default="{}")


class Note(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="project.id")
    title: str
    content: str = Field(default="")
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class KanbanColumn(SQLModel, table=True):
    __tablename__ = "kanbancolumn"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="project.id")
    title: str
    position: int = Field(default=0)
    created_at: datetime = Field(default_factory=_utcnow)


class KanbanCard(SQLModel, table=True):
    __tablename__ = "kanbancard"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    column_id: UUID = Field(foreign_key="kanbancolumn.id")
    title: str
    description: str = Field(default="")
    position: int = Field(default=0)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class SyncState(SQLModel, table=True):
    __tablename__ = "syncstate"

    id: int | None = Field(default=None, primary_key=True)
    project_id: UUID = Field(foreign_key="project.id", unique=True)
    last_sync_at: datetime | None = None
    last_commit_hash: str | None = None
    file_checksums: str = Field(default="{}")


class AppConfig(SQLModel, table=True):
    __tablename__ = "appconfig"

    key: str = Field(primary_key=True)
    value: str
    updated_at: datetime = Field(default_factory=_utcnow)


# Register agent-runtime tables so SQLModel.metadata contains them.
# Triggered by importing the module — do NOT move to top of file
# (avoids circular import with app.agents.correlation → app.config → app.database).
from app.models.agent_run import AgentRun  # noqa: E402, F401
from app.models.agent_event import AgentEvent  # noqa: E402, F401


# ---------------------------------------------------------------------------
# Engine and session management
# ---------------------------------------------------------------------------

_engine: sqlalchemy.Engine | None = None


def _set_sqlite_pragmas(dbapi_conn, connection_record):  # noqa: ARG001
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def get_engine(db_path: Path | None = None) -> sqlalchemy.Engine:
    """Create or return a cached SQLite engine with WAL mode enabled."""
    global _engine

    if db_path is not None:
        # Explicit path requested -- always create a fresh engine (used in tests)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        eng = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
        )
        event.listen(eng, "connect", _set_sqlite_pragmas)
        return eng

    if _engine is not None:
        return _engine

    db_path = settings.rapid_web_db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    _engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
    event.listen(_engine, "connect", _set_sqlite_pragmas)
    return _engine


def get_session(engine: sqlalchemy.Engine | None = None) -> Generator[Session, None, None]:
    """Yield a SQLModel session (FastAPI Depends compatible)."""
    if engine is None:
        engine = get_engine()
    with Session(engine) as session:
        yield session


def run_migrations(engine: sqlalchemy.Engine) -> None:
    """Apply Alembic migrations up to head, falling back to create_all."""
    alembic_ini = Path(__file__).resolve().parent.parent / "alembic.ini"
    if not alembic_ini.exists():
        cwd_ini = Path.cwd() / "alembic.ini"
        if cwd_ini.exists():
            logger.warning(
                "alembic.ini not found relative to __file__, "
                "falling back to cwd-relative path"
            )
            alembic_ini = cwd_ini
        else:
            logger.warning(
                "alembic.ini not found — using SQLModel.metadata.create_all() "
                "as fallback (this is expected in installed packages)"
            )
            SQLModel.metadata.create_all(engine)
            return

    from alembic import command
    from alembic.config import Config

    cfg = Config(str(alembic_ini))
    cfg.attributes["engine"] = engine
    command.upgrade(cfg, "head")
