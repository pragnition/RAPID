"""Thin facade over :class:`AgentSessionManager`.

Keeps routers declarative and the service layer consistent with
``kanban_service``, ``project_service``, etc. Never instantiates the
manager -- it is lifespan-owned and injected via ``app.state.agent_manager``.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import AsyncIterator
from uuid import UUID

from fastapi import Request

from app.agents import AgentSessionManager, StateError
from app.models.agent_prompt import AgentPrompt
from app.models.agent_run import AgentRun
from app.schemas.sse_events import SseEvent

logger = logging.getLogger("rapid.agents.service")


def get_manager(request: Request) -> AgentSessionManager:
    mgr = getattr(request.app.state, "agent_manager", None)
    if mgr is None:
        raise StateError("AgentSessionManager not initialized", detail={})
    return mgr


async def start_run(
    mgr: AgentSessionManager,
    project_id: UUID,
    skill_name: str,
    skill_args: dict,
    prompt: str,
    set_id: str | None,
    worktree: str | None,
) -> AgentRun:
    logger.info("start_run request", extra={"project_id": str(project_id), "skill_name": skill_name, "set_id": set_id})
    wt_path: Path | None = None
    if worktree is not None:
        candidate = Path(worktree)
        if not candidate.is_absolute():
            raise StateError(
                "worktree must be absolute",
                detail={"worktree": worktree},
            )
        wt_path = candidate.resolve()
    row = await mgr.start_run(
        project_id=project_id,
        skill_name=skill_name,
        skill_args=skill_args,
        prompt=prompt,
        set_id=set_id,
        worktree=wt_path,
    )
    logger.info("start_run accepted", extra={"run_id": str(row.id), "skill_name": skill_name})
    return row


async def get_run(mgr: AgentSessionManager, run_id: UUID) -> AgentRun:
    return await mgr.get_run(run_id)


async def list_runs(
    mgr: AgentSessionManager, project_id: UUID
) -> tuple[list[AgentRun], int]:
    return await mgr.list_runs(project_id)


async def send_input(mgr: AgentSessionManager, run_id: UUID, text: str) -> None:
    logger.info("send_input request", extra={"run_id": str(run_id), "text_length": len(text)})
    await mgr.send_input(run_id, text)


async def interrupt(mgr: AgentSessionManager, run_id: UUID) -> None:
    logger.info("interrupt request", extra={"run_id": str(run_id)})
    await mgr.interrupt(run_id)


async def stream_events(
    mgr: AgentSessionManager, run_id: UUID, since: int
) -> AsyncIterator[SseEvent]:
    async for evt in mgr.attach_events(run_id, since=since):
        yield evt


# ---------- web-tool-bridge prompt facade ----------


async def resolve_prompt(
    mgr: AgentSessionManager, run_id: UUID, prompt_id: str, answer: str
) -> None:
    logger.info("resolve_prompt request", extra={"run_id": str(run_id), "prompt_id": prompt_id})
    await mgr.resolve_prompt(run_id, prompt_id, answer)


async def get_pending_prompt(
    mgr: AgentSessionManager, run_id: UUID
) -> AgentPrompt | None:
    return await mgr.get_pending_prompt(run_id)


async def reopen_prompt(
    mgr: AgentSessionManager, run_id: UUID, prompt_id: str
) -> None:
    await mgr.reopen_prompt(run_id, prompt_id)
