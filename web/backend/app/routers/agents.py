"""FastAPI router exposing the agent runtime over HTTP/SSE.

Endpoints (prefix ``/api/agents``):

* ``POST /runs`` -- dispatch a new agent run (returns 201, <200ms target).
* ``GET /runs/{run_id}`` -- fetch a run by id.
* ``GET /runs/{run_id}/events`` -- Server-Sent Events stream with ``?since=N``
  query or ``Last-Event-ID`` header replay.
* ``POST /runs/{run_id}/input`` -- send stdin text to a waiting run (204).
* ``POST /runs/{run_id}/interrupt`` -- SIGTERM the run's PID (200).
* ``POST /runs/{run_id}/answer`` -- stub (501); implemented by Set 2
  (``web-tool-bridge``). URL is frozen here so the contract is stable.
"""

from __future__ import annotations

import json
import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response
from sse_starlette.sse import EventSourceResponse

from app.agents import StateError, to_http_exception
from app.schemas.agents import (
    AgentRunListResponse,
    AgentRunResponse,
    AnswerRequest,
    InterruptResponse,
    PendingPromptResponse,
    SendInputRequest,
    StartRunRequest,
)
from app.schemas.sse_events import serialize_event
from app.services import agent_service

logger = logging.getLogger("rapid.routers.agents")

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.post("/runs", response_model=AgentRunResponse, status_code=201)
async def start_run_endpoint(body: StartRunRequest, request: Request):
    mgr = agent_service.get_manager(request)
    try:
        row = await agent_service.start_run(
            mgr,
            project_id=body.project_id,
            skill_name=body.skill_name,
            skill_args=body.skill_args,
            prompt=body.prompt,
            set_id=body.set_id,
            worktree=body.worktree,
        )
    except StateError as exc:
        raise to_http_exception(exc)
    return AgentRunResponse.model_validate(row)


@router.get("/runs", response_model=AgentRunListResponse)
async def list_runs_endpoint(project_id: UUID, request: Request):
    mgr = agent_service.get_manager(request)
    items, total = await agent_service.list_runs(mgr, project_id)
    return AgentRunListResponse(
        items=[AgentRunResponse.model_validate(r) for r in items],
        total=total,
    )


@router.get("/runs/{run_id}", response_model=AgentRunResponse)
async def get_run_endpoint(run_id: UUID, request: Request):
    mgr = agent_service.get_manager(request)
    try:
        row = await agent_service.get_run(mgr, run_id)
    except StateError as exc:
        raise to_http_exception(exc)
    return AgentRunResponse.model_validate(row)


@router.get("/runs/{run_id}/events")
async def stream_events_endpoint(run_id: UUID, request: Request):
    mgr = agent_service.get_manager(request)

    # Query param wins over Last-Event-ID header.
    since_q = request.query_params.get("since")
    since = 0
    if since_q is not None and since_q.lstrip("-").isdigit():
        since = int(since_q)
    if since == 0:
        lei = request.headers.get("last-event-id")
        if lei is not None and lei.lstrip("-").isdigit():
            since = int(lei)

    async def _gen():
        try:
            async for evt in agent_service.stream_events(mgr, run_id, since=since):
                if await request.is_disconnected():
                    logger.info(
                        "client disconnected",
                        extra={"run_id": str(run_id)},
                    )
                    break
                yield {
                    "id": str(evt.seq),
                    "event": evt.kind,
                    "data": json.dumps(serialize_event(evt)),
                }
        except StateError as exc:
            # Emit a single error event then close. Downstream clients already
            # handle error_code in their event data for status events.
            logger.info(
                "SSE stream rejected",
                extra={"run_id": str(run_id), "error_code": exc.error_code},
            )
            yield {
                "event": "error",
                "data": json.dumps(
                    {
                        "error_code": exc.error_code,
                        "message": exc.message,
                        "detail": exc.detail,
                    }
                ),
            }
        except Exception:
            logger.exception(
                "SSE stream crashed", extra={"run_id": str(run_id)}
            )
            raise

    return EventSourceResponse(
        _gen(),
        ping=15,
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/runs/{run_id}/input", status_code=204)
async def send_input_endpoint(
    run_id: UUID, body: SendInputRequest, request: Request
):
    mgr = agent_service.get_manager(request)
    try:
        await agent_service.send_input(mgr, run_id, body.text)
    except StateError as exc:
        raise to_http_exception(exc)
    return Response(status_code=204)


@router.post("/runs/{run_id}/interrupt", response_model=InterruptResponse)
async def interrupt_endpoint(run_id: UUID, request: Request):
    mgr = agent_service.get_manager(request)
    try:
        await agent_service.interrupt(mgr, run_id)
    except StateError as exc:
        raise to_http_exception(exc)
    return InterruptResponse(ok=True)


@router.post("/runs/{run_id}/answer", status_code=204)
async def answer_endpoint(run_id: UUID, body: AnswerRequest, request: Request):
    """Submit the user's answer to a pending ``ask_user`` prompt.

    ``prompt_id`` is the real acknowledgement handle (server-minted).
    Returns 204 on success, 404 if the prompt is unknown, 409 if it's no
    longer pending.
    """
    mgr = agent_service.get_manager(request)
    if not body.prompt_id:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "missing_prompt_id",
                "message": "prompt_id is required",
                "detail": {"run_id": str(run_id)},
            },
        )
    try:
        await agent_service.resolve_prompt(
            mgr, run_id, body.prompt_id, body.answer
        )
    except StateError as exc:
        raise to_http_exception(exc)
    return Response(status_code=204)


@router.get("/runs/{run_id}/pending-prompt")
async def get_pending_prompt_endpoint(run_id: UUID, request: Request):
    """Return the current pending prompt for ``run_id``, or 204 if none.

    Used by the frontend on SSE reconnect and on 409 auto-swap to rehydrate
    the modal from SQLite truth.
    """
    mgr = agent_service.get_manager(request)
    try:
        row = await agent_service.get_pending_prompt(mgr, run_id)
    except StateError as exc:
        raise to_http_exception(exc)
    if row is None:
        return Response(status_code=204)

    # Decode the stored payload JSON into typed fields.
    try:
        payload = json.loads(row.payload or "{}")
    except Exception:
        payload = {}

    n_of_m = payload.get("n_of_m")
    batch_total: int | None = None
    if isinstance(n_of_m, (list, tuple)) and len(n_of_m) == 2:
        try:
            batch_total = int(n_of_m[1])
        except Exception:
            batch_total = None

    return PendingPromptResponse(
        prompt_id=row.id,
        run_id=row.run_id,
        kind="ask_user",
        question=str(payload.get("question", "")),
        options=payload.get("options"),
        allow_free_text=bool(payload.get("allow_free_text", True)),
        created_at=row.created_at,
        batch_id=row.batch_id,
        batch_position=row.batch_position,
        batch_total=batch_total,
    )


@router.post(
    "/runs/{run_id}/prompts/{prompt_id}/reopen", status_code=204
)
async def reopen_prompt_endpoint(
    run_id: UUID, prompt_id: str, request: Request
):
    """Reopen a previously-answered prompt for back-navigation.

    Returns 204 on success, 404 if the prompt is unknown, 400 if nothing to
    reopen (already pending), 409 if the agent has already consumed the
    answer (``consumed_at`` is not null).
    """
    mgr = agent_service.get_manager(request)
    try:
        await agent_service.reopen_prompt(mgr, run_id, prompt_id)
    except StateError as exc:
        raise to_http_exception(exc)
    return Response(status_code=204)
