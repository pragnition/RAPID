# Wave 3 PLAN: Session Lifecycle

**Set:** agent-runtime-foundation
**Wave:** 3 of 4 — Session Lifecycle (long-lived runtime)
**Working root:** `web/backend/`

## Objective

Implement the long-lived runtime layer that owns every live `ClaudeSDKClient`: the `AgentSession` async context manager + SDK pump task (with dual wall-clock / active-duration tracking), the `AgentSessionManager` lifespan-service singleton (per-project `asyncio.Semaphore`, per-set Python `asyncio.Lock` registry fronting the DB partial unique index, orphan sweeper at startup + periodic 60s sweep, `send_input`/`interrupt` wiring), and the 30-day archive-to-JSONL job that complements Wave 2's row-cap prune. This wave is integration-tested against the real SDK where possible and mock-tested for destructive paths (interrupt timeouts, orphan PIDs) that are hard to exercise live.

## Prerequisite: Waves 1 and 2 artifacts must exist

Required: `build_sdk_options`, `can_use_tool_hook`, `destructive_pre_tool_hook`, `EventBus` + `RunChannel`, `RunBudget`, `AgentRun` + `AgentEvent` models, SSE Pydantic union, `correlation.bind_run_id`, `error_mapping`.

## Tasks

### Task 1 — `app/agents/pid_liveness.py` — OS-level liveness helper (no psutil)

**File to create:** `app/agents/pid_liveness.py`

**Requirements:**

```python
from __future__ import annotations
import os
import signal as _signal

def is_pid_alive(pid: int | None) -> bool:
    if pid is None or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        # Process exists but we cannot signal it (owned by another user).
        return True

def send_sigterm(pid: int) -> bool:
    if not is_pid_alive(pid):
        return False
    try:
        os.kill(pid, _signal.SIGTERM)
        return True
    except (ProcessLookupError, PermissionError):
        return False
```

- No external deps. No psutil. CONTEXT.md explicitly rejects psutil.

### Task 2 — `app/agents/session.py` — `AgentSession` async context manager + pump

**File to create:** `app/agents/session.py`

**Imports:**

```python
from __future__ import annotations
import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from uuid import UUID

from claude_agent_sdk import (
    ClaudeSDKClient, AssistantMessage, UserMessage, SystemMessage, ResultMessage,
    TextBlock, ToolUseBlock, ThinkingBlock, ClaudeSDKError,
)
import sqlalchemy
from sqlmodel import Session

from app.agents.budget import RunBudget
from app.agents.correlation import bind_run_id, run_id_var
from app.agents.errors import SdkError, RunError
from app.agents.event_bus import EventBus
from app.agents.sdk_options import build_sdk_options
from app.models.agent_run import AgentRun
from app.schemas.sse_events import (
    AssistantTextEvent, ThinkingEvent, ToolUseEvent, ToolResultEvent,
    StatusEvent, RunCompleteEvent, PermissionReqEvent,
)

logger = logging.getLogger("rapid.agents.session")
```

**Class sketch:**

```python
class AgentSession:
    """One-shot async-context-managed wrapper around ClaudeSDKClient for a single run."""

    def __init__(
        self,
        run_id: UUID,
        project_root: Path,
        worktree: Path | None,
        skill_name: str,
        skill_args: dict,
        prompt: str,
        event_bus: EventBus,
        engine: sqlalchemy.Engine,
        budget: RunBudget,
    ) -> None:
        self.run_id = run_id
        self.project_root = project_root
        self.worktree = worktree
        self.skill_name = skill_name
        self.skill_args = skill_args
        self.prompt = prompt
        self.event_bus = event_bus
        self.engine = engine
        self.budget = budget

        self._client: ClaudeSDKClient | None = None
        self._options = None
        self._pump_task: asyncio.Task | None = None
        self._interrupted = asyncio.Event()
        self._input_queue: asyncio.Queue[str] = asyncio.Queue()
        self._waiting = asyncio.Event()  # set while run is waiting on ask_user/permission_req
        self._started_ts_mono: float = 0.0
        self._active_seconds: float = 0.0  # excludes _waiting time
        self._waiting_started_mono: float | None = None
        self.pid: int | None = None
```

**Async context manager:**

