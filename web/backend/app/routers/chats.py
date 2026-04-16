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
from app.main import get_db
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
    # Determine since from query or Last-Event-ID header
    since_q = request.query_params.get("since")
    since = 0
    if since_q is not None and since_q.lstrip("-").isdigit():
        since = int(since_q)
    if since == 0:
        lei = request.headers.get("last-event-id")
        if lei is not None and lei.lstrip("-").isdigit():
            since = int(lei)

    # Check if the chat has an active agent run. For now, return empty stream
    # if no run is bound. Full session-binding wiring will evolve in later waves.
    chat = await chat_service.get_thread(session, chat_id)
    if chat is None or chat.session_status == "archived":
        async def _empty():
            return
            yield  # noqa: RET504 -- makes this an async generator

        return EventSourceResponse(
            _empty(),
            ping=15,
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # TODO: resolve chat -> active_run_id binding when session management lands.
    # For now, return an empty stream placeholder.
    async def _gen():
        return
        yield  # noqa: RET504 -- makes this an async generator

    return EventSourceResponse(
        _gen(),
        ping=15,
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
