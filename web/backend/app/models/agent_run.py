"""``AgentRun`` SQLModel table — one row per agent invocation."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import Index, text
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    # Local copy to avoid the app.models ↔ app.database circular import.
    # Mirrors app.database._utcnow.
    return datetime.now(timezone.utc)


class AgentRun(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="project.id", index=True)
    set_id: str | None = Field(default=None, index=True)
    skill_name: str
    skill_args: str = Field(default="{}")
    status: str = Field(default="pending", index=True)
    pid: int | None = Field(default=None)
    started_at: datetime = Field(default_factory=_utcnow)
    ended_at: datetime | None = None
    active_duration_s: float = Field(default=0.0)
    total_wall_clock_s: float = Field(default=0.0)
    total_cost_usd: float = Field(default=0.0)
    max_turns: int = Field(default=40)
    turn_count: int = Field(default=0)
    error_code: str | None = None
    error_detail: str = Field(default="{}")
    last_seq: int = Field(default=0)

    __table_args__ = (
        Index(
            "uq_agent_run_active_set",
            "project_id",
            "set_id",
            unique=True,
            sqlite_where=text("status IN ('running','waiting')"),
        ),
    )