```python
async def __aenter__(self) -> "AgentSession":
    self._options = build_sdk_options(
        project_root=self.project_root,
        worktree=self.worktree,
        skill_name=self.skill_name,
        skill_args=self.skill_args,
        run_id=str(self.run_id),
    )
    self._client = ClaudeSDKClient(options=self._options)
    await self._client.connect()
    # After connect, the SDK subprocess is running. Record PID for orphan sweep.
    self.pid = getattr(getattr(self._client, "_process", None), "pid", None)
    await self._update_db(status="running", pid=self.pid, started_at=datetime.now(timezone.utc))
    self._started_ts_mono = time.monotonic()
    await self._emit(StatusEvent(
        seq=await self._next_seq(), ts=datetime.now(timezone.utc),
        run_id=self.run_id, kind="status", status="running",
    ))
    return self

async def __aexit__(self, exc_type, exc, tb) -> None:
    try:
        if self._client is not None:
            try:
                await asyncio.wait_for(self._client.disconnect(), timeout=5.0)
            except asyncio.TimeoutError:
                logger.warning("disconnect timeout", extra={"run_id": str(self.run_id)})
    finally:
        await self.event_bus.close_channel(self.run_id)
```

**Pump task:**

```python
async def run(self) -> None:
    """Drive the SDK event pump to completion. Call after __aenter__."""
    try:
        with bind_run_id(str(self.run_id)):
            await self._client.query(self.prompt)
            async for msg in self._client.receive_response():
                if self._interrupted.is_set():
                    break
                await self._handle_message(msg)
                if isinstance(msg, ResultMessage):
                    break
                status = await self.budget.check()
                if status.halted:
                    logger.info("budget halted", extra={"reason": status.halt_reason})
                    await self._client.interrupt()
                    await self._emit_run_complete(status_text="failed", error_code="budget_exceeded")
                    return
        if self._interrupted.is_set():
            await self._emit_run_complete(status_text="interrupted")
        else:
            # Normal completion already emitted via ResultMessage.
            pass
    except ClaudeSDKError as e:
        await self._emit_run_complete(status_text="failed", error_code="sdk_error",
                                      error_detail={"type": type(e).__name__, "msg": str(e)})
        raise SdkError(str(e)) from e
    except Exception as e:
        await self._emit_run_complete(status_text="failed", error_code="run_error",
                                      error_detail={"type": type(e).__name__, "msg": str(e)})
        raise RunError(str(e)) from e
```

**Message handlers (one per Message subtype):**

```python
async def _handle_message(self, msg) -> None:
    ts = datetime.now(timezone.utc)
    if isinstance(msg, AssistantMessage):
        for block in msg.content:
            if isinstance(block, TextBlock):
                await self._emit(AssistantTextEvent(
                    seq=await self._next_seq(), ts=ts, run_id=self.run_id,
                    kind="assistant_text", text=block.text,
                ))
            elif isinstance(block, ThinkingBlock):
                await self._emit(ThinkingEvent(
                    seq=await self._next_seq(), ts=ts, run_id=self.run_id,
                    kind="thinking", text=block.text,
                ))
            elif isinstance(block, ToolUseBlock):
                await self._emit(ToolUseEvent(
                    seq=await self._next_seq(), ts=ts, run_id=self.run_id,
                    kind="tool_use",
                    tool_name=block.name, tool_use_id=block.id, input=dict(block.input),
                ))
    elif isinstance(msg, UserMessage):
        # tool_result messages come back as UserMessage with tool_result blocks
        for block in getattr(msg, "content", []):
            if getattr(block, "type", None) == "tool_result":
                await self._emit(ToolResultEvent(
                    seq=await self._next_seq(), ts=ts, run_id=self.run_id,
                    kind="tool_result",
                    tool_use_id=block.tool_use_id,
                    output=block.content,
                    is_error=bool(getattr(block, "is_error", False)),
                ))
    elif isinstance(msg, SystemMessage):
        # Currently only logged; skill init messages are routed through stderr.
        logger.debug("system message", extra={"subtype": getattr(msg, "subtype", None)})
    elif isinstance(msg, ResultMessage):
        cost = float(getattr(msg, "total_cost_usd", 0.0) or 0.0)
        await self.budget.record_turn(cost)
        turn_count = int(getattr(msg, "num_turns", 0) or 0)
        duration_s = float(getattr(msg, "duration_ms", 0) or 0) / 1000.0
        status_text = "failed" if getattr(msg, "is_error", False) else "completed"
        await self._update_db(
            status=status_text, total_cost_usd=cost, turn_count=turn_count,
            ended_at=datetime.now(timezone.utc),
        )
        await self._emit(RunCompleteEvent(
            seq=await self._next_seq(), ts=ts, run_id=self.run_id,
            kind="run_complete", status=status_text,
            total_cost_usd=cost, turn_count=turn_count, duration_s=duration_s,
            error_code=None, error_detail=None,
        ))
```

