"""Tests for ``app.agents.event_bus``."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text
from sqlmodel import Session, select

from app.agents import event_bus as event_bus_module
from app.agents.event_bus import (
    BATCH_INTERVAL_S,  # noqa: F401 — documented constant
    CRITICAL_KINDS,
    EventBus,
    RunChannel,
)
from app.config import settings
from app.database import Project
from app.models.agent_event import AgentEvent
from app.models.agent_run import AgentRun
from app.schemas.sse_events import (
    AssistantTextEvent,
    PermissionReqEvent,
    ReplayTruncatedEvent,
    RunCompleteEvent,
    StatusEvent,
)


def _seed_run(engine, run_id: UUID) -> None:
    """Create the Project + AgentRun rows so AgentEvent FK insertions pass."""
    with Session(engine) as s:
        project = Project(name="test-project", path=f"/tmp/test-{run_id}")
        s.add(project)
        s.commit()
        s.refresh(project)
        s.add(
            AgentRun(
                id=run_id,
                project_id=project.id,
                skill_name="execute-set",
                skill_args="{}",
                status="running",
            )
        )
        s.commit()


def _status(run_id: UUID, seq: int) -> StatusEvent:
    return StatusEvent(
        seq=seq,
        ts=datetime.now(timezone.utc),
        run_id=run_id,
        status="running",
        detail=None,
    )


def _assistant(run_id: UUID, seq: int, text_: str = "hi") -> AssistantTextEvent:
    return AssistantTextEvent(
        seq=seq,
        ts=datetime.now(timezone.utc),
        run_id=run_id,
        text=text_,
    )


def _permission_req(run_id: UUID, seq: int) -> PermissionReqEvent:
    return PermissionReqEvent(
        seq=seq,
        ts=datetime.now(timezone.utc),
        run_id=run_id,
        tool_name="Bash",
        tool_use_id="u-1",
        reason="halt",
        blocked=True,
    )


def _run_complete(run_id: UUID, seq: int) -> RunCompleteEvent:
    return RunCompleteEvent(
        seq=seq,
        ts=datetime.now(timezone.utc),
        run_id=run_id,
        status="completed",
        total_cost_usd=0.0,
        turn_count=1,
        duration_s=0.1,
    )


@pytest.mark.asyncio
async def test_publish_increments_seq(tables):
    bus = EventBus(tables)
    rid = uuid4()
    _seed_run(tables, rid)
    ch = await bus.get_or_create_channel(rid)
    try:
        for _ in range(3):
            ev = _status(rid, ch.next_seq())
            await ch.publish(ev)
    finally:
        await bus.close()

    with Session(tables) as s:
        rows = s.exec(
            select(AgentEvent).where(AgentEvent.run_id == rid).order_by(AgentEvent.seq)
        ).all()
    assert [r.seq for r in rows] == [1, 2, 3]


@pytest.mark.asyncio
async def test_critical_kind_synchronous_flush(tables):
    assert "permission_req" in CRITICAL_KINDS
    bus = EventBus(tables)
    rid = uuid4()
    _seed_run(tables, rid)
    ch = await bus.get_or_create_channel(rid)
    try:
        ev = _permission_req(rid, ch.next_seq())
        await ch.publish(ev)
        # No sleep, no batch flush: synchronous write.
        with Session(tables) as s:
            rows = s.exec(
                select(AgentEvent).where(AgentEvent.run_id == rid)
            ).all()
        assert len(rows) == 1
        assert rows[0].kind == "permission_req"
    finally:
        await bus.close()


@pytest.mark.asyncio
async def test_non_critical_kind_batched(tables):
    assert "assistant_text" not in CRITICAL_KINDS
    bus = EventBus(tables)
    rid = uuid4()
    _seed_run(tables, rid)
    ch = await bus.get_or_create_channel(rid)
    try:
        ev = _assistant(rid, ch.next_seq())
        await ch.publish(ev)

        # Before the batch flush, row should NOT yet be persisted.
        with Session(tables) as s:
            rows = s.exec(
                select(AgentEvent).where(AgentEvent.run_id == rid)
            ).all()
        assert len(rows) == 0, "non-critical event should be batched, not flushed"

        # Force a flush (we don't want to sleep >= 1.2s in unit tests).
        await ch._flush_batch()

        with Session(tables) as s:
            rows = s.exec(
                select(AgentEvent).where(AgentEvent.run_id == rid)
            ).all()
        assert len(rows) == 1
        assert rows[0].kind == "assistant_text"
    finally:
        await bus.close()


@pytest.mark.asyncio
async def test_ring_buffer_bounded(tables, monkeypatch):
    # Force a smaller ring for the test without patching module state across
    # tests that share the default.
    monkeypatch.setattr(event_bus_module, "RING_BUFFER_SIZE", 1000)
    bus = EventBus(tables)
    rid = uuid4()
    _seed_run(tables, rid)
    ch = RunChannel(rid, tables)
    # Bypass registering / writer task so this test stays pure.
    try:
        for _ in range(1200):
            ev = _status(rid, ch.next_seq())
            await ch.publish(ev)
        # NOTE: the RING_BUFFER_SIZE module constant is bound at class init
        # time via deque(maxlen=RING_BUFFER_SIZE). For a fresh RunChannel the
        # limit matches the value in force at __init__.
        assert len(ch._ring) == 1000
    finally:
        await ch.close()
        await bus.close()


@pytest.mark.asyncio
async def test_attach_replay_backfill_and_live(tables):
    bus = EventBus(tables)
    rid = uuid4()
    _seed_run(tables, rid)
    ch = await bus.get_or_create_channel(rid)
    try:
        # Publish seq 1-5 as critical events (synchronous flush).
        for _ in range(5):
            await ch.publish(_status(rid, ch.next_seq()))

        # Attach with since=2 — should backfill 3, 4, 5 from SQLite.
        received: list = []

        async def _consume() -> None:
            async for evt in bus.attach_events(rid, since=2):
                received.append(evt)
                if evt.kind == "run_complete":
                    break

        consumer = asyncio.create_task(_consume())
        # Give consumer a tick to do backfill + subscribe.
        await asyncio.sleep(0.05)

        # Now publish live seq 6 + a run_complete at seq 7.
        await ch.publish(_assistant(rid, ch.next_seq(), "live-6"))
        await ch.publish(_run_complete(rid, ch.next_seq()))

        await asyncio.wait_for(consumer, timeout=5.0)

        seqs = [e.seq for e in received]
        assert seqs == [3, 4, 5, 6, 7]
        # No duplicates.
        assert len(set(seqs)) == len(seqs)
    finally:
        await bus.close()


@pytest.mark.asyncio
async def test_attach_emits_replay_truncated(tables):
    bus = EventBus(tables)
    rid = uuid4()
    _seed_run(tables, rid)
    ch = await bus.get_or_create_channel(rid)
    try:
        # Publish 5 critical events, synchronously flushed.
        for _ in range(5):
            await ch.publish(_status(rid, ch.next_seq()))

        # Simulate retention pruning: delete rows with seq < 3.
        with Session(tables) as s:
            s.exec(
                text(
                    "DELETE FROM agentevent WHERE run_id = :rid AND seq < 3"
                ).bindparams(rid=rid.hex)
            )
            s.commit()

        first_events: list = []

        async def _consume() -> None:
            async for evt in bus.attach_events(rid, since=0):
                first_events.append(evt)
                if len(first_events) >= 4:  # truncated + 3,4,5
                    break

        consumer = asyncio.create_task(_consume())
        await asyncio.sleep(0.05)
        # Emit a run_complete so consumer can gracefully exit if still running.
        if not consumer.done():
            # Already collected; cancel to avoid hanging on live subscription.
            consumer.cancel()
            try:
                await consumer
            except asyncio.CancelledError:
                pass

        assert first_events[0].kind == "replay_truncated"
        assert isinstance(first_events[0], ReplayTruncatedEvent)
        assert first_events[0].reason == "retention_cap"
    finally:
        await bus.close()


@pytest.mark.asyncio
async def test_enforce_retention_prunes_oldest(tables, monkeypatch):
    monkeypatch.setattr(settings, "rapid_agent_event_retention_rows", 100)
    bus = EventBus(tables)
    rid = uuid4()
    _seed_run(tables, rid)
    # Insert 150 rows directly.
    with Session(tables) as s:
        for i in range(1, 151):
            s.add(
                AgentEvent(
                    run_id=rid,
                    seq=i,
                    ts=datetime.now(timezone.utc),
                    kind="status",
                    payload=json.dumps({"seq": i}),
                )
            )
        s.commit()

    pruned = await bus.enforce_retention(rid)
    assert pruned == 50

    with Session(tables) as s:
        rows = s.exec(
            select(AgentEvent).where(AgentEvent.run_id == rid).order_by(AgentEvent.seq)
        ).all()
    assert len(rows) == 100
    assert rows[0].seq == 51
    assert rows[-1].seq == 150

    await bus.close()


@pytest.mark.asyncio
async def test_close_channel_drains_writer(tables):
    bus = EventBus(tables)
    rid = uuid4()
    _seed_run(tables, rid)
    ch = await bus.get_or_create_channel(rid)
    # publish a non-critical event then close — close() should flush.
    await ch.publish(_assistant(rid, ch.next_seq()))
    await bus.close_channel(rid)

    with Session(tables) as s:
        rows = s.exec(select(AgentEvent).where(AgentEvent.run_id == rid)).all()
    assert len(rows) == 1
    await bus.close()
