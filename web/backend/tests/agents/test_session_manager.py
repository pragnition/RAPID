"""Tests for ``app.agents.session_manager.AgentSessionManager``."""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import pytest
import sqlalchemy
from sqlmodel import Session

from app.agents.errors import StateError
from app.agents.session_manager import AgentSessionManager
from app.database import Project
from app.models.agent_run import AgentRun


# ---------- helpers ----------


def _seed_project(engine: sqlalchemy.Engine, path: str = "/tmp/manager-test") -> UUID:
    with Session(engine) as s:
        p = Project(name="manager-test", path=path)
        s.add(p)
        s.commit()
        s.refresh(p)
        return p.id


async def _identity_aenter(self):  # noqa: D401 — returns the session itself
    return self


async def _noop_aexit(self, exc_type, exc, tb):  # noqa: D401
    return None


def _patch_session(*, run_side_effect=None) -> object:
    """Replace ``AgentSession`` lifecycle with cheap mocks that return ``self``."""
    run_mock = (
        AsyncMock(side_effect=run_side_effect)
        if run_side_effect is not None
        else AsyncMock(return_value=None)
    )
    return patch.multiple(
        "app.agents.session_manager.AgentSession",
        __aenter__=_identity_aenter,
        __aexit__=_noop_aexit,
        run=run_mock,
        interrupt=AsyncMock(return_value=None),
        send_input=AsyncMock(return_value=None),
    )


# ---------- tests ----------