**Helpers:**

```python
async def _next_seq(self) -> int:
    ch = await self.event_bus.get_or_create_channel(self.run_id)
    return ch.next_seq()

async def _emit(self, event) -> None:
    await self.event_bus.publish(self.run_id, event)

async def _update_db(self, **fields) -> None:
    def _upd():
        with Session(self.engine) as s:
            row = s.get(AgentRun, self.run_id)
            if row is None:
                return
            for k, v in fields.items():
                setattr(row, k, v)
            s.add(row); s.commit()
    await asyncio.to_thread(_upd)

async def _emit_run_complete(self, status_text: str, error_code: str | None = None,
                             error_detail: dict | None = None) -> None:
    ended = datetime.now(timezone.utc)
    duration_s = time.monotonic() - self._started_ts_mono
    await self._update_db(
        status=status_text, ended_at=ended,
        total_wall_clock_s=duration_s, active_duration_s=self._active_seconds,
        error_code=error_code,
        error_detail=json.dumps(error_detail or {}),
    )
    status = await self.budget.check()
    await self._emit(RunCompleteEvent(
        seq=await self._next_seq(), ts=ended, run_id=self.run_id,
        kind="run_complete", status=status_text,
        total_cost_usd=status.cost_used_usd, turn_count=status.turns_used,
        duration_s=duration_s, error_code=error_code, error_detail=error_detail,
    ))
```

**`interrupt` + `send_input`:**

```python
async def interrupt(self) -> None:
    self._interrupted.set()
    if self._client is not None:
        try:
            await asyncio.wait_for(self._client.interrupt(), timeout=10.0)
        except asyncio.TimeoutError:
            logger.warning("interrupt timeout -- synthesizing run_complete",
                           extra={"run_id": str(self.run_id)})
            await self._emit_run_complete(status_text="interrupted",
                                           error_code="interrupt_timeout")

async def send_input(self, text: str) -> None:
    if self._client is None:
        raise RunError("session not connected")
    await self._client.query(text)
```

**Dual-time tracking:** when the session emits `permission_req` or `ask_user`, call `self._enter_waiting()`; when ask_user answered or auto-resumed, call `self._leave_waiting()`. Stub:

```python
def _enter_waiting(self) -> None:
    self._waiting.set()
    self._waiting_started_mono = time.monotonic()

def _leave_waiting(self) -> None:
    if self._waiting_started_mono is None:
        return
    self._active_seconds += (time.monotonic() - self._waiting_started_mono) * 0.0  # placeholder
    # Correct: active_seconds accumulates NON-waiting time; computed at finish
    # as total_wall - sum(waiting_intervals). Simpler approach:
    waited = time.monotonic() - self._waiting_started_mono
    # Stash for later subtraction.
    self._active_seconds -= waited  # inverse: add waiting time negatively so
                                     # active = wall - waiting elsewhere.
    self._waiting_started_mono = None
    self._waiting.clear()
```

(Executor may refactor the waiting-interval math as long as `total_wall_clock_s` ≥ `active_duration_s` ≥ 0 is invariant. A cleaner approach is accumulating a `_waiting_total_s` then computing `active = wall - waiting_total` at finish. Tests in Task 6 will assert the invariant.)

### Task 3 — `app/agents/archive.py` — 30-day JSONL archive writer

**File to create:** `app/agents/archive.py`

**Requirements:**

- Responsibility: write completed/failed/interrupted runs' `agent_event` rows older than `settings.rapid_agent_event_retention_days` (default 30) to JSONL files under `settings.rapid_agent_archive_dir / <project_id> / <run_id>.jsonl`, then delete the archived rows.

- Function:

  ```python
  async def archive_expired_runs(engine: sqlalchemy.Engine) -> int:
      """Archive agent_event rows for runs whose ended_at is older than
      retention_days. Returns number of rows archived. Idempotent: re-running
      against an already-archived run is a no-op because rows are deleted
      after successful file write."""
  ```

- Atomicity: write to tempfile in the archive dir, `os.replace()` to final name.
- All FS I/O goes through `asyncio.to_thread`.
- Must tolerate the archive dir not existing (create it).
- Skip runs whose `status in {"running","waiting","pending"}` (only archive terminal states).

### Task 4 — `app/agents/session_manager.py` — `AgentSessionManager` lifespan service

**File to create:** `app/agents/session_manager.py`

**Imports:**

