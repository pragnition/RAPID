"""Model-level tests for ``AgentPrompt``.

Covers:
* Round-trip insert/read of an ``AgentPrompt`` row.
* Partial unique index ``uq_agent_prompt_run_pending``: at most one
  ``status='pending'`` row per ``run_id``.
* Composite ``(run_id, created_at)`` index ``ix_agent_prompt_run_created``
  exists in the table metadata.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
import sqlalchemy
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.database import Project
from app.models.agent_prompt import AgentPrompt
from app.models.agent_run import AgentRun


def _seed_run(engine: sqlalchemy.Engine) -> UUID:
    with Session(engine) as s:
        p = Project(name="prompt-test", path="/tmp/prompt-model")
        s.add(p)
        s.commit()
        s.refresh(p)
        run = AgentRun(
            id=uuid4(),
            project_id=p.id,
            skill_name="execute-set",
            skill_args="{}",
            status="running",
            max_turns=40,
        )
        s.add(run)
        s.commit()
        return run.id


def test_round_trip_insert_and_read(tables: sqlalchemy.Engine) -> None:
    run_id = _seed_run(tables)
    prompt_id = "p-abc"
    with Session(tables) as s:
        s.add(
            AgentPrompt(
                id=prompt_id,
                run_id=run_id,
                kind="ask_user",
                payload='{"question":"hi","options":null,"allow_free_text":true}',
                status="pending",
                created_at=datetime.now(timezone.utc),
                batch_id="b-1",
                batch_position=0,
            )
        )
        s.commit()

    with Session(tables) as s:
        row = s.get(AgentPrompt, prompt_id)
        assert row is not None
        assert row.run_id == run_id
        assert row.kind == "ask_user"
        assert row.status == "pending"
        assert row.answer is None
        assert row.answered_at is None
        assert row.consumed_at is None
        assert row.batch_id == "b-1"
        assert row.batch_position == 0


def test_partial_unique_blocks_two_pending_per_run(
    tables: sqlalchemy.Engine,
) -> None:
    run_id = _seed_run(tables)
    with Session(tables) as s:
        s.add(
            AgentPrompt(
                id="p1",
                run_id=run_id,
                payload="{}",
                status="pending",
                created_at=datetime.now(timezone.utc),
            )
        )
        s.commit()

    # A second pending row for the same run must be rejected by the partial
    # unique index ``uq_agent_prompt_run_pending``.
    with pytest.raises(IntegrityError):
        with Session(tables) as s:
            s.add(
                AgentPrompt(
                    id="p2",
                    run_id=run_id,
                    payload="{}",
                    status="pending",
                    created_at=datetime.now(timezone.utc),
                )
            )
            s.commit()


def test_partial_unique_allows_pending_after_answered(
    tables: sqlalchemy.Engine,
) -> None:
    """Inserting a pending row when the prior one was answered should succeed."""
    run_id = _seed_run(tables)
    with Session(tables) as s:
        s.add(
            AgentPrompt(
                id="p1",
                run_id=run_id,
                payload="{}",
                status="answered",
                answer="yes",
                created_at=datetime.now(timezone.utc),
                answered_at=datetime.now(timezone.utc),
            )
        )
        s.commit()

    # Should not raise — the partial WHERE excludes non-pending rows.
    with Session(tables) as s:
        s.add(
            AgentPrompt(
                id="p2",
                run_id=run_id,
                payload="{}",
                status="pending",
                created_at=datetime.now(timezone.utc),
            )
        )
        s.commit()

    with Session(tables) as s:
        rows = s.exec(
            select(AgentPrompt).where(AgentPrompt.run_id == run_id)
        ).all()
        assert len(rows) == 2
        statuses = sorted(r.status for r in rows)
        assert statuses == ["answered", "pending"]


def test_composite_index_present_in_metadata() -> None:
    """The ``(run_id, created_at)`` composite index must exist on the table."""
    index_names = {idx.name for idx in AgentPrompt.__table__.indexes}
    assert "ix_agent_prompt_run_created" in index_names
    # And the partial unique should be present too.
    assert "uq_agent_prompt_run_pending" in index_names

    composite = next(
        idx
        for idx in AgentPrompt.__table__.indexes
        if idx.name == "ix_agent_prompt_run_created"
    )
    cols = [c.name for c in composite.columns]
    assert cols == ["run_id", "created_at"]


def test_default_status_is_pending(tables: sqlalchemy.Engine) -> None:
    run_id = _seed_run(tables)
    with Session(tables) as s:
        s.add(
            AgentPrompt(
                id="p-default",
                run_id=run_id,
                payload='{"question":"q"}',
                created_at=datetime.now(timezone.utc),
            )
        )
        s.commit()
    with Session(tables) as s:
        row = s.get(AgentPrompt, "p-default")
        assert row is not None
        assert row.status == "pending"
        assert row.kind == "ask_user"
