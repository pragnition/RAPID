"""``AgentSessionManager`` — FastAPI-lifespan singleton that owns all live agent runs.

Responsibilities:

* ``start_run`` inserts a ``pending`` row, acquires the per-set mutex, and
  dispatches an ``asyncio.Task`` that runs the real SDK work — the call itself
  returns in under 200ms (the session does not block the API handler).
* Per-project :class:`asyncio.Semaphore` caps concurrent SDK subprocesses.
* Per-set :class:`asyncio.Lock` fronts the DB partial unique index
  ``uq_agent_run_active_set`` for fast rejection of duplicate active runs.
* Startup orphan sweep reaps rows whose PID no longer exists.
* Periodic 60s orphan sweep applies a 10-second young-run guard.
* 30-day archive runs every hour.
* Facade: ``send_input`` / ``interrupt`` / ``attach_events`` / ``get_run``.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import AsyncIterator
from uuid import UUID, uuid4

import sqlalchemy
from sqlmodel import Session, select

from app.agents.archive import archive_expired_runs
from app.agents.budget import RunBudget
from app.agents.correlation import bind_run_id
from app.agents.errors import StateError
from app.agents.event_bus import EventBus
from app.agents.permissions import resolve_policy
from app.agents.pid_liveness import is_pid_alive, send_sigterm
from app.agents.session import AgentSession
from app.config import settings
from app.database import Project
from app.models.agent_run import AgentRun
from app.schemas.sse_events import SseEvent

logger = logging.getLogger("rapid.agents.manager")

_ACTIVE_STATES = ("running", "waiting")
_ARCHIVE_INTERVAL_S = 3600.0
_YOUNG_RUN_GUARD_S = 10.0


class AgentSessionManager:
    """Lifespan-scoped singleton that owns every live :class:`AgentSession`."""

    def __init__(self, engine: sqlalchemy.Engine) -> None:
        self.engine = engine
        self.event_bus = EventBus(engine)

        # Per-project asyncio.Semaphore, lazily created.
        self._semaphores: dict[UUID, asyncio.Semaphore] = {}
        self._semaphore_lock = asyncio.Lock()

        # Per-set asyncio.Lock; key = (project_id, set_id). Fronts the DB
        # partial unique index — the DB is still the canonical backstop.
        self._set_locks: dict[tuple[UUID, str], asyncio.Lock] = {}
        self._set_lock_lock = asyncio.Lock()

        # Live sessions keyed by run_id.
        self._sessions: dict[UUID, AgentSession] = {}
        self._session_tasks: dict[UUID, asyncio.Task] = {}

        # Lifespan background tasks.
        self._orphan_sweep_task: asyncio.Task | None = None
        self._archive_task: asyncio.Task | None = None
        self._stopping = asyncio.Event()

    # ---------- lifespan ----------

    async def start(self) -> None:
        """Called from the FastAPI lifespan at startup."""
        reaped = await self._startup_orphan_sweep()
        logger.info("orphan sweep complete", extra={"reaped": reaped})
        self._orphan_sweep_task = asyncio.create_task(self._periodic_orphan_sweep())
        self._archive_task = asyncio.create_task(self._periodic_archive())

    async def stop(self) -> None:
        self._stopping.set()
        for task in (self._orphan_sweep_task, self._archive_task):
            if task is None:
                continue
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            except Exception:
                logger.exception("background task raised on shutdown")

        # Interrupt all live sessions.
        for run_id, session in list(self._sessions.items()):
            try:
                await session.interrupt()
            except Exception:
                logger.exception(
                    "error interrupting session on shutdown",
                    extra={"run_id": str(run_id)},
                )

        # Wait for dispatched tasks to finish.
        if self._session_tasks:
            await asyncio.gather(
                *self._session_tasks.values(), return_exceptions=True
            )

        await self.event_bus.close()

    # ---------- start_run ----------

    async def start_run(
        self,
        project_id: UUID,
        skill_name: str,
        skill_args: dict,
        prompt: str,
        set_id: str | None = None,
        worktree: Path | None = None,
    ) -> AgentRun:
        """Contract: return the created ``AgentRun`` row in under 200ms.

        The real SDK work runs on an :class:`asyncio.Task` dispatched before
        this method returns. If a run is already active for ``(project_id,
        set_id)``, raises :class:`StateError` (HTTP 409).
        """
        # Fast-path Python mutex check before touching the DB.
        if set_id is not None:
            async with self._set_lock_lock:
                existing_lock = self._set_locks.get((project_id, set_id))
            if existing_lock is not None and existing_lock.locked():
                raise StateError(
                    "A run is already active for this set",
                    detail={"project_id": str(project_id), "set_id": set_id},
                )

        # Resolve project root (needed before insert so the task can cd there).
        def _load_project() -> Project | None:
            with Session(self.engine) as s:
                return s.get(Project, project_id)

        project = await asyncio.to_thread(_load_project)
        if project is None:
            raise StateError(
                "Project not found", detail={"project_id": str(project_id)}
            )
        project_root = Path(project.path).resolve()

        # Insert AgentRun row (status=pending). The DB partial unique index is
        # the canonical correctness backstop.
        run_id = uuid4()
        policy = resolve_policy(skill_name)

        def _insert() -> AgentRun:
            try:
                with Session(self.engine) as s:
                    row = AgentRun(
                        id=run_id,
                        project_id=project_id,
                        set_id=set_id,
                        skill_name=skill_name,
                        skill_args=json.dumps(skill_args),
                        status="pending",
                        max_turns=int(policy["max_turns"]),
                    )
                    s.add(row)
                    s.commit()
                    s.refresh(row)
                    return row
            except sqlalchemy.exc.IntegrityError as e:
                raise StateError(
                    "Active run already exists for (project_id, set_id)",
                    detail={"project_id": str(project_id), "set_id": set_id},
                ) from e

        row = await asyncio.to_thread(_insert)

        # Acquire the per-set Python mutex. This is best-effort; the DB unique
        # index is the canonical guard.
        set_lock: asyncio.Lock | None = None
        if set_id is not None:
            async with self._set_lock_lock:
                set_lock = self._set_locks.setdefault(
                    (project_id, set_id), asyncio.Lock()
                )
            # Try to acquire without blocking. If already held, roll back and 409.
            try:
                await asyncio.wait_for(set_lock.acquire(), timeout=0.01)
                acquired = True
            except asyncio.TimeoutError:
                acquired = False
            if not acquired:
                def _rollback() -> None:
                    with Session(self.engine) as s:
                        x = s.get(AgentRun, run_id)
                        if x is not None:
                            s.delete(x)
                            s.commit()

                await asyncio.to_thread(_rollback)
                raise StateError(
                    "Set mutex busy",
                    detail={"project_id": str(project_id), "set_id": set_id},
                )

        # Dispatch the async task — does NOT block this return.
        task = asyncio.create_task(
            self._run_session(row, project_root, worktree, prompt, set_lock)
        )
        self._session_tasks[run_id] = task
        return row

    # ---------- task body ----------

    async def _run_session(
        self,
        row: AgentRun,
        project_root: Path,
        worktree: Path | None,
        prompt: str,
        set_lock: asyncio.Lock | None,
    ) -> None:
        try:
            sem = await self._get_semaphore(row.project_id)
            async with sem:
                budget = RunBudget(max_turns=row.max_turns)
                with bind_run_id(str(row.id)):
                    async with AgentSession(
                        run_id=row.id,
                        project_root=project_root,
                        worktree=worktree,
                        skill_name=row.skill_name,
                        skill_args=json.loads(row.skill_args),
                        prompt=prompt,
                        event_bus=self.event_bus,
                        engine=self.engine,
                        budget=budget,
                    ) as session:
                        self._sessions[row.id] = session
                        await session.run()
        except Exception:
            logger.exception("run crashed", extra={"run_id": str(row.id)})
        finally:
            self._sessions.pop(row.id, None)
            self._session_tasks.pop(row.id, None)
            if set_lock is not None and set_lock.locked():
                try:
                    set_lock.release()
                except RuntimeError:
                    # Lock was held by a different task — ignore.
                    pass

    async def _get_semaphore(self, project_id: UUID) -> asyncio.Semaphore:
        async with self._semaphore_lock:
            sem = self._semaphores.get(project_id)
            if sem is None:
                sem = asyncio.Semaphore(settings.rapid_agent_max_concurrent)
                self._semaphores[project_id] = sem
            return sem

    # ---------- facade ----------

    async def get_run(self, run_id: UUID) -> AgentRun:
        def _load() -> AgentRun | None:
            with Session(self.engine) as s:
                return s.get(AgentRun, run_id)

        row = await asyncio.to_thread(_load)
        if row is None:
            raise StateError("Run not found", detail={"run_id": str(run_id)})
        return row

    async def send_input(self, run_id: UUID, text: str) -> None:
        session = self._sessions.get(run_id)
        if session is None:
            raise StateError("Run not active", detail={"run_id": str(run_id)})
        await session.send_input(text)

    async def interrupt(self, run_id: UUID) -> None:
        session = self._sessions.get(run_id)
        if session is None:
            raise StateError("Run not active", detail={"run_id": str(run_id)})
        await session.interrupt()

    async def attach_events(
        self, run_id: UUID, since: int = 0
    ) -> AsyncIterator[SseEvent]:
        async for evt in self.event_bus.attach_events(run_id, since=since):
            yield evt

    # ---------- orphan sweep ----------

    async def _startup_orphan_sweep(self) -> int:
        def _sweep() -> int:
            reaped = 0
            now = datetime.now(timezone.utc)
            with Session(self.engine) as s:
                rows = s.exec(
                    select(AgentRun).where(
                        AgentRun.status.in_(list(_ACTIVE_STATES))  # type: ignore[attr-defined]
                    )
                ).all()
                for row in rows:
                    alive = is_pid_alive(row.pid)
                    if not alive:
                        row.status = "interrupted"
                        row.ended_at = now
                        row.error_code = "orphaned"
                        row.error_detail = json.dumps(
                            {"reason": "process_not_alive"}
                        )
                        s.add(row)
                        reaped += 1
                    else:
                        # Alive but we no longer own it (we just started up):
                        # send SIGTERM and mark as interrupted.
                        if row.pid is not None:
                            send_sigterm(row.pid)
                        row.status = "interrupted"
                        row.ended_at = now
                        row.error_code = "orphaned"
                        row.error_detail = json.dumps(
                            {"reason": "reaped_on_startup", "pid": row.pid}
                        )
                        s.add(row)
                        reaped += 1
                s.commit()
            return reaped

        return await asyncio.to_thread(_sweep)

    def _periodic_sweep_once(self) -> int:
        """Single periodic sweep pass. Separated for direct testing."""
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=_YOUNG_RUN_GUARD_S)
        reaped = 0
        with Session(self.engine) as s:
            rows = s.exec(
                select(AgentRun).where(
                    AgentRun.status.in_(list(_ACTIVE_STATES))  # type: ignore[attr-defined]
                )
            ).all()
            for row in rows:
                # Young-run guard: don't reap rows that just started.
                started = row.started_at
                if started is not None and started.tzinfo is None:
                    started = started.replace(tzinfo=timezone.utc)
                if started is not None and started > cutoff:
                    continue
                # Skip rows owned by an in-memory session.
                if row.id in self._sessions:
                    continue
                if not is_pid_alive(row.pid):
                    row.status = "interrupted"
                    row.ended_at = now
                    row.error_code = "orphaned"
                    row.error_detail = json.dumps(
                        {"reason": "process_not_alive_periodic"}
                    )
                    s.add(row)
                    reaped += 1
            s.commit()
        return reaped

    async def _periodic_orphan_sweep(self) -> None:
        interval = settings.rapid_agent_orphan_sweep_interval_s
        try:
            while not self._stopping.is_set():
                try:
                    await asyncio.wait_for(
                        self._stopping.wait(), timeout=interval
                    )
                    return
                except asyncio.TimeoutError:
                    pass
                try:
                    reaped = await asyncio.to_thread(self._periodic_sweep_once)
                except Exception:
                    logger.exception("periodic orphan sweep failed")
                    continue
                if reaped:
                    logger.info(
                        "periodic orphan sweep", extra={"reaped": reaped}
                    )
        except asyncio.CancelledError:
            return

    # ---------- archive ----------

    async def _periodic_archive(self) -> None:
        try:
            while not self._stopping.is_set():
                try:
                    await asyncio.wait_for(
                        self._stopping.wait(), timeout=_ARCHIVE_INTERVAL_S
                    )
                    return
                except asyncio.TimeoutError:
                    pass
                try:
                    archived = await archive_expired_runs(self.engine)
                    logger.info(
                        "archive pass complete",
                        extra={"archived_rows": archived},
                    )
                except Exception:
                    logger.exception("archive pass failed")
        except asyncio.CancelledError:
            return