```python
from __future__ import annotations
import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator
from uuid import UUID, uuid4

import sqlalchemy
from sqlmodel import Session, select

from app.agents.archive import archive_expired_runs
from app.agents.budget import RunBudget
from app.agents.correlation import bind_run_id
from app.agents.errors import StateError, RunError, SdkError
from app.agents.event_bus import EventBus
from app.agents.permissions import resolve_policy
from app.agents.pid_liveness import is_pid_alive, send_sigterm
from app.agents.session import AgentSession
from app.config import settings
from app.database import Project
from app.models.agent_run import AgentRun
from app.schemas.sse_events import SseEvent, StatusEvent

logger = logging.getLogger("rapid.agents.manager")
```

**Class structure:**

```python
class AgentSessionManager:
    def __init__(self, engine: sqlalchemy.Engine) -> None:
        self.engine = engine
        self.event_bus = EventBus(engine)
        # Per-project asyncio.Semaphore, lazy-created on first use
        self._semaphores: dict[UUID, asyncio.Semaphore] = {}
        self._semaphore_lock = asyncio.Lock()  # guards _semaphores dict
        # Per-set asyncio.Lock; key = (project_id, set_id)
        self._set_locks: dict[tuple[UUID, str], asyncio.Lock] = {}
        self._set_lock_lock = asyncio.Lock()
        # Live sessions
        self._sessions: dict[UUID, AgentSession] = {}
        self._session_tasks: dict[UUID, asyncio.Task] = {}
        # Lifespan tasks
        self._orphan_sweep_task: asyncio.Task | None = None
        self._archive_task: asyncio.Task | None = None
        self._stopping = asyncio.Event()

    async def start(self) -> None:
        """Called from FastAPI lifespan at startup."""
        reaped = await self._startup_orphan_sweep()
        logger.info("orphan sweep complete", extra={"reaped": reaped})
        self._orphan_sweep_task = asyncio.create_task(self._periodic_orphan_sweep())
        self._archive_task = asyncio.create_task(self._periodic_archive())

    async def stop(self) -> None:
        self._stopping.set()
        for task in (self._orphan_sweep_task, self._archive_task):
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        # Interrupt all live sessions
        for run_id, session in list(self._sessions.items()):
            try:
                await session.interrupt()
            except Exception:
                logger.exception("error interrupting session on shutdown")
        await asyncio.gather(*self._session_tasks.values(), return_exceptions=True)
        await self.event_bus.close()
```

**`start_run`:**

```python
async def start_run(
    self,
    project_id: UUID,
    skill_name: str,
    skill_args: dict,
    prompt: str,
    set_id: str | None = None,
    worktree: Path | None = None,
) -> AgentRun:
    """<200ms contract: create DB row + dispatch asyncio.Task + return immediately."""
    # 1. Fast-path mutex check (Python lock + DB row count)
    if set_id is not None:
        key = (project_id, set_id)
        async with self._set_lock_lock:
            existing_lock = self._set_locks.get(key)
        if existing_lock is not None and existing_lock.locked():
            raise StateError(
                "A run is already active for this set",
                detail={"project_id": str(project_id), "set_id": set_id},
            )

    # 2. Resolve project root
    def _load_project() -> Project | None:
        with Session(self.engine) as s:
            return s.get(Project, project_id)
    project = await asyncio.to_thread(_load_project)
    if project is None:
        raise StateError("Project not found", detail={"project_id": str(project_id)})
    project_root = Path(project.path).resolve()

    # 3. Insert AgentRun row (status=pending). DB unique index is correctness backstop.
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
                s.add(row); s.commit(); s.refresh(row)
                return row
        except sqlalchemy.exc.IntegrityError as e:
            raise StateError(
                "Active run already exists for (project_id, set_id)",
                detail={"project_id": str(project_id), "set_id": set_id},
            ) from e
    row = await asyncio.to_thread(_insert)

    # 4. Acquire set mutex (non-blocking); defer semaphore wait to the task body.
    set_lock: asyncio.Lock | None = None
    if set_id is not None:
        async with self._set_lock_lock:
            set_lock = self._set_locks.setdefault((project_id, set_id), asyncio.Lock())
        # Python lock is best-effort; DB unique index is canonical.
        acquired = set_lock.locked() is False and await asyncio.wait_for(
            set_lock.acquire(), timeout=0.01
        ) is None
        if not acquired:
            # Roll back the row and 409.
            def _rollback():
                with Session(self.engine) as s:
                    x = s.get(AgentRun, run_id)
                    if x: s.delete(x); s.commit()
            await asyncio.to_thread(_rollback)
            raise StateError("Set mutex busy", detail={"set_id": set_id})

    # 5. Dispatch the async task (does NOT block response)
    task = asyncio.create_task(
        self._run_session(row, project_root, worktree, prompt, set_lock)
    )
    self._session_tasks[run_id] = task
    return row
```

