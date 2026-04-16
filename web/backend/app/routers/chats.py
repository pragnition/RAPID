"""FastAPI router for chat threads and messages (``/api/chats``).

Endpoints:
* ``GET  /``                    -- list threads for a project
* ``POST /``                    -- create a new chat thread
* ``GET  /{chat_id}``           -- get a single thread
* ``POST /{chat_id}/messages``  -- send a user message
* ``GET  /{chat_id}/messages``  -- list messages (with ``?since_seq=N``)
* ``POST /{chat_id}/archive``   -- archive a thread
* ``GET  /{chat_id}/events``    -- SSE stream for live events
"""

from __future__ import annotations

import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session
from sse_starlette.sse import EventSourceResponse

from app.agents import StateError, to_http_exception
from app.schemas.chats import (
    ChatCreateRequest,
    ChatListResponse,
    ChatMessageCreateRequest,
    ChatMessageResponse,
    ChatResponse,
)
from app.services import chat_service

logger = logging.getLogger("rapid.routers.chats")

router = APIRouter(prefix="/api/chats", tags=["chats"])


def get_db(request: Request):
    """Yield a request-scoped SQLModel session from app.state.engine."""
    engine = request.app.state.engine
    with Session(engine) as session:
        yield session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _message_to_response(row) -> ChatMessageResponse:
    """Convert a ChatMessage ORM row to a ChatMessageResponse, decoding tool_calls."""
    return ChatMessageResponse(
        id=row.id,
        chat_id=row.chat_id,
        seq=row.seq,
        role=row.role,
        content=row.content,
        tool_calls=json.loads(row.tool_calls or "[]"),
        tool_use_id=row.tool_use_id,
        agent_run_id=row.agent_run_id,
        temp_id=row.temp_id,
        created_at=row.created_at,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=ChatListResponse)
async def list_chats(
    project_id: UUID,
    include_archived: bool = False,
    session: Session = Depends(get_db),
):
    """List chat threads for a project."""
    try:
        items, total = await chat_service.list_threads(
            session, project_id, include_archived=include_archived
        )
    except StateError as exc:
        raise to_http_exception(exc)
    return ChatListResponse(
        items=[ChatResponse.model_validate(c) for c in items],
        total=total,
    )


@router.post("", response_model=ChatResponse, status_code=201)
async def create_chat(
    body: ChatCreateRequest,
    session: Session = Depends(get_db),
):
    """Create a new chat thread."""
    try:
        chat = await chat_service.create_thread(
            session,
            project_id=body.project_id,
            skill_name=body.skill_name,
            title=body.title,
        )
    except StateError as exc:
        raise to_http_exception(exc)
    return ChatResponse.model_validate(chat)


