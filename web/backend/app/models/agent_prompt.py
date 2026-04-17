"""``AgentPrompt`` SQLModel table — one row per server-minted ``ask_user`` prompt.

Server mints a UUID ``prompt_id`` before emitting the SSE event; the frontend
echoes it back in ``POST /runs/{run_id}/answer`` so the backend can reject
stale answers (409). ``consumed_at`` captures the moment the tool handed the
answer back to the SDK — once consumed, a ``reopen`` must return 409 because
the agent has already acted on the answer.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Index, text
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    # Local copy to avoid the app.models ↔ app.database circular import.
    # Mirrors app.database._utcnow and app.models.agent_run._utcnow.
    return datetime.now(timezone.utc)


class AgentPrompt(SQLModel, table=True):
    # Server-minted at emit time — the tool body has to know the id *before*
    # the insert so it can embed it in the emitted SSE ``AskUserEvent``.
    id: str = Field(primary_key=True)
    run_id: UUID = Field(foreign_key="agentrun.id", index=True)

    # Only ``'ask_user'`` for now. ``permission_req`` / ``approve_tool`` are
    # out of scope (see DEFERRED.md). Stored as plain str to permit additive
    # evolution without migrations; the Literal lives in Pydantic schemas.
    kind: str = Field(default="ask_user")

    # JSON string: ``{question, options, allow_free_text, n_of_m}``.
    payload: str = Field(default="{}")

    # One of ``pending | answered | stale``.
    status: str = Field(default="pending", index=True)

    answer: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)
    answered_at: datetime | None = None
    consumed_at: datetime | None = None

    # Groups prompts produced by a single built-in AskUserQuestion call that
    # had to be split into multiple ``ask_user`` prompts (>4 questions).
    batch_id: str | None = Field(default=None, index=True)
    batch_position: int | None = None

    __table_args__ = (
        # At most one pending prompt per run. Mirrors the pattern used for
        # ``uq_agent_run_active_set`` in ``agent_run.py``. SQLite honours the
        # WHERE clause via ``sqlite_where``.
        Index(
            "uq_agent_prompt_run_pending",
            "run_id",
            unique=True,
            sqlite_where=text("status = 'pending'"),
        ),
        # Composite: reopen uses this to find downstream prompts created
        # after the reopened prompt.
        Index(
            "ix_agent_prompt_run_created",
            "run_id",
            "created_at",
        ),
    )