**`_run_session` (awaited by the dispatched Task, not by start_run):**

```python
async def _run_session(
    self, row: AgentRun, project_root: Path, worktree: Path | None,
    prompt: str, set_lock: asyncio.Lock | None,
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
            set_lock.release()
```

**`_get_semaphore` with loop-safe creation:**

```python
async def _get_semaphore(self, project_id: UUID) -> asyncio.Semaphore:
    async with self._semaphore_lock:
        sem = self._semaphores.get(project_id)
        if sem is None:
            sem = asyncio.Semaphore(settings.rapid_agent_max_concurrent)
            self._semaphores[project_id] = sem
        return sem
```

**Facade methods:**

```python
async def get_run(self, run_id: UUID) -> AgentRun:
    def _load():
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

async def attach_events(self, run_id: UUID, since: int = 0) -> AsyncIterator[SseEvent]:
    async for evt in self.event_bus.attach_events(run_id, since=since):
        yield evt
```

**Startup orphan sweep:**

```python
async def _startup_orphan_sweep(self) -> int:
    def _sweep() -> int:
        reaped = 0
        with Session(self.engine) as s:
            rows = s.exec(
                select(AgentRun).where(AgentRun.status.in_(["running", "waiting"]))
            ).all()
            for row in rows:
                alive = is_pid_alive(row.pid)
                if not alive:
                    row.status = "interrupted"
                    row.ended_at = datetime.now(timezone.utc)
                    row.error_code = "orphaned"
                    row.error_detail = json.dumps({"reason": "process_not_alive"})
                    s.add(row); reaped += 1
                else:
                    # Alive but orphaned (no in-memory session owns it after restart):
                    # SIGTERM and mark interrupted.
                    send_sigterm(row.pid)
                    row.status = "interrupted"
                    row.ended_at = datetime.now(timezone.utc)
                    row.error_code = "orphaned"
                    row.error_detail = json.dumps({"reason": "reaped_on_startup", "pid": row.pid})
                    s.add(row); reaped += 1
            s.commit()
        return reaped
    return await asyncio.to_thread(_sweep)
```

**Periodic orphan sweep (every 60s):**

```python
async def _periodic_orphan_sweep(self) -> None:
    interval = settings.rapid_agent_orphan_sweep_interval_s
    try:
        while not self._stopping.is_set():
            try:
                await asyncio.wait_for(self._stopping.wait(), timeout=interval)
                return
            except asyncio.TimeoutError:
                pass
            # Only reap rows whose started_at is > 10s old (race guard)
            def _sweep() -> int:
                cutoff = datetime.now(timezone.utc).timestamp() - 10.0
                reaped = 0
                with Session(self.engine) as s:
                    rows = s.exec(
                        select(AgentRun).where(AgentRun.status.in_(["running", "waiting"]))
                    ).all()
                    for row in rows:
                        if row.started_at.timestamp() > cutoff:
                            continue  # too young, let it run
                        if row.id in self._sessions:
                            continue  # owned in-process
                        if not is_pid_alive(row.pid):
                            row.status = "interrupted"
                            row.ended_at = datetime.now(timezone.utc)
                            row.error_code = "orphaned"
                            row.error_detail = json.dumps({"reason": "process_not_alive_periodic"})
                            s.add(row); reaped += 1
                    s.commit()
                return reaped
            reaped = await asyncio.to_thread(_sweep)
            if reaped:
                logger.info("periodic orphan sweep", extra={"reaped": reaped})
    except asyncio.CancelledError:
        return
```

**Periodic archive (every hour):**

```python
async def _periodic_archive(self) -> None:
    try:
        while not self._stopping.is_set():
            try:
                await asyncio.wait_for(self._stopping.wait(), timeout=3600.0)
                return
            except asyncio.TimeoutError:
                pass
            try:
                archived = await archive_expired_runs(self.engine)
                logger.info("archive pass complete", extra={"archived_rows": archived})
            except Exception:
                logger.exception("archive pass failed")
    except asyncio.CancelledError:
        return
```

### Task 5 — `app/agents/__init__.py` — re-exports

**File to edit:** `app/agents/__init__.py` (Wave 1 created it empty; Wave 3 is allowed to edit it for re-exports because Wave 1 reserved the file but only filled it with an empty init.)

**Contract-stable exports:** (match `CONTRACT.json` ExportNames exactly)