@router.get("/{chat_id}", response_model=ChatResponse)
async def get_chat(
    chat_id: UUID,
    session: Session = Depends(get_db),
):
    """Get a single chat thread."""
    chat = await chat_service.get_thread(session, chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return ChatResponse.model_validate(chat)


@router.post(
    "/{chat_id}/messages", response_model=ChatMessageResponse, status_code=201
)
async def post_message(
    chat_id: UUID,
    body: ChatMessageCreateRequest,
    request: Request,
    session: Session = Depends(get_db),
):
    """Send a user message to a chat thread."""
    mgr = chat_service.get_manager(request)
    try:
        msg = await chat_service.send_message(
            session, mgr, chat_id, body.content, temp_id=body.temp_id
        )
    except StateError as exc:
        raise to_http_exception(exc)
    return _message_to_response(msg)


@router.get("/{chat_id}/messages", response_model=list[ChatMessageResponse])
async def list_messages(
    chat_id: UUID,
    since_seq: int = 0,
    session: Session = Depends(get_db),
):
    """List messages for a chat thread, optionally filtered by since_seq."""
    messages = await chat_service.list_messages(session, chat_id, since_seq=since_seq)
    return [_message_to_response(m) for m in messages]


@router.post("/{chat_id}/archive", response_model=ChatResponse)
async def archive_chat(
    chat_id: UUID,
    session: Session = Depends(get_db),
):
    """Archive a chat thread."""
    try:
        chat = await chat_service.archive_thread(session, chat_id)
    except StateError as exc:
        raise to_http_exception(exc)
    return ChatResponse.model_validate(chat)


@router.get("/{chat_id}/events")
async def stream_events(
    chat_id: UUID,
    request: Request,
    session: Session = Depends(get_db),
):
    """SSE stream for live chat events.

    Delegates to the agent event bus if the chat has an active agent run.
    If no active run, returns an empty stream.
    """
    from app.schemas.sse_events import serialize_event

    # Determine since from query or Last-Event-ID header
    since_q = request.query_params.get("since")
    since = 0
    if since_q is not None and since_q.lstrip("-").isdigit():
        since = int(since_q)
    if since == 0:
        lei = request.headers.get("last-event-id")
        if lei is not None and lei.lstrip("-").isdigit():
            since = int(lei)

    chat = await chat_service.get_thread(session, chat_id)
    if chat is None or chat.session_status == "archived":
        async def _empty():
            return
            yield  # noqa: RET504

        return EventSourceResponse(
            _empty(),
            ping=15,
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    run_id = chat.active_run_id
    if run_id is None:
        async def _empty():
            return
            yield  # noqa: RET504

        return EventSourceResponse(
            _empty(),
            ping=15,
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    mgr = chat_service.get_manager(request)

    async def _gen():
        accumulated_text = ""
        tool_calls: list[dict] = []
        try:
            async for evt in mgr.attach_events(run_id, since=since):
                if await request.is_disconnected():
                    logger.info(
                        "chat SSE client disconnected",
                        extra={"chat_id": str(chat_id), "run_id": str(run_id)},
                    )
                    break

                # Accumulate for materialization
                if evt.kind == "assistant_text":
                    accumulated_text += evt.text
                elif evt.kind == "tool_use":
                    tool_calls.append({
                        "tool_use_id": evt.tool_use_id,
                        "tool_name": evt.tool_name,
                        "input": evt.input,
                    })
                elif evt.kind == "tool_result":
                    for tc in tool_calls:
                        if tc["tool_use_id"] == evt.tool_use_id:
                            tc["output"] = evt.output
                            tc["is_error"] = evt.is_error
                            break

                yield {
                    "id": str(evt.seq),
                    "event": evt.kind,
                    "data": json.dumps(serialize_event(evt)),
                }

                if evt.kind == "run_complete":
                    # Materialize the assistant turn
                    if accumulated_text or tool_calls:
                        try:
                            engine = request.app.state.engine
                            with Session(engine) as fresh_session:
                                await chat_service.materialize_assistant_turn(
                                    fresh_session,
                                    chat_id,
                                    run_id,
                                    accumulated_text,
                                    tool_calls if tool_calls else None,
                                )
                                # Clear active_run_id
                                from app.models.chat import Chat as ChatModel
                                db_chat = fresh_session.get(ChatModel, chat_id)
                                if db_chat is not None:
                                    db_chat.active_run_id = None
                                    fresh_session.add(db_chat)
                                    fresh_session.commit()
                        except Exception:
                            logger.exception(
                                "failed to materialize assistant turn",
                                extra={
                                    "chat_id": str(chat_id),
                                    "run_id": str(run_id),
                                },
                            )
                    return
        except StateError as exc:
            yield {
                "event": "error",
                "data": json.dumps(
                    {
                        "error": exc.message,
                        "detail": exc.detail,
                    }
                ),
            }
        except Exception:
            logger.exception(
                "chat SSE stream crashed",
                extra={"chat_id": str(chat_id), "run_id": str(run_id)},
            )
            raise

    return EventSourceResponse(
        _gen(),
        ping=15,
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
