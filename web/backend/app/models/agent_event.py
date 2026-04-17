"""``AgentEvent`` SQLModel table — append-only event log per ``AgentRun``."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Index
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    # Local copy to avoid the app.models ↔ app.database circular import.
    # Mirrors app.database._utcnow.
    return datetime.now(timezone.utc)


class AgentEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    run_id: UUID = Field(foreign_key="agentrun.id", index=True)
    seq: int = Field(index=True)
    ts: datetime = Field(default_factory=_utcnow)
    kind: str = Field(index=True)
    payload: str = Field(default="{}")

    __table_args__ = (
        Index("uq_agent_event_run_seq", "run_id", "seq", unique=True),
    )