@pytest.mark.asyncio
async def test_start_run_returns_in_under_200ms(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    project_id = _seed_project(tables)
    with _patch_session():
        t0 = time.monotonic()
        row = await manager.start_run(
            project_id=project_id,
            skill_name="plan-set",
            skill_args={},
            prompt="hello",
            set_id="s1",
        )
        elapsed_ms = (time.monotonic() - t0) * 1000.0
    assert elapsed_ms < 200, f"dispatch exceeded 200ms: {elapsed_ms:.1f}"
    assert row.id is not None
    # Give the dispatched task a moment to settle.
    await asyncio.sleep(0.05)


@pytest.mark.asyncio
async def test_start_run_inserts_pending_row(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    project_id = _seed_project(tables)

    async def _slow_run(*_args, **_kwargs):
        await asyncio.sleep(0.2)

    # Block the task body so the row stays in pending/running briefly.
    with _patch_session(run_side_effect=_slow_run):
        row = await manager.start_run(
            project_id=project_id,
            skill_name="plan-set",
            skill_args={},
            prompt="hello",
            set_id="s1",
        )
        with Session(tables) as s:
            db = s.get(AgentRun, row.id)
            assert db is not None
            assert db.status == "pending"
        # Let the task complete.
        await asyncio.sleep(0.3)


@pytest.mark.asyncio
async def test_per_set_mutex_rejects_second_run(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    project_id = _seed_project(tables)
    started = asyncio.Event()
    release = asyncio.Event()

    async def _hold_run(*_args, **_kwargs) -> None:
        started.set()
        await release.wait()

    with _patch_session(run_side_effect=_hold_run):
        first = await manager.start_run(
            project_id=project_id,
            skill_name="plan-set",
            skill_args={},
            prompt="p",
            set_id="set-a",
        )
        # Wait for the first task to actually acquire the set lock via run().
        await asyncio.wait_for(started.wait(), timeout=2.0)

        with pytest.raises(StateError) as excinfo:
            await manager.start_run(
                project_id=project_id,
                skill_name="plan-set",
                skill_args={},
                prompt="p2",
                set_id="set-a",
            )
        assert excinfo.value.http_status == 409

        release.set()
        # Let the first run finish.
        await asyncio.sleep(0.1)


@pytest.mark.asyncio
async def test_different_sets_run_in_parallel(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    project_id = _seed_project(tables)
    with _patch_session():
        a = await manager.start_run(
            project_id=project_id,
            skill_name="plan-set",
            skill_args={},
            prompt="p",
            set_id="set-a",
        )
        b = await manager.start_run(
            project_id=project_id,
            skill_name="plan-set",
            skill_args={},
            prompt="p",
            set_id="set-b",
        )
        assert a.id != b.id
        await asyncio.sleep(0.05)


@pytest.mark.asyncio
async def test_semaphore_caps_concurrency(
    manager: AgentSessionManager, tables: sqlalchemy.Engine, monkeypatch
) -> None:
    project_id = _seed_project(tables)
    from app.agents import session_manager as mgr_mod

    monkeypatch.setattr(mgr_mod.settings, "rapid_agent_max_concurrent", 2)

    in_flight = 0
    max_in_flight = 0
    lock = asyncio.Lock()

    async def _track_run(*_args, **_kwargs) -> None:
        nonlocal in_flight, max_in_flight
        async with lock:
            in_flight += 1
            max_in_flight = max(max_in_flight, in_flight)
        try:
            await asyncio.sleep(0.15)
        finally:
            async with lock:
                in_flight -= 1

    with _patch_session(run_side_effect=_track_run):
        rows = [
            await manager.start_run(
                project_id=project_id,
                skill_name="plan-set",
                skill_args={},
                prompt="p",
                set_id=f"set-{i}",
            )
            for i in range(4)
        ]
        # Wait for all four tasks to drain.
        await asyncio.gather(
            *(manager._session_tasks[r.id] for r in rows if r.id in manager._session_tasks),
            return_exceptions=True,
        )
        # Some tasks may have already been popped; wait a moment for cleanup.
        await asyncio.sleep(0.05)

    assert max_in_flight <= 2


@pytest.mark.asyncio
async def test_startup_orphan_sweep_marks_interrupted(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    project_id = _seed_project(tables)
    run_id = uuid4()
    with Session(tables) as s:
        s.add(
            AgentRun(
                id=run_id,
                project_id=project_id,
                set_id="s1",
                skill_name="execute-set",
                skill_args="{}",
                status="running",
                pid=999_999,
                started_at=datetime.now(timezone.utc) - timedelta(minutes=1),
            )
        )
        s.commit()

    reaped = await manager._startup_orphan_sweep()
    assert reaped >= 1

    with Session(tables) as s:
        row = s.get(AgentRun, run_id)
        assert row is not None
        assert row.status == "interrupted"
        assert row.error_code == "orphaned"


@pytest.mark.asyncio
async def test_periodic_sweep_respects_10s_young_run_guard(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    project_id = _seed_project(tables)
    run_id = uuid4()
    # Young run: started just now, no pid.
    with Session(tables) as s:
        s.add(
            AgentRun(
                id=run_id,
                project_id=project_id,
                set_id="s1",
                skill_name="execute-set",
                skill_args="{}",
                status="running",
                pid=None,
                started_at=datetime.now(timezone.utc),
            )
        )
        s.commit()

    # First sweep: row is too young, should remain running.
    manager._periodic_sweep_once()
    with Session(tables) as s:
        row = s.get(AgentRun, run_id)
        assert row is not None
        assert row.status == "running"

    # Backdate 30s and sweep again.
    with Session(tables) as s:
        row = s.get(AgentRun, run_id)
        row.started_at = datetime.now(timezone.utc) - timedelta(seconds=30)
        s.add(row)
        s.commit()

    manager._periodic_sweep_once()
    with Session(tables) as s:
        row = s.get(AgentRun, run_id)
        assert row is not None
        assert row.status == "interrupted"
        assert row.error_code == "orphaned"


@pytest.mark.asyncio
async def test_interrupt_unknown_run_raises(manager: AgentSessionManager) -> None:
    with pytest.raises(StateError):
        await manager.interrupt(uuid4())


@pytest.mark.asyncio
async def test_send_input_unknown_run_raises(manager: AgentSessionManager) -> None:
    with pytest.raises(StateError):
        await manager.send_input(uuid4(), "hi")


@pytest.mark.asyncio
async def test_get_run_unknown_raises(manager: AgentSessionManager) -> None:
    with pytest.raises(StateError):
        await manager.get_run(uuid4())


@pytest.mark.asyncio
async def test_attach_events_streams_from_bus(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    from datetime import datetime, timezone

    from app.schemas.sse_events import AssistantTextEvent, RunCompleteEvent

    project_id = _seed_project(tables)
    run_id = uuid4()
    # Seed an AgentRun so FK is valid.
    with Session(tables) as s:
        s.add(
            AgentRun(
                id=run_id,
                project_id=project_id,
                skill_name="execute-set",
                skill_args="{}",
                status="running",
            )
        )
        s.commit()

    ch = await manager.event_bus.get_or_create_channel(run_id)

    async def _publish() -> None:
        for i in range(1, 4):
            await manager.event_bus.publish(
                run_id,
                AssistantTextEvent(
                    seq=ch.next_seq(),
                    ts=datetime.now(timezone.utc),
                    run_id=run_id,
                    text=f"t{i}",
                ),
            )
        await manager.event_bus.publish(
            run_id,
            RunCompleteEvent(
                seq=ch.next_seq(),
                ts=datetime.now(timezone.utc),
                run_id=run_id,
                status="completed",
                total_cost_usd=0.0,
                turn_count=0,
                duration_s=0.0,
            ),
        )

    received = []

    async def _consume() -> None:
        async for evt in manager.attach_events(run_id, since=0):
            received.append(evt)

    consumer = asyncio.create_task(_consume())
    await asyncio.sleep(0.05)
    await _publish()
    await asyncio.wait_for(consumer, timeout=5.0)

    kinds = [e.kind for e in received]
    assert "run_complete" in kinds
    # Should have seen at least 3 assistant_text + run_complete.
    assert kinds.count("assistant_text") >= 3
