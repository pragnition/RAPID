"""Per-run event fan-out, persistence, and replay.

``RunChannel`` owns one agent run's ring buffer, per-run async writer task,
and the fanout to live SSE subscribers. ``EventBus`` indexes channels by
``run_id``. The public replay entry point is :meth:`EventBus.attach_events`
which emits ``replay_truncated`` when the requested ``since`` precedes the
retention window, then streams SQLite backfill, then hands off to live
subscription with seq-based dedup.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import deque
from datetime import datetime, timezone
from typing import AsyncIterator, Deque
from uuid import UUID

import sqlalchemy
from sqlalchemy import text
from sqlmodel import Session, select

from app.agents.correlation import get_run_id  # noqa: F401 — downstream sessions use this
from app.config import settings
from app.models.agent_event import AgentEvent
from app.schemas.sse_events import EVENT_KINDS, SseEvent, serialize_event  # noqa: F401

logger = logging.getLogger("rapid.agents.event_bus")


RING_BUFFER_SIZE = settings.rapid_agent_ring_buffer_size
BATCH_INTERVAL_S = 1.0
CRITICAL_KINDS = frozenset({"permission_req", "ask_user", "run_complete", "status"})


def _deserialize_stored_event(payload: dict) -> SseEvent:
    """Reconstruct a discriminated-union :class:`SseEvent` from a stored dict."""
    from pydantic import TypeAdapter

    from app.schemas.sse_events import SseEvent as _SseEvent

    return TypeAdapter(_SseEvent).validate_python(payload)


class RunChannel:
    """Per-run pub/sub primitive. One per ``run_id``."""

    def __init__(self, run_id: UUID, engine: sqlalchemy.Engine) -> None:
        self.run_id = run_id
        self._engine = engine
        self._ring: Deque[SseEvent] = deque(maxlen=RING_BUFFER_SIZE)
        self._subscribers: list[asyncio.Queue[SseEvent]] = []
        self._seq = 0
        self._pending_batch: list[SseEvent] = []
        self._pending_lock = asyncio.Lock()
        self._writer_task: asyncio.Task | None = None
        self._closed = asyncio.Event()
        # Highest seq persisted to SQLite — used by ``attach_events`` dedup.
        self._max_flushed_seq = 0

    async def start_writer(self) -> None:
        self._writer_task = asyncio.create_task(self._writer_loop())

    async def close(self) -> None:
        self._closed.set()
        if self._writer_task:
            try:
                await self._writer_task
            except Exception:  # noqa: BLE001 — shutdown path
                logger.exception("writer task raised during close")
        await self._flush_batch()

    def next_seq(self) -> int:
        self._seq += 1
        return self._seq

    async def publish(self, event: SseEvent) -> None:
        # Ring buffer (unbounded subscriber queues drain separately).
        self._ring.append(event)
        # Fanout to live subscribers.
        for q in list(self._subscribers):
            await q.put(event)
        # Persist.
        if event.kind in CRITICAL_KINDS:
            await self._flush_single(event)
        else:
            async with self._pending_lock:
                self._pending_batch.append(event)

    async def subscribe(self) -> asyncio.Queue[SseEvent]:
        q: asyncio.Queue[SseEvent] = asyncio.Queue()
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[SseEvent]) -> None:
        try:
            self._subscribers.remove(q)
        except ValueError:
            pass

    async def _writer_loop(self) -> None:
        try:
            while not self._closed.is_set():
                try:
                    await asyncio.wait_for(self._closed.wait(), timeout=BATCH_INTERVAL_S)
                except asyncio.TimeoutError:
                    pass
                await self._flush_batch()
        except Exception:
            logger.exception(
                "event writer loop crashed", extra={"run_id": str(self.run_id)}
            )

    async def _flush_single(self, event: SseEvent) -> None:
        def _write() -> None:
            with Session(self._engine) as s:
                s.add(
                    AgentEvent(
                        run_id=self.run_id,
                        seq=event.seq,
                        ts=event.ts,
                        kind=event.kind,
                        payload=json.dumps(serialize_event(event)),
                    )
                )
                s.commit()

        await asyncio.to_thread(_write)
        if event.seq > self._max_flushed_seq:
            self._max_flushed_seq = event.seq

    async def _flush_batch(self) -> None:
        async with self._pending_lock:
            if not self._pending_batch:
                return
            batch = self._pending_batch
            self._pending_batch = []

        def _write() -> None:
            with Session(self._engine) as s:
                for evt in batch:
                    s.add(
                        AgentEvent(
                            run_id=self.run_id,
                            seq=evt.seq,
                            ts=evt.ts,
                            kind=evt.kind,
                            payload=json.dumps(serialize_event(evt)),
                        )
                    )
                s.commit()

        await asyncio.to_thread(_write)
        new_max = max((e.seq for e in batch), default=0)
        if new_max > self._max_flushed_seq:
            self._max_flushed_seq = new_max

    async def replay(self, since: int) -> AsyncIterator[SseEvent]:
        """Replay is exposed via :meth:`EventBus.attach_events`."""
        raise NotImplementedError("use EventBus.attach_events via manager")


class EventBus:
    """Indexes :class:`RunChannel` by ``run_id`` and hosts the SSE replay entry point."""

    def __init__(self, engine: sqlalchemy.Engine) -> None:
        self._engine = engine
        self._channels: dict[UUID, RunChannel] = {}
        self._lock = asyncio.Lock()

    async def get_or_create_channel(self, run_id: UUID) -> RunChannel:
        async with self._lock:
            ch = self._channels.get(run_id)
            if ch is None:
                ch = RunChannel(run_id, self._engine)
                await ch.start_writer()
                self._channels[run_id] = ch
            return ch

    async def publish(self, run_id: UUID, event: SseEvent) -> None:
        ch = await self.get_or_create_channel(run_id)
        await ch.publish(event)

    async def close_channel(self, run_id: UUID) -> None:
        async with self._lock:
            ch = self._channels.pop(run_id, None)
        if ch:
            await ch.close()

    async def close(self) -> None:
        channels = list(self._channels.values())
        self._channels.clear()
        await asyncio.gather(*(ch.close() for ch in channels), return_exceptions=True)

    async def attach_events(
        self, run_id: UUID, since: int = 0
    ) -> AsyncIterator[SseEvent]:
        """Stream events for SSE.

        Yields in order:
          1. ``replay_truncated`` if ``since`` is older than the oldest seq
             available in SQLite after retention.
          2. SQLite backfill WHERE ``seq > since``.
          3. Live ring/subscriber events with ``seq > max_backfill_seq`` (dedup).
        """
        from app.schemas.sse_events import ReplayTruncatedEvent  # local to avoid cycle

        ch = await self.get_or_create_channel(run_id)

        # --- Step 1: determine oldest/newest available seq in SQLite ---
        def _query_bounds() -> tuple[int, int]:
            with Session(self._engine) as s:
                row = s.exec(
                    text(
                        "SELECT MIN(seq), MAX(seq) FROM agentevent WHERE run_id = :rid"
                    ).bindparams(rid=run_id.hex)
                ).one()
                return (row[0] or 0, row[1] or 0)

        oldest, newest = await asyncio.to_thread(_query_bounds)
        if since > 0 and oldest > 0 and since < oldest - 1:
            yield ReplayTruncatedEvent(
                seq=0,
                ts=datetime.now(timezone.utc),
                run_id=run_id,
                kind="replay_truncated",
                oldest_available_seq=oldest,
                requested_since_seq=since,
                reason="retention_cap",
            )
        elif since == 0 and oldest > 1:
            # Consumer asked for the full history, but retention has pruned
            # everything before ``oldest`` — emit the truncated marker.
            yield ReplayTruncatedEvent(
                seq=0,
                ts=datetime.now(timezone.utc),
                run_id=run_id,
                kind="replay_truncated",
                oldest_available_seq=oldest,
                requested_since_seq=since,
                reason="retention_cap",
            )

        # --- Step 2: SQLite backfill ---
        def _load_backfill() -> list[dict]:
            with Session(self._engine) as s:
                rows = s.exec(
                    select(AgentEvent)
                    .where(AgentEvent.run_id == run_id)
                    .where(AgentEvent.seq > since)
                    .order_by(AgentEvent.seq)
                ).all()
                return [
                    {
                        "seq": r.seq,
                        "ts": r.ts,
                        "kind": r.kind,
                        "payload": json.loads(r.payload),
                    }
                    for r in rows
                ]

        backfill = await asyncio.to_thread(_load_backfill)
        max_backfill_seq = since
        for row in backfill:
            evt = _deserialize_stored_event(row["payload"])
            if evt.seq > max_backfill_seq:
                max_backfill_seq = evt.seq
            yield evt

        # --- Step 3: live subscription with dedup ---
        q = await ch.subscribe()
        try:
            while True:
                evt = await q.get()
                if evt.seq <= max_backfill_seq:
                    continue  # SQLite already replayed this one
                yield evt
                if evt.kind == "run_complete":
                    return
        finally:
            ch.unsubscribe(q)

    async def enforce_retention(self, run_id: UUID) -> int:
        """Prune oldest events for ``run_id`` when row count exceeds the cap.

        Returns the number of rows pruned.
        """

        def _count_and_trim() -> int:
            with Session(self._engine) as s:
                count = s.exec(
                    text(
                        "SELECT COUNT(*) FROM agentevent WHERE run_id = :rid"
                    ).bindparams(rid=run_id.hex)
                ).one()[0]
                cap = settings.rapid_agent_event_retention_rows
                if count > cap:
                    excess = count - cap
                    s.exec(
                        text(
                            "DELETE FROM agentevent WHERE id IN ("
                            "  SELECT id FROM agentevent WHERE run_id = :rid "
                            "  ORDER BY seq ASC LIMIT :n"
                            ")"
                        ).bindparams(rid=run_id.hex, n=excess)
                    )
                    s.commit()
                    return excess
                return 0

        pruned = await asyncio.to_thread(_count_and_trim)
        return pruned