```python
from app.agents.errors import (
    AgentBaseError, SdkError, RunError, StateError, ToolError, UserError,
    RETRYABLE_ERROR_CODES,
)
from app.agents.correlation import run_id_var, bind_run_id, get_run_id, SAFE_ENV_KEYS, RunIdLogFilter
from app.agents.permissions import (
    PERMISSION_POLICY, DESTRUCTIVE_PATTERNS, resolve_policy, is_destructive,
)
from app.agents.permission_hooks import can_use_tool_hook, destructive_pre_tool_hook
from app.agents.sdk_options import build_sdk_options, RAPID_RUN_MODE
from app.agents.event_bus import EventBus, RunChannel
from app.agents.budget import RunBudget, BudgetStatus
from app.agents.mcp_registration import register_mcp_tools
from app.agents.error_mapping import to_http_exception, install_agent_error_handlers
from app.agents.session import AgentSession
from app.agents.session_manager import AgentSessionManager

__all__ = [
    # errors
    "AgentBaseError", "SdkError", "RunError", "StateError", "ToolError", "UserError",
    "RETRYABLE_ERROR_CODES",
    # correlation
    "run_id_var", "bind_run_id", "get_run_id", "SAFE_ENV_KEYS", "RunIdLogFilter",
    # permissions
    "PERMISSION_POLICY", "DESTRUCTIVE_PATTERNS", "resolve_policy", "is_destructive",
    "can_use_tool_hook", "destructive_pre_tool_hook",
    # sdk options
    "build_sdk_options", "RAPID_RUN_MODE",
    # event bus
    "EventBus", "RunChannel",
    # budget
    "RunBudget", "BudgetStatus",
    # mcp
    "register_mcp_tools",
    # error mapping
    "to_http_exception", "install_agent_error_handlers",
    # session
    "AgentSession", "AgentSessionManager",
]
```

**Ownership note:** Wave 1 shipped `__init__.py` empty on purpose. Wave 3 owns its final contents because only at Wave 3 do all symbols exist. No other wave modifies this file after Wave 3.

### Task 6 — Wave 3 tests

**File to create:** `tests/agents/test_pid_liveness.py`

- `test_none_pid_not_alive()` — `is_pid_alive(None) is False`.
- `test_zero_pid_not_alive()` — `is_pid_alive(0) is False`.
- `test_current_process_alive()` — `is_pid_alive(os.getpid()) is True`.
- `test_nonexistent_pid_not_alive()` — find an unused high PID; `is_pid_alive(999999) is False`.
- `test_send_sigterm_returns_false_for_dead()` — `send_sigterm(999999) is False`.

**File to create:** `tests/agents/test_session.py`

(Mock-heavy — we do not spawn a real SDK subprocess here; Wave 4 smoke test does.)

- `test_session_emits_status_event_on_enter(mock_sdk_client, tables, session)` — use `unittest.mock.AsyncMock`-patched `ClaudeSDKClient`. Enter context; assert a `StatusEvent(status="running")` is in the event_bus channel ring for the run_id.
- `test_handle_text_block_emits_assistant_text(tables)` — instantiate `AgentSession` with mocked client; manually call `_handle_message(AssistantMessage(content=[TextBlock(text="hi")]))`; assert an `AssistantTextEvent` was published.
- `test_handle_tool_use_emits_tool_use(tables)` — analogous with `ToolUseBlock`.
- `test_handle_result_updates_db(tables)` — feed a `ResultMessage(total_cost_usd=0.12, num_turns=5, duration_ms=1500, is_error=False)`. Assert DB row has `total_cost_usd==0.12`, `turn_count==5`, `status=="completed"`. Assert a `RunCompleteEvent` was emitted.
- `test_interrupt_timeout_synthesizes_run_complete(tables)` — patch `client.interrupt` to block forever. Call `session.interrupt()`. After `asyncio.wait_for(..., 11s)`, assert a `RunCompleteEvent(status="interrupted", error_code="interrupt_timeout")` was emitted.
- `test_wall_clock_ge_active_duration(tables)` — after a run with a simulated `_enter_waiting` / `_leave_waiting` around 200ms, assert `total_wall_clock_s >= active_duration_s >= 0`.

**File to create:** `tests/agents/test_session_manager.py`

