"""Unit tests for ``AgentSessionManager`` prompt facade.

Targets:
* ``resolve_prompt(unknown_id)`` → ``StateError(error_code='prompt_not_found')``.
* ``resolve_prompt`` on a stale prompt → ``StateError(error_code='prompt_stale')``.
* ``get_pending_prompt`` returns None / the row.
* Race: two concurrent ``resolve_prompt`` calls — one wins, the other gets
  ``prompt_stale``.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
import sqlalchemy
from sqlmodel import Session

from app.agents.errors import StateError
from app.agents.session_manager import AgentSessionManager
from app.database import Project
from app.models.agent_prompt import AgentPrompt
from app.models.agent_run import AgentRun


def _seed_run(engine: sqlalchemy.Engine) -> UUID:
    suffix = uuid4().hex
    with Session(engine) as s:
        p = Project(name=f"facade-{suffix}", path=f"/tmp/prompt-facade-{suffix}")
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


def _insert_prompt(
    engine: sqlalchemy.Engine,
    run_id: UUID,
    prompt_id: str,
    *,
    status: str = "pending",
    answer: str | None = None,
    consumed_at: datetime | None = None,
) -> None:
    with Session(engine) as s:
        s.add(
            AgentPrompt(
                id=prompt_id,
                run_id=run_id,
                payload='{"question":"q"}',
                status=status,
                answer=answer,
                created_at=datetime.now(timezone.utc),
                answered_at=(
                    datetime.now(timezone.utc) if status == "answered" else None
                ),
                consumed_at=consumed_at,
            )
        )
        s.commit()


# ---------- resolve_prompt ----------


@pytest.mark.asyncio
async def test_resolve_prompt_unknown_raises_not_found(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    run_id = _seed_run(tables)
    with pytest.raises(StateError) as excinfo:
        await manager.resolve_prompt(run_id, "no-such-prompt", "x")
    assert excinfo.value.error_code == "prompt_not_found"
    assert excinfo.value.http_status == 404


@pytest.mark.asyncio
async def test_resolve_prompt_stale_raises_prompt_stale(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    run_id = _seed_run(tables)
    _insert_prompt(tables, run_id, "p-stale", status="stale")
    with pytest.raises(StateError) as excinfo:
        await manager.resolve_prompt(run_id, "p-stale", "x")
    assert excinfo.value.error_code == "prompt_stale"
    assert excinfo.value.http_status == 409


@pytest.mark.asyncio
async def test_resolve_prompt_on_already_answered_is_idempotent_no_raise(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    """Re-answering an already-answered (but unconsumed) prompt is a no-op.

    The implementation's outer check is ``row.status != 'answered'`` — an
    already-answered row passes that gate, so no StateError is raised and the
    DB is not mutated (the inner ``_load_and_answer`` short-circuits when
    status != 'pending'). This is intentional idempotency for double-POSTs.
    Stale rows DO raise — see ``test_resolve_prompt_stale_raises_prompt_stale``.
    """
    run_id = _seed_run(tables)
    _insert_prompt(
        tables, run_id, "p-ans", status="answered", answer="prev"
    )
    # Should NOT raise.
    await manager.resolve_prompt(run_id, "p-ans", "new")

    # Original answer is preserved.
    with Session(tables) as s:
        row = s.get(AgentPrompt, "p-ans")
        assert row is not None
        assert row.status == "answered"
        assert row.answer == "prev"


@pytest.mark.asyncio
async def test_resolve_prompt_wrong_run_raises_not_found(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    """A prompt whose ``run_id`` doesn't match yields ``prompt_not_found``."""
    run_a = _seed_run(tables)
    run_b = _seed_run(tables)
    _insert_prompt(tables, run_a, "p-a", status="pending")
    with pytest.raises(StateError) as excinfo:
        await manager.resolve_prompt(run_b, "p-a", "x")
    assert excinfo.value.error_code == "prompt_not_found"


@pytest.mark.asyncio
async def test_resolve_prompt_happy_path_marks_answered(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    run_id = _seed_run(tables)
    _insert_prompt(tables, run_id, "p-ok")

    # Register a future so we can observe set_result.
    loop = asyncio.get_event_loop()
    fut: asyncio.Future[str] = loop.create_future()
    manager._prompt_futures["p-ok"] = fut

    await manager.resolve_prompt(run_id, "p-ok", "yes")

    assert fut.done()
    assert fut.result() == "yes"

    with Session(tables) as s:
        row = s.get(AgentPrompt, "p-ok")
        assert row is not None
        assert row.status == "answered"
        assert row.answer == "yes"
        assert row.answered_at is not None
        # consumed_at is set by the tool body, NOT by resolve_prompt.
        assert row.consumed_at is None


# ---------- get_pending_prompt ----------


@pytest.mark.asyncio
async def test_get_pending_prompt_returns_none_when_no_pending(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    run_id = _seed_run(tables)
    row = await manager.get_pending_prompt(run_id)
    assert row is None


@pytest.mark.asyncio
async def test_get_pending_prompt_returns_pending_row(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    run_id = _seed_run(tables)
    _insert_prompt(tables, run_id, "p1")
    row = await manager.get_pending_prompt(run_id)
    assert row is not None
    assert row.id == "p1"
    assert row.status == "pending"


@pytest.mark.asyncio
async def test_get_pending_prompt_ignores_non_pending(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    run_id = _seed_run(tables)
    _insert_prompt(tables, run_id, "p1", status="answered", answer="ok")
    _insert_prompt(tables, run_id, "p2", status="stale")
    row = await manager.get_pending_prompt(run_id)
    assert row is None


# ---------- concurrency ----------


@pytest.mark.asyncio
async def test_concurrent_resolve_first_wins_second_is_noop(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    """Two concurrent resolves on the same pending prompt.

    The per-run prompt lock serializes them. The first call promotes the row
    to ``answered`` and resolves the future; the second call sees a non-pending
    row and silently no-ops (idempotent). Neither raises StateError.
    """
    run_id = _seed_run(tables)
    _insert_prompt(tables, run_id, "p-race")

    loop = asyncio.get_event_loop()
    fut: asyncio.Future[str] = loop.create_future()
    manager._prompt_futures["p-race"] = fut

    results = await asyncio.gather(
        manager.resolve_prompt(run_id, "p-race", "winner"),
        manager.resolve_prompt(run_id, "p-race", "loser"),
        return_exceptions=True,
    )

    # Per the implementation: both succeed (idempotent re-resolve is a no-op).
    assert all(r is None for r in results), f"unexpected results: {results}"

    # Future was set exactly once with the first answer to win the lock.
    assert fut.done()
    assert fut.result() in ("winner", "loser")

    # Persisted answer matches whichever resolve hit the lock first.
    with Session(tables) as s:
        row = s.get(AgentPrompt, "p-race")
        assert row is not None
        assert row.status == "answered"
        assert row.answer == fut.result()


@pytest.mark.asyncio
async def test_resolve_then_resolve_on_stale_raises(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    """Once a prompt is stale, resolving it MUST raise prompt_stale."""
    run_id = _seed_run(tables)
    _insert_prompt(tables, run_id, "p-stale-2", status="stale")
    with pytest.raises(StateError) as excinfo:
        await manager.resolve_prompt(run_id, "p-stale-2", "x")
    assert excinfo.value.error_code == "prompt_stale"
