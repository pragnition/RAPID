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
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any, AsyncIterator

if TYPE_CHECKING:
    from app.services.skill_catalog_service import SkillCatalogService
from uuid import UUID, uuid4

from sqlalchemy import text as sa_text

import sqlalchemy
from sqlmodel import Session, select

from app.agents.archive import archive_expired_runs
from app.agents.budget import RunBudget
from app.agents.correlation import bind_card_id, bind_run_id
from app.agents.errors import StateError
from app.agents.event_bus import EventBus
from app.agents.permissions import resolve_policy
from app.agents.pid_liveness import is_pid_alive, send_sigterm
from app.agents.session import AgentSession
from app.config import settings
from app.database import Project
from app.models.agent_prompt import AgentPrompt
from app.models.agent_run import AgentRun
from app.schemas.sse_events import AskUserEvent, SseEvent
from app.services import kanban_service
from app.services.skill_frontmatter import read_skill_body

logger = logging.getLogger("rapid.agents.manager")

_ACTIVE_STATES = ("running", "waiting", "idle")
_ARCHIVE_INTERVAL_S = 3600.0
_YOUNG_RUN_GUARD_S = 10.0
_IDLE_TIMEOUT_S = 900.0  # 15 minutes


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
        self._idle_timeouts: dict[UUID, asyncio.Task] = {}

        # web-tool-bridge: pending prompt futures keyed by prompt_id. The MCP
        # tool body creates the future then awaits it; resolve_prompt sets
        # the result from the HTTP /answer path.
        self._prompt_futures: dict[str, asyncio.Future[str]] = {}
        # Per-run asyncio.Lock that fronts the partial unique index on
        # agentprompt. Prevents concurrent tool calls on the same run from
        # racing the DB constraint.
        self._prompt_locks: dict[UUID, asyncio.Lock] = {}

        # web-tool-bridge: tool_use_ids of AskUserQuestion calls that were
        # intercepted and answered successfully via _route_auq_through_bridge.
        # The SDK delivers the payload via PermissionResultDeny (is_error=True)
        # even on success, so the session pump consults this set to override
        # is_error=False on the emitted ToolResultEvent. Entries are removed
        # once observed.
        self._auq_success_tool_use_ids: dict[UUID, set[str]] = {}

        # Skill catalog reference — set from lifespan after catalog init.
        self._skill_catalog: "SkillCatalogService | None" = None

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
        logger.info("shutting down agent manager", extra={"live_sessions": len(self._sessions)})
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

        # Cancel all idle timeout tasks.
        for task in self._idle_timeouts.values():
            task.cancel()
        self._idle_timeouts.clear()

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

    def set_skill_catalog(self, catalog: "SkillCatalogService") -> None:
        """Inject the skill catalog after lifespan initializes both services."""
        self._skill_catalog = catalog

    def _enrich_prompt_with_skill(self, skill_name: str, prompt: str) -> str:
        """Prepend SKILL.md body to *prompt*, mirroring how the CLI injects skill content.

        Returns *prompt* unchanged when the catalog is unavailable or the
        skill has no body content.
        """
        if self._skill_catalog is None:
            return prompt
        meta = self._skill_catalog.current.get(skill_name)
        if meta is None or not meta.source_path.is_file():
            return prompt
        body = read_skill_body(meta.source_path)
        if not body.strip():
            return prompt
        return (
            f"<command-name>/rapid:{skill_name}</command-name>\n"
            f"{body}\n\n"
            f"ARGUMENTS: {prompt}"
        )

    # ---------- start_run ----------

    async def start_run(
        self,
        project_id: UUID,
        skill_name: str,
        skill_args: dict,
        prompt: str,
        set_id: str | None = None,
        worktree: Path | None = None,
        persistent: bool = False,
    ) -> AgentRun:
        """Contract: return the created ``AgentRun`` row in under 200ms.

        The real SDK work runs on an :class:`asyncio.Task` dispatched before
        this method returns. If a run is already active for ``(project_id,
        set_id)``, raises :class:`StateError` (HTTP 409).
        """
        logger.info("starting agent run", extra={"project_id": str(project_id), "skill_name": skill_name, "set_id": set_id})
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
            self._run_session(row, project_root, worktree, prompt, set_lock, persistent)
        )
        self._session_tasks[run_id] = task
        logger.info("agent run dispatched", extra={"run_id": str(run_id), "skill_name": skill_name, "set_id": set_id})
        return row

    # ---------- task body ----------

    async def _run_session(
        self,
        row: AgentRun,
        project_root: Path,
        worktree: Path | None,
        prompt: str,
        set_lock: asyncio.Lock | None,
        persistent: bool = False,
    ) -> None:
        # Parse card_id once so it's available in the finally block for
        # post-run card status updates.
        _raw_card_id: str | None = json.loads(row.skill_args).get("card_id")
        _card_uuid: UUID | None = UUID(_raw_card_id) if _raw_card_id else None

        try:
            sem = await self._get_semaphore(row.project_id)
            async with sem:
                logger.info("agent run acquired semaphore", extra={"run_id": str(row.id), "skill_name": row.skill_name})
                budget = RunBudget(max_turns=row.max_turns)
                with bind_run_id(str(row.id)):
                    # Autopilot runs carry a card_id in skill_args for trailer injection.
                    _card_ctx = bind_card_id(_raw_card_id) if _raw_card_id else nullcontext()
                    # Inject SKILL.md body into the user prompt so the agent
                    # has the full skill instructions (mirrors CLI behavior).
                    enriched_prompt = self._enrich_prompt_with_skill(
                        row.skill_name, prompt,
                    )
                    with _card_ctx:
                        async with AgentSession(
                            run_id=row.id,
                            project_root=project_root,
                            worktree=worktree,
                            skill_name=row.skill_name,
                            skill_args=json.loads(row.skill_args),
                            prompt=enriched_prompt,
                            event_bus=self.event_bus,
                            engine=self.engine,
                            budget=budget,
                            manager=self,
                            persistent=persistent,
                        ) as session:
                            self._sessions[row.id] = session
                            if persistent:
                                self._start_idle_timeout(row.id)
                            await session.run()
        except Exception:
            logger.exception("run crashed", extra={"run_id": str(row.id)})
        finally:
            logger.info("agent run session ended", extra={"run_id": str(row.id)})
            self._sessions.pop(row.id, None)
            self._session_tasks.pop(row.id, None)
            idle_task = self._idle_timeouts.pop(row.id, None)
            if idle_task is not None:
                idle_task.cancel()
            if set_lock is not None and set_lock.locked():
                try:
                    set_lock.release()
                except RuntimeError:
                    # Lock was held by a different task — ignore.
                    pass

            # --- Post-run card status update for autopilot cards ---
            if _card_uuid is not None:
                try:
                    await self._update_card_status_after_run(
                        row.id, _card_uuid
                    )
                except Exception:
                    logger.exception(
                        "failed to update card status after run",
                        extra={
                            "run_id": str(row.id),
                            "card_id": str(_card_uuid),
                        },
                    )

    def _update_card_status_after_run(
        self, run_id: UUID, card_id: UUID
    ) -> "asyncio.coroutine":
        """Read the final AgentRun status and update the kanban card accordingly.

        On success: set agent_status="completed", completed_by_run_id=run_id.
        On failure/interruption: set agent_status="blocked", increment
        retry_count, clear locked_by_run_id so autopilot can re-dispatch.
        """

        def _do(run_id: UUID, card_id: UUID) -> None:
            from app.database import KanbanCard

            with Session(self.engine) as s:
                run_row = s.get(AgentRun, run_id)
                if run_row is None:
                    logger.warning(
                        "card status update skipped: run not found",
                        extra={"run_id": str(run_id)},
                    )
                    return

                card = s.get(KanbanCard, card_id)
                if card is None:
                    logger.warning(
                        "card status update skipped: card not found",
                        extra={"run_id": str(run_id), "card_id": str(card_id)},
                    )
                    return

                final_status = run_row.status
                if final_status == "completed":
                    card.agent_status = "completed"
                    card.completed_by_run_id = run_id
                    card.rev += 1
                elif final_status in ("failed", "interrupted"):
                    card.agent_status = "blocked"
                    card.retry_count += 1
                    card.locked_by_run_id = None
                    card.rev += 1
                else:
                    # Run is still in a non-terminal state; skip update.
                    return

                s.add(card)
                s.commit()
                logger.info(
                    "card status updated after run",
                    extra={
                        "run_id": str(run_id),
                        "card_id": str(card_id),
                        "agent_status": card.agent_status,
                    },
                )

        return asyncio.to_thread(_do, run_id, card_id)

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

    async def list_runs(self, project_id: UUID) -> tuple[list[AgentRun], int]:
        def _query() -> tuple[list[AgentRun], int]:
            with Session(self.engine) as s:
                rows = s.exec(
                    select(AgentRun)
                    .where(AgentRun.project_id == project_id)
                    .order_by(AgentRun.started_at.desc())
                ).all()
                return list(rows), len(rows)

        return await asyncio.to_thread(_query)

    async def send_input(self, run_id: UUID, text: str) -> None:
        session = self._sessions.get(run_id)
        if session is None:
            raise StateError("Run not active", detail={"run_id": str(run_id)})
        await session.send_input(text)

    async def continue_session(self, run_id: UUID, text: str) -> bool:
        """Try to reuse a persistent idle session.

        Returns ``True`` if the session was found and resumed, ``False`` if the
        session is not in the registry or is not idle (caller must start a new
        run).
        """
        session = self._sessions.get(run_id)
        if session is None or not session.is_idle:
            return False
        # Cancel the idle timeout since a new query arrived
        timeout_task = self._idle_timeouts.pop(run_id, None)
        if timeout_task is not None:
            timeout_task.cancel()
        await session.send_input(text)
        # Start a new idle timeout for after this response finishes
        self._start_idle_timeout(run_id)
        return True

    def _start_idle_timeout(self, run_id: UUID) -> None:
        """Start (or restart) the idle timeout for a persistent session."""
        old = self._idle_timeouts.pop(run_id, None)
        if old is not None:
            old.cancel()
        self._idle_timeouts[run_id] = asyncio.create_task(
            self._idle_timeout_task(run_id)
        )

    async def _idle_timeout_task(self, run_id: UUID) -> None:
        """Monitor a persistent session: when it goes idle, wait
        ``_IDLE_TIMEOUT_S`` then interrupt it. Loops to handle multiple
        idle/resume cycles. Cancelled when the session exits.
        """
        try:
            while True:
                session = self._sessions.get(run_id)
                if session is None:
                    return
                # Wait for the session to enter idle
                await session._idle.wait()
                # Now idle — wait for the timeout
                try:
                    await asyncio.sleep(_IDLE_TIMEOUT_S)
                except asyncio.CancelledError:
                    return
                # Check if still idle after sleeping
                session = self._sessions.get(run_id)
                if session is not None and session.is_idle:
                    # Do not disconnect a session that is waiting on a user
                    # answer. The AgentPrompt row (status='pending') is the
                    # source of truth — if one exists, re-arm the timer.
                    pending = await self.get_pending_prompt(run_id)
                    if pending is not None:
                        logger.info(
                            "idle timeout deferred — prompt pending",
                            extra={
                                "run_id": str(run_id),
                                "prompt_id": pending.id,
                            },
                        )
                        continue  # re-arm: loop back to await session._idle.wait()
                    logger.info(
                        "idle timeout — interrupting persistent session",
                        extra={"run_id": str(run_id)},
                    )
                    try:
                        await session.interrupt()
                    except Exception:
                        logger.exception(
                            "error interrupting idle session",
                            extra={"run_id": str(run_id)},
                        )
                    return
        except asyncio.CancelledError:
            return

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

    # ---------- prompt facade (web-tool-bridge) ----------

    def _get_prompt_lock(self, run_id: UUID) -> asyncio.Lock:
        return self._prompt_locks.setdefault(run_id, asyncio.Lock())

    async def resolve_prompt(
        self, run_id: UUID, prompt_id: str, answer: str
    ) -> None:
        """Settle a pending prompt with the user's answer.

        Updates the row to ``status='answered'`` + ``answer`` + ``answered_at``
        under the per-run prompt lock, then fulfils the in-memory future so
        the tool body returns to the SDK. Raises StateError with a sub-code
        when the prompt is missing or no longer pending.
        """

        def _load_and_answer() -> AgentPrompt | None:
            with Session(self.engine) as s:
                row = s.get(AgentPrompt, prompt_id)
                if row is None:
                    return None
                if row.run_id != run_id:
                    return None
                if row.status != "pending":
                    # Signal "stale" via the returned row's status field.
                    return row
                row.status = "answered"
                row.answer = answer
                row.answered_at = datetime.now(timezone.utc)
                s.add(row)
                s.commit()
                s.refresh(row)
                return row

        async with self._get_prompt_lock(run_id):
            row = await asyncio.to_thread(_load_and_answer)
            if row is None:
                raise StateError(
                    "Prompt not found",
                    detail={"prompt_id": prompt_id, "run_id": str(run_id)},
                    error_code="prompt_not_found",
                    http_status=404,
                )
            if row.status != "answered":
                # Row existed but was not pending when we looked.
                raise StateError(
                    "Prompt is not pending",
                    detail={
                        "prompt_id": prompt_id,
                        "run_id": str(run_id),
                        "status": row.status,
                    },
                    error_code="prompt_stale",
                    http_status=409,
                )

            fut = self._prompt_futures.get(prompt_id)
            if fut is not None and not fut.done():
                fut.set_result(answer)

    async def get_pending_prompt(self, run_id: UUID) -> AgentPrompt | None:
        """Return the single pending prompt for ``run_id`` (or None)."""

        def _load() -> AgentPrompt | None:
            with Session(self.engine) as s:
                rows = s.exec(
                    select(AgentPrompt)
                    .where(AgentPrompt.run_id == run_id)
                    .where(AgentPrompt.status == "pending")
                    .order_by(AgentPrompt.created_at.desc())  # type: ignore[attr-defined]
                    .limit(1)
                ).all()
                return rows[0] if rows else None

        return await asyncio.to_thread(_load)

    async def reopen_prompt(self, run_id: UUID, prompt_id: str) -> None:
        """Transition an answered prompt back to ``pending``.

        Downstream prompts (created after the target) are marked ``stale``.
        Returns:
          * 404 (``prompt_not_found``) when the id doesn't match a row for
            this run.
          * 400 (``prompt_already_pending``) when there's nothing to reopen.
          * 409 (``answer_consumed``) when the agent already saw the answer.
        """

        def _load_target() -> AgentPrompt | None:
            with Session(self.engine) as s:
                row = s.get(AgentPrompt, prompt_id)
                if row is None:
                    return None
                if row.run_id != run_id:
                    return None
                return row

        def _stale_downstream_and_reopen(
            target_created_at: datetime,
        ) -> tuple[AgentPrompt, str]:
            with Session(self.engine) as s:
                rows = s.exec(
                    select(AgentPrompt)
                    .where(AgentPrompt.run_id == run_id)
                    .where(AgentPrompt.created_at > target_created_at)
                    .where(AgentPrompt.status.in_(["pending", "answered"]))  # type: ignore[attr-defined]
                ).all()
                for r in rows:
                    r.status = "stale"
                    s.add(r)
                target = s.get(AgentPrompt, prompt_id)
                assert target is not None
                target.status = "pending"
                target.answer = None
                target.answered_at = None
                target.consumed_at = None
                s.add(target)
                s.commit()
                s.refresh(target)
                return target, target.payload

        async with self._get_prompt_lock(run_id):
            target = await asyncio.to_thread(_load_target)
            if target is None:
                raise StateError(
                    "Prompt not found",
                    detail={"prompt_id": prompt_id, "run_id": str(run_id)},
                    error_code="prompt_not_found",
                    http_status=404,
                )
            if target.status == "pending":
                raise StateError(
                    "Nothing to reopen; prompt is already pending",
                    detail={"prompt_id": prompt_id},
                    error_code="prompt_already_pending",
                    http_status=400,
                )
            if target.status == "answered" and target.consumed_at is not None:
                raise StateError(
                    "Answer already consumed; interrupt the run to revise",
                    detail={"prompt_id": prompt_id},
                    error_code="answer_consumed",
                    http_status=409,
                )

            reopened, payload_json = await asyncio.to_thread(
                _stale_downstream_and_reopen, target.created_at
            )

            # Cancel and replace any lingering future for this prompt_id so
            # a future resolve_prompt() lands on a fresh awaitable.
            old_fut = self._prompt_futures.pop(prompt_id, None)
            if old_fut is not None and not old_fut.done():
                old_fut.cancel()
            loop = asyncio.get_running_loop()
            self._prompt_futures[prompt_id] = loop.create_future()

            # Re-emit the ask_user event so reconnected clients see the now-
            # pending prompt in the SSE stream.
            try:
                payload = json.loads(payload_json)
            except Exception:
                payload = {}
            channel = await self.event_bus.get_or_create_channel(run_id)
            seq = channel.next_seq()
            event = AskUserEvent(
                seq=seq,
                ts=datetime.now(timezone.utc),
                run_id=run_id,
                prompt_id=prompt_id,
                tool_use_id="",
                question=str(payload.get("question", "")),
                options=payload.get("options"),
                allow_free_text=bool(payload.get("allow_free_text", True)),
            )
            await self.event_bus.publish(run_id, event)

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