- `test_start_run_returns_in_under_200ms(tables, monkeypatch)` — monkeypatch `AgentSession.__aenter__` and `.run` to `AsyncMock` (so dispatched task does nothing heavy). `t0 = time.monotonic(); row = await manager.start_run(...); t1 = time.monotonic(); assert (t1-t0)*1000 < 200`.
- `test_start_run_inserts_pending_row(tables)` — after start_run, the DB row exists with `status=="pending"` (may transition to "running" asynchronously; test waits for NOT-pending with timeout).
- `test_per_set_mutex_rejects_second_run_409(tables)` — start run for (proj, set-a); before first completes, second start_run for (proj, set-a) raises `StateError` with http_status 409.
- `test_different_sets_run_in_parallel(tables)` — two concurrent start_runs for (proj, set-a) and (proj, set-b) both succeed.
- `test_semaphore_caps_concurrency_at_3(tables, monkeypatch)` — monkeypatch `settings.rapid_agent_max_concurrent = 2`; dispatch 4 runs whose mocked `session.run` sleeps 0.5s; assert concurrency observed never exceeds 2.
- `test_startup_orphan_sweep_marks_interrupted(tables)` — insert an `AgentRun` with `status="running"` and `pid=999999` directly via DB. Call `manager._startup_orphan_sweep()`. Row is now `status=="interrupted"`, `error_code=="orphaned"`.
- `test_periodic_sweep_respects_10s_young_run_guard(tables, monkeypatch)` — insert a `running` row with `started_at=now` and `pid=None`. Force one periodic pass (call the sweep helper directly). Row remains `running` (too young). Backdate `started_at` 30s, sweep again, row is `interrupted`.
- `test_interrupt_unknown_run_raises_state_error(tables)` — `await manager.interrupt(uuid4())` raises `StateError`.
- `test_send_input_unknown_run_raises_state_error(tables)`.
- `test_attach_events_streams_from_bus(tables)` — publish 3 events into bus for a run_id, attach with `since=0`, gather 3 events plus `run_complete` (emit manually to terminate iterator) and verify order.

**File to create:** `tests/agents/test_archive.py`

- `test_archive_skips_active_runs(tables, tmp_path, monkeypatch)` — one `running` row + 100 events; archive pass yields 0 archived rows and no JSONL file.
- `test_archive_writes_jsonl_and_deletes_rows(tables, tmp_path, monkeypatch)` — monkeypatch retention_days=0 and archive_dir=tmp_path. Insert a `completed` row with `ended_at=2h ago` and 50 events. Run archive. Expect a JSONL file at `tmp_path/<project_id>/<run_id>.jsonl` with 50 lines, and zero `agent_event` rows for that run_id remaining.
- `test_archive_atomic_tempfile_rename(tmp_path)` — monkeypatch the rename to raise between write and rename; assert no partial JSONL file is visible at the final name (tempfile present or absent, but not half-written target).

**Fixtures:** add to `tests/agents/conftest.py`:

```python
import pytest
import asyncio
from app.agents.session_manager import AgentSessionManager

@pytest.fixture
async def manager(tables):
    mgr = AgentSessionManager(tables)
    # Do NOT call mgr.start() in unit tests -- no periodic sweepers.
    yield mgr
    await mgr.stop()
```

### Task 7 — WAVE-3-COMPLETE.md

**File to create:** `.planning/sets/agent-runtime-foundation/WAVE-3-COMPLETE.md`

- Record: files created, test count, orphan sweep + mutex + semaphore invariants verified.

## What NOT to do

- Do NOT touch `app/main.py`, `app/routers/`, `app/services/`, or `app/agents/__init__.py`'s re-exports beyond what Task 5 specifies. Wave 4 owns `main.py` integration.
- Do NOT add the `claude-agent-sdk` dep to `pyproject.toml` here. Wave 4 owns that.
- Do NOT add a `settings` field or a migration in Wave 3. All knobs were added in Wave 1; all tables were created in Wave 1.
- Do NOT add psutil. Use `os.kill(pid, 0)` liveness only.
- Do NOT introduce retry logic on `ClaudeSDKError` in the session pump — per CONTEXT, the client re-POSTs. No auto-retry in Wave 1 scope.
- Do NOT call `asyncio.create_task` on the pump INSIDE `start_run` synchronously — that's the whole point of the <200ms contract. The task is created but not awaited in the handler path.
- Do NOT let the partial unique index IntegrityError bubble out of `start_run` unmapped — trap and convert to `StateError` so the API returns 409.
- Do NOT log `skill_args` verbatim if they contain credentials — but in this codebase skill_args are plain JSON from the API; no special scrubbing is required unless a downstream set adds secrets.

## Verification

Run from `web/backend/`:

