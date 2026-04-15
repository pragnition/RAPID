"""``AgentSession`` — one-shot async-context wrapper around ``ClaudeSDKClient``.

Each :class:`AgentSession` owns exactly one SDK run: connect → pump messages →
emit SSE events → update the backing ``AgentRun`` row → disconnect. The
enclosing :class:`~app.agents.session_manager.AgentSessionManager` creates one
per incoming request and keeps the live instance in its registry so that
``send_input`` / ``interrupt`` facade calls can reach the right session.

Invariant: ``total_wall_clock_s >= active_duration_s >= 0``. Active duration
is wall-clock minus time spent in the ``waiting`` state (``ask_user`` /
``permission_req`` pauses). The simplest correct implementation accumulates a
``_waiting_total_s`` counter and computes ``active = wall - waiting_total``
when the run finishes.
"""

from __future__ import annotations

import asyncio
import functools
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any
from uuid import UUID

if TYPE_CHECKING:  # pragma: no cover — avoid runtime circular import
    from app.agents.session_manager import AgentSessionManager

import sqlalchemy
from sqlmodel import Session

try:
    from claude_agent_sdk import (
        AssistantMessage,
        ClaudeSDKClient,
        ClaudeSDKError,
        ResultMessage,
        SystemMessage,
        TextBlock,
        ThinkingBlock,
        ToolUseBlock,
        UserMessage,
    )
except ImportError:  # pragma: no cover — exercised in non-SDK envs via mocks
    ClaudeSDKClient = None  # type: ignore[assignment]
    AssistantMessage = UserMessage = SystemMessage = ResultMessage = object  # type: ignore[assignment]
    TextBlock = ToolUseBlock = ThinkingBlock = object  # type: ignore[assignment]

    class ClaudeSDKError(Exception):  # type: ignore[no-redef]
        """Fallback when the SDK is not installed."""


from app.agents.budget import RunBudget
from app.agents.correlation import bind_run_id
from app.agents.errors import RunError, SdkError
from app.agents.event_bus import EventBus
from app.agents.sdk_options import build_sdk_options
from app.models.agent_run import AgentRun
from app.schemas.sse_events import (
    AssistantTextEvent,
    RunCompleteEvent,
    StatusEvent,
    ThinkingEvent,
    ToolResultEvent,
    ToolUseEvent,
)

logger = logging.getLogger("rapid.agents.session")


