"""Chat service — thin facade for chat thread CRUD and message persistence.

Follows the same pattern as ``agent_service.py`` and ``note_service.py``:
routers stay declarative, business logic lives here.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import Request
from sqlmodel import Session, func, select

from app.agents import AgentSessionManager, StateError
from app.database import Project
from app.models.chat import Chat, ChatMessage
from app.models.agent_run import AgentRun

logger = logging.getLogger("rapid.services.chat")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _build_conversation_prompt(
    history: list[ChatMessage],
    current_message: str,
) -> str:
    """Build a prompt that includes prior conversation context.

    Only user and assistant messages are included (tool messages are internal).
    """
    if not history:
        return current_message

    lines: list[str] = []
    lines.append("<conversation_history>")
    for msg in history:
        if msg.role == "user":
            lines.append(f"[user]: {msg.content}")
        elif msg.role == "assistant" and msg.content:
            lines.append(f"[assistant]: {msg.content}")
    lines.append("</conversation_history>")
    lines.append("")
    lines.append(current_message)
    return "\n".join(lines)


def get_manager(request: Request) -> AgentSessionManager:
    """Retrieve the lifespan-owned AgentSessionManager from app state."""
    mgr = getattr(request.app.state, "agent_manager", None)
    if mgr is None:
        raise StateError("AgentSessionManager not initialized", detail={})
    return mgr


# ---------------------------------------------------------------------------
# Thread CRUD
# ---------------------------------------------------------------------------


async def create_thread(
    session: Session,
    project_id: UUID,
    skill_name: str,
    title: str | None = None,
) -> Chat:
    """Create a new chat thread. Returns the row.

    Does NOT start a session yet -- session is lazily created on first
    send_message call.
    """
    # Verify project exists
    project = session.get(Project, project_id)
    if project is None:
        raise StateError(
            "Project not found",
            detail={"project_id": str(project_id)},
            error_code="project_not_found",
        )

    chat = Chat(
        project_id=project_id,
        skill_name=skill_name,
        title=title or "",
    )
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return chat


async def list_threads(
    session: Session,
    project_id: UUID,
    include_archived: bool = False,
) -> tuple[list[Chat], int]:
    """List threads for a project, newest last_message_at first.

    Filters out archived threads unless ``include_archived=True``.
    """
    base = select(Chat).where(Chat.project_id == project_id)
    count_base = select(func.count(Chat.id)).where(Chat.project_id == project_id)

    if not include_archived:
        base = base.where(Chat.archived_at.is_(None))  # type: ignore[union-attr]
        count_base = count_base.where(Chat.archived_at.is_(None))  # type: ignore[union-attr]

    total = session.exec(count_base).one()
    stmt = base.order_by(Chat.last_message_at.desc())  # type: ignore[union-attr]
    items = list(session.exec(stmt).all())
    return items, total


async def get_thread(session: Session, chat_id: UUID) -> Chat | None:
    """Get a single chat thread by ID."""
    return session.get(Chat, chat_id)


async def find_or_create_for_run(
    session: Session,
    run_id: UUID,
) -> Chat:
    """Find an existing chat thread linked to ``run_id``, or create one.

    Lookup order:
    1. ``Chat.active_run_id == run_id``
    2. ``ChatMessage.agent_run_id == run_id`` → parent chat
    3. Create a new ``Chat`` using the run's ``project_id`` / ``skill_name``

    Idempotent: calling twice for the same run returns the same chat.
    """
    # 1. Check Chat.active_run_id
    existing = session.exec(
        select(Chat).where(Chat.active_run_id == run_id).limit(1)
    ).first()
    if existing is not None:
        return existing

    # 2. Check ChatMessage.agent_run_id -> chat_id
    msg = session.exec(
        select(ChatMessage)
        .where(ChatMessage.agent_run_id == run_id)
        .limit(1)
    ).first()
    if msg is not None:
        chat = session.get(Chat, msg.chat_id)
        if chat is not None:
            return chat

    # 3. Load the run to get project_id and skill_name, then create
    run = session.get(AgentRun, run_id)
    if run is None:
        raise StateError(
            "Run not found",
            detail={"run_id": str(run_id)},
            error_code="run_not_found",
            http_status=404,
        )

    chat = Chat(
        project_id=run.project_id,
        skill_name=run.skill_name,
        title=f"Chat — {run.skill_name}",
    )
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return chat


async def archive_thread(session: Session, chat_id: UUID) -> Chat:
    """Archive a chat thread."""
    chat = session.get(Chat, chat_id)
    if chat is None:
        raise StateError(
            "Chat not found",
            detail={"chat_id": str(chat_id)},
            error_code="chat_not_found",
            http_status=404,
        )
    now = _utcnow()
    chat.session_status = "archived"
    chat.archived_at = now
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return chat


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------


def _next_seq(session: Session, chat_id: UUID) -> int:
    """Compute the next monotonic seq for a chat thread (inside same txn)."""
    result = session.exec(
        select(func.coalesce(func.max(ChatMessage.seq), 0)).where(
            ChatMessage.chat_id == chat_id
        )
    ).one()
    return int(result) + 1


async def send_message(
    session: Session,
    mgr: AgentSessionManager,
    chat_id: UUID,
    content: str,
    temp_id: str | None = None,
) -> ChatMessage:
    """Persist a user message (role='user').

    Returns the persisted user ChatMessage immediately. The assistant
    response arrives later via SSE / stream_response.
    """
    chat = session.get(Chat, chat_id)
    if chat is None:
        raise StateError(
            "Chat not found",
            detail={"chat_id": str(chat_id)},
            error_code="chat_not_found",
            http_status=404,
        )
    if chat.session_status == "archived":
        raise StateError(
            "Cannot send message to archived thread",
            detail={"chat_id": str(chat_id)},
            error_code="thread_archived",
        )

    seq = _next_seq(session, chat_id)
    msg = ChatMessage(
        chat_id=chat_id,
        seq=seq,
        role="user",
        content=content,
        temp_id=temp_id,
    )
    session.add(msg)

    # Update chat metadata
    now = _utcnow()
    chat.last_message_at = now
    # Auto-fill title from first user message if empty
    if not chat.title and seq == 1:
        chat.title = content[:255]
    session.add(chat)

    session.commit()
    session.refresh(msg)

    # Load prior messages for conversation context
    prior_messages = list(session.exec(
        select(ChatMessage)
        .where(ChatMessage.chat_id == chat_id, ChatMessage.seq < seq)
        .order_by(ChatMessage.seq.asc())
    ).all())
    prompt = _build_conversation_prompt(prior_messages, content)

    # Try to reuse an idle persistent session before spawning a new one
    reused = False
    if chat.active_run_id is not None:
        try:
            reused = await mgr.continue_session(chat.active_run_id, prompt)
        except Exception:
            logger.debug(
                "continue_session failed, will start new run",
                extra={"chat_id": str(chat_id), "run_id": str(chat.active_run_id)},
            )

    if reused:
        logger.info(
            "reused persistent session",
            extra={"chat_id": str(chat_id), "run_id": str(chat.active_run_id)},
        )
    else:
        # Start a new agent run (persistent so session stays alive)
        try:
            run = await mgr.start_run(
                project_id=chat.project_id,
                skill_name=chat.skill_name,
                skill_args={},
                prompt=prompt,
                set_id=None,
                worktree=None,
                persistent=True,
            )
            # Bind run to chat
            chat.active_run_id = run.id
            session.add(chat)
            session.commit()
        except StateError:
            # A run is already active -- the existing SSE stream handles it.
            # Don't fail the message save.
            logger.warning(
                "could not start agent run for chat",
                extra={"chat_id": str(chat_id)},
            )

    return msg


async def list_messages(
    session: Session, chat_id: UUID, since_seq: int = 0
) -> list[ChatMessage]:
    """Load messages for replay (historical).

    Used by GET /api/chats/{id}/messages and by SSE reconnect before
    joining the live stream.
    """
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.chat_id == chat_id, ChatMessage.seq > since_seq)
        .order_by(ChatMessage.seq.asc())  # type: ignore[union-attr]
    )
    return list(session.exec(stmt).all())


# ---------------------------------------------------------------------------
# Assistant turn materialization (called from event-stream consumer)
# ---------------------------------------------------------------------------


async def materialize_assistant_turn(
    session: Session,
    chat_id: UUID,
    agent_run_id: UUID,
    text: str,
    tool_calls: list[dict] | None = None,
) -> ChatMessage:
    """Persist a single assistant ChatMessage at run_complete time.

    Accumulates assistant_text deltas + tool_use blocks from the agent_event
    stream, writing a single ChatMessage(role='assistant') with the final text
    and tool_calls JSON.
    """
    seq = _next_seq(session, chat_id)
    msg = ChatMessage(
        chat_id=chat_id,
        seq=seq,
        role="assistant",
        content=text,
        tool_calls=json.dumps(tool_calls or []),
        agent_run_id=agent_run_id,
    )
    session.add(msg)

    # Update last_message_at
    chat = session.get(Chat, chat_id)
    if chat is not None:
        chat.last_message_at = _utcnow()
        session.add(chat)

    session.commit()
    session.refresh(msg)
    return msg