```bash
# 0. Ensure SDK is installed in the test env (reverted before commit)
uv pip install 'claude-agent-sdk>=0.1.59,<0.2'

# 1. Wave 3 tests (and previous waves) pass
uv run pytest tests/agents/ -v

# 2. No main.py / router / service edits from Wave 3
git diff --name-only HEAD~1 HEAD | grep -E 'app/main\.py|app/routers/|app/services/' && echo 'FAIL -- wave 3 modified Wave 4 files' || echo 'file ownership OK'

# 3. pyproject/lockfile untouched by Wave 3
git diff --name-only HEAD~1 HEAD | grep -E 'pyproject\.toml|uv\.lock' && echo 'FAIL -- wave 3 modified Wave 4 files' || echo 'deps untouched OK'

# 4. Dispatch latency invariant (local smoke, manager-level)
uv run python -c "
import asyncio, time
from unittest.mock import patch, AsyncMock
from uuid import uuid4
from app.database import get_engine, run_migrations, Project
from sqlmodel import Session
from app.agents.session_manager import AgentSessionManager

async def main():
    engine = get_engine()
    run_migrations(engine)
    with Session(engine) as s:
        p = Project(name='smoke', path='/tmp'); s.add(p); s.commit(); s.refresh(p); pid = p.id
    mgr = AgentSessionManager(engine)
    with patch('app.agents.session.AgentSession.__aenter__', new=AsyncMock(return_value=None)), \
         patch('app.agents.session.AgentSession.__aexit__', new=AsyncMock(return_value=None)), \
         patch('app.agents.session.AgentSession.run', new=AsyncMock(return_value=None)):
        t0 = time.monotonic()
        row = await mgr.start_run(pid, 'plan-set', {}, 'prompt', set_id='s1')
        elapsed_ms = (time.monotonic() - t0) * 1000.0
        await asyncio.sleep(0.1)  # let task dispatch
        print(f'dispatch took {elapsed_ms:.1f}ms, row={row.id}')
        assert elapsed_ms < 200, f'dispatch exceeded 200ms: {elapsed_ms}'
    await mgr.stop()

asyncio.run(main())
"

# 5. Source-grep invariants
! grep -RIn "bypassPermissions" app/agents/
! grep -RIn "import psutil" app/agents/

# 6. No TODO markers (optional hygiene)
! grep -RIn "TODO\|FIXME\|XXX" app/agents/session.py app/agents/session_manager.py app/agents/archive.py
```

## Success Criteria

- [ ] `uv run pytest tests/agents/ -v` passes; Wave 3 adds at least 22 new tests.
- [ ] `AgentSessionManager.start_run(...)` returns (returns its `AgentRun` row) in <200ms with the session's real work happening on an `asyncio.Task`.
- [ ] Second `start_run` with the same `(project_id, set_id)` while first is `running`/`waiting` raises `StateError` (http_status 409).
- [ ] At most `settings.rapid_agent_max_concurrent` SDK sessions run concurrently per project (asyncio.Semaphore enforced).
- [ ] Startup orphan sweep marks every `running`/`waiting` row with a dead PID as `interrupted`, error_code=`orphaned`.
- [ ] Periodic 60s sweep skips rows `started_at > now - 10s` (race guard), otherwise marks dead-PID rows `interrupted`.
- [ ] `interrupt()` with a hanging SDK times out after 10s and synthesizes a `RunCompleteEvent(status="interrupted", error_code="interrupt_timeout")`.
- [ ] `AgentRun.total_wall_clock_s >= active_duration_s >= 0` invariant holds on every finished run.
- [ ] 30-day JSONL archive writes atomically (tempfile + rename) and deletes archived rows.
- [ ] `app/agents/__init__.py` re-exports the full public contract surface; `from app.agents import AgentSessionManager, EventBus, build_sdk_options` works.
- [ ] Wave 3 artifacts committed as `feat(agent-runtime-foundation): wave 3 session lifecycle — sessions, manager, orphan sweeper, archive`.
- [ ] Wave 3 commit touches NO files in `app/main.py`, `app/routers/`, `app/services/`, `pyproject.toml`, `uv.lock`.

## Files Owned Exclusively by Wave 3

- `app/agents/pid_liveness.py`
- `app/agents/session.py`
- `app/agents/session_manager.py`
- `app/agents/archive.py`
- `app/agents/__init__.py` (Wave 1 created empty shell; Wave 3 fills in exports)
- `tests/agents/conftest.py`
- `tests/agents/test_pid_liveness.py`
- `tests/agents/test_session.py`
- `tests/agents/test_session_manager.py`
- `tests/agents/test_archive.py`

No other wave may modify any of the above files (except Wave 1's empty stub of `__init__.py`, which Wave 3 takes over entirely).