class AgentSession:
    """One-shot async-context-managed wrapper around ``ClaudeSDKClient``."""

    def __init__(
        self,
        run_id: UUID,
        project_root: Path,
        worktree: Path | None,
        skill_name: str,
        skill_args: dict[str, Any],
        prompt: str,
        event_bus: EventBus,
        engine: sqlalchemy.Engine,
        budget: RunBudget,
        manager: "AgentSessionManager | None" = None,
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
        # web-tool-bridge: needed for build_tools() and can_use_tool rebind.
        # Optional for backwards-compat with existing tests that construct
        # AgentSession directly without a manager.
        self.manager = manager

        self._client: Any = None  # ClaudeSDKClient | None
        self._options: Any = None
        self._interrupted = asyncio.Event()
        self._run_complete_emitted = False

        # Dual-time tracking.
        self._started_ts_mono: float = 0.0
        self._waiting_total_s: float = 0.0
        self._waiting_started_mono: float | None = None

        self.pid: int | None = None

    # ---------- lifecycle ----------

    async def __aenter__(self) -> "AgentSession":
        self._options = build_sdk_options(
            project_root=self.project_root,
            worktree=self.worktree,
            skill_name=self.skill_name,
            skill_args=self.skill_args,
            run_id=str(self.run_id),
        )
        if ClaudeSDKClient is None:  # pragma: no cover — guarded for tests
            raise RunError("claude_agent_sdk is not importable in this environment")
        self._client = ClaudeSDKClient(options=self._options)
        await self._client.connect()
        # After connect, the SDK subprocess is running. Record PID for orphan sweep.
        self.pid = getattr(getattr(self._client, "_process", None), "pid", None)
        started = datetime.now(timezone.utc)
        await self._update_db(status="running", pid=self.pid, started_at=started)
        self._started_ts_mono = time.monotonic()
        await self._emit(
            StatusEvent(
                seq=await self._next_seq(),
                ts=started,
                run_id=self.run_id,
                status="running",
            )
        )
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        try:
            if self._client is not None:
                try:
                    await asyncio.wait_for(self._client.disconnect(), timeout=5.0)
                except asyncio.TimeoutError:
                    logger.warning(
                        "disconnect timeout", extra={"run_id": str(self.run_id)}
                    )
                except Exception:
                    logger.exception(
                        "disconnect failed", extra={"run_id": str(self.run_id)}
                    )
        finally:
            await self.event_bus.close_channel(self.run_id)

    # ---------- pump ----------

    async def run(self) -> None:
        """Drive the SDK event pump to completion. Call after ``__aenter__``."""
        try:
            with bind_run_id(str(self.run_id)):
                await self._client.query(self.prompt)
                async for msg in self._client.receive_response():
                    if self._interrupted.is_set():
                        break
                    await self._handle_message(msg)
                    if isinstance(msg, ResultMessage):
                        # ResultMessage handler emits run_complete; pump stops.
                        break
                    status = await self.budget.check()
                    if status.halted:
                        logger.info(
                            "budget halted", extra={"reason": status.halt_reason}
                        )
                        try:
                            await self._client.interrupt()
                        except Exception:
                            logger.exception("interrupt during budget halt failed")
                        await self._emit_run_complete(
                            status_text="failed",
                            error_code="budget_exceeded",
                            error_detail={"halt_reason": status.halt_reason},
                        )
                        return
            if self._interrupted.is_set() and not self._run_complete_emitted:
                await self._emit_run_complete(status_text="interrupted")
        except ClaudeSDKError as e:
            await self._emit_run_complete(
                status_text="failed",
                error_code="sdk_error",
                error_detail={"type": type(e).__name__, "msg": str(e)},
            )
            raise SdkError(str(e)) from e
        except (SdkError, RunError):
            raise
        except Exception as e:
            await self._emit_run_complete(
                status_text="failed",
                error_code="run_error",
                error_detail={"type": type(e).__name__, "msg": str(e)},
            )
            raise RunError(str(e)) from e

    # ---------- message handlers ----------

    async def _handle_message(self, msg: Any) -> None:
        ts = datetime.now(timezone.utc)
        if isinstance(msg, AssistantMessage):
            for block in getattr(msg, "content", []) or []:
                if isinstance(block, TextBlock):
                    await self._emit(
                        AssistantTextEvent(
                            seq=await self._next_seq(),
                            ts=ts,
                            run_id=self.run_id,
                            text=block.text,
                        )
                    )
                elif isinstance(block, ThinkingBlock):
                    await self._emit(
                        ThinkingEvent(
                            seq=await self._next_seq(),
                            ts=ts,
                            run_id=self.run_id,
                            text=block.thinking
                            if hasattr(block, "thinking")
                            else getattr(block, "text", ""),
                        )
                    )
                elif isinstance(block, ToolUseBlock):
                    raw_input = getattr(block, "input", {}) or {}
                    try:
                        input_dict = dict(raw_input)
                    except Exception:
                        input_dict = {"_raw": str(raw_input)}
                    await self._emit(
                        ToolUseEvent(
                            seq=await self._next_seq(),
                            ts=ts,
                            run_id=self.run_id,
                            tool_name=block.name,
                            tool_use_id=block.id,
                            input=input_dict,
                        )
                    )
        elif isinstance(msg, UserMessage):
            # tool_result messages come back as UserMessage with tool_result blocks.
            for block in getattr(msg, "content", []) or []:
                if getattr(block, "type", None) == "tool_result":
                    await self._emit(
                        ToolResultEvent(
                            seq=await self._next_seq(),
                            ts=ts,
                            run_id=self.run_id,
                            tool_use_id=getattr(block, "tool_use_id", ""),
                            output=getattr(block, "content", None),
                            is_error=bool(getattr(block, "is_error", False)),
                        )
                    )
        elif isinstance(msg, SystemMessage):
            logger.debug(
                "system message", extra={"subtype": getattr(msg, "subtype", None)}
            )
        elif isinstance(msg, ResultMessage):
            cost = float(getattr(msg, "total_cost_usd", 0.0) or 0.0)
            try:
                await self.budget.record_turn(cost)
            except Exception:
                logger.exception("budget.record_turn raised")
            turn_count = int(getattr(msg, "num_turns", 0) or 0)
            duration_ms = getattr(msg, "duration_ms", None)
            duration_s = float(duration_ms or 0) / 1000.0 if duration_ms else (
                time.monotonic() - self._started_ts_mono
            )
            status_text = "failed" if getattr(msg, "is_error", False) else "completed"
            wall = time.monotonic() - self._started_ts_mono
            # If waiting is still open, close it so the invariant holds.
            self._ensure_waiting_closed()
            active = max(0.0, wall - self._waiting_total_s)
            ended = datetime.now(timezone.utc)
            await self._update_db(
                status=status_text,
                total_cost_usd=cost,
                turn_count=turn_count,
                ended_at=ended,
                total_wall_clock_s=wall,
                active_duration_s=active,
            )
            await self._emit(
                RunCompleteEvent(
                    seq=await self._next_seq(),
                    ts=ts,
                    run_id=self.run_id,
                    status=status_text,
                    total_cost_usd=cost,
                    turn_count=turn_count,
                    duration_s=duration_s,
                    error_code=None,
                    error_detail=None,
                )
            )
            self._run_complete_emitted = True

    # ---------- facade ----------

    async def interrupt(self) -> None:
        """Signal interrupt. Always synthesizes a terminal ``run_complete``."""
        if self._run_complete_emitted:
            return
        self._interrupted.set()
        if self._client is not None:
            try:
                await asyncio.wait_for(self._client.interrupt(), timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning(
                    "interrupt timeout — synthesizing run_complete",
                    extra={"run_id": str(self.run_id)},
                )
                await self._emit_run_complete(
                    status_text="interrupted",
                    error_code="interrupt_timeout",
                )
                return
            except Exception:
                logger.exception("interrupt raised", extra={"run_id": str(self.run_id)})
        if not self._run_complete_emitted:
            await self._emit_run_complete(status_text="interrupted")

    async def send_input(self, text: str) -> None:
        if self._client is None:
            raise RunError("session not connected")
        await self._client.query(text)

    # ---------- waiting-state hooks ----------

    def _enter_waiting(self) -> None:
        if self._waiting_started_mono is not None:
            return
        self._waiting_started_mono = time.monotonic()

    def _leave_waiting(self) -> None:
        if self._waiting_started_mono is None:
            return
        waited = time.monotonic() - self._waiting_started_mono
        if waited > 0:
            self._waiting_total_s += waited
        self._waiting_started_mono = None

    def _ensure_waiting_closed(self) -> None:
        """Close any open waiting interval before a terminal emission."""
        if self._waiting_started_mono is not None:
            self._leave_waiting()

    # ---------- helpers ----------

    async def _next_seq(self) -> int:
        ch = await self.event_bus.get_or_create_channel(self.run_id)
        return ch.next_seq()

    async def _emit(self, event: Any) -> None:
        await self.event_bus.publish(self.run_id, event)

    async def _update_db(self, **fields: Any) -> None:
        def _upd() -> None:
            with Session(self.engine) as s:
                row = s.get(AgentRun, self.run_id)
                if row is None:
                    return
                for k, v in fields.items():
                    setattr(row, k, v)
                s.add(row)
                s.commit()

        await asyncio.to_thread(_upd)

    async def _emit_run_complete(
        self,
        status_text: str,
        error_code: str | None = None,
        error_detail: dict | None = None,
    ) -> None:
        if self._run_complete_emitted:
            return
        ended = datetime.now(timezone.utc)
        self._ensure_waiting_closed()
        wall = time.monotonic() - self._started_ts_mono if self._started_ts_mono else 0.0
        active = max(0.0, wall - self._waiting_total_s)
        status = await self.budget.check()
        await self._update_db(
            status=status_text,
            ended_at=ended,
            total_wall_clock_s=wall,
            active_duration_s=active,
            total_cost_usd=status.cost_used_usd,
            turn_count=status.turns_used,
            error_code=error_code,
            error_detail=json.dumps(error_detail or {}),
        )
        await self._emit(
            RunCompleteEvent(
                seq=await self._next_seq(),
                ts=ended,
                run_id=self.run_id,
                status=status_text,
                total_cost_usd=status.cost_used_usd,
                turn_count=status.turns_used,
                duration_s=wall,
                error_code=error_code,
                error_detail=error_detail,
            )
        )
        self._run_complete_emitted = True
