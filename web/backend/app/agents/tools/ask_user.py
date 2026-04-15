"""``webui_ask_user`` and ``ask_free_text`` SDK MCP tools.

These tools run in-process (registered via ``create_sdk_mcp_server``) and
bridge the SDK-side agent to the web UI via an SSE ``ask_user`` event plus a
future awaited until the user submits an answer through
``POST /api/agents/runs/{id}/answer``.

Design notes:

* ``prompt_id`` is minted inside the tool body BEFORE insert so the emitted
  SSE event can carry it (clients need it to post the answer back).
* A per-run ``asyncio.Lock`` in ``manager._prompt_locks`` serialises insert +
  event emit so two concurrent tool calls don't trip the partial unique
  index ``uq_agent_prompt_run_pending``.
* On resolve, the tool writes ``consumed_at = utcnow()`` — this is the
  "agent has consumed the answer" marker that makes a later reopen return 409.
* On ``asyncio.CancelledError`` (the run is interrupted), the tool marks the
  prompt ``stale`` and re-raises.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, List
from uuid import UUID, uuid4

from claude_agent_sdk import tool
from sqlmodel import Session

from app.models.agent_prompt import AgentPrompt
from app.schemas.sse_events import AskUserEvent

if TYPE_CHECKING:  # pragma: no cover
    from app.agents.session_manager import AgentSessionManager

logger = logging.getLogger("rapid.agents.tools.ask_user")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# DB helpers — all I/O routed through asyncio.to_thread to avoid blocking.
# ---------------------------------------------------------------------------


def _insert_prompt_sync(
    engine: Any,
    *,
    prompt_id: str,
    run_id: UUID,
    payload_json: str,
    batch_id: str | None = None,
    batch_position: int | None = None,
) -> None:
    with Session(engine) as s:
        s.add(
            AgentPrompt(
                id=prompt_id,
                run_id=run_id,
                kind="ask_user",
                payload=payload_json,
                status="pending",
                created_at=_utcnow(),
                batch_id=batch_id,
                batch_position=batch_position,
            )
        )
        s.commit()


def _mark_prompt_consumed_sync(engine: Any, prompt_id: str) -> None:
    """Set ``consumed_at`` on a prompt. No-op if the row is missing."""
    with Session(engine) as s:
        row = s.get(AgentPrompt, prompt_id)
        if row is None:
            return
        row.consumed_at = _utcnow()
        s.add(row)
        s.commit()


def _mark_prompt_stale_sync(engine: Any, prompt_id: str) -> None:
    """Force a prompt to ``stale`` (used on agent-side cancellation)."""
    with Session(engine) as s:
        row = s.get(AgentPrompt, prompt_id)
        if row is None:
            return
        # Only transition if still pending — don't clobber an answered prompt.
        if row.status == "pending":
            row.status = "stale"
            s.add(row)
            s.commit()


# ---------------------------------------------------------------------------
# Core emit+await primitive, shared by the two @tool functions and by the
# AskUserQuestion interception path in permission_hooks.py.
# ---------------------------------------------------------------------------


async def emit_and_await_prompt(
    *,
    run_id: UUID,
    manager: "AgentSessionManager",
    question: str,
    options: list[str] | None,
    allow_free_text: bool,
    n_of_m: tuple[int, int] | None = None,
    batch_id: str | None = None,
    batch_position: int | None = None,
    tool_use_id: str = "",
) -> str:
    """Mint a prompt, persist + emit SSE, await the answer, mark consumed.

    Returns the plain string answer. On ``asyncio.CancelledError`` the prompt
    is marked ``stale`` and the exception re-raised.
    """
    prompt_id = str(uuid4())

    # Build the JSON payload up-front.
    payload: dict[str, Any] = {
        "question": question,
        "options": options,
        "allow_free_text": allow_free_text,
    }
    if n_of_m is not None:
        payload["n_of_m"] = list(n_of_m)
    payload_json = json.dumps(payload)

    # Per-run lock ensures the DB insert + SSE emit + future registration are
    # serialised — stops two concurrent tool calls from tripping the partial
    # unique index.
    lock = manager._prompt_locks.setdefault(run_id, asyncio.Lock())

    loop = asyncio.get_running_loop()
    future: asyncio.Future[str] = loop.create_future()

    # Try to hook the session's waiting-time accounting. The session may not
    # be registered yet during rare startup races — treat as best-effort.
    session = manager._sessions.get(run_id)

    async with lock:
        # Persist FIRST — if this throws (e.g. partial unique index collision)
        # we bail out before registering the future or emitting the event.
        await asyncio.to_thread(
            _insert_prompt_sync,
            manager.engine,
            prompt_id=prompt_id,
            run_id=run_id,
            payload_json=payload_json,
            batch_id=batch_id,
            batch_position=batch_position,
        )

        # Register the future BEFORE publishing so a fast client answer can't
        # race past an unregistered prompt_id.
        manager._prompt_futures[prompt_id] = future

        # Emit the SSE event. next_seq must be called on the channel the
        # session uses (same pattern as session.py:_next_seq).
        channel = await manager.event_bus.get_or_create_channel(run_id)
        seq = channel.next_seq()
        event = AskUserEvent(
            seq=seq,
            ts=_utcnow(),
            run_id=run_id,
            prompt_id=prompt_id,
            tool_use_id=tool_use_id,
            question=question,
            options=options,
            allow_free_text=allow_free_text,
        )
        await manager.event_bus.publish(run_id, event)

    # Enter the waiting window for budget/active-duration accounting.
    if session is not None:
        try:
            session._enter_waiting()
        except Exception:
            logger.exception(
                "failed to enter waiting state",
                extra={"run_id": str(run_id), "prompt_id": prompt_id},
            )

    try:
        answer = await future
    except asyncio.CancelledError:
        # Run was interrupted while waiting — mark the prompt stale and let
        # the cancellation propagate.
        await asyncio.to_thread(_mark_prompt_stale_sync, manager.engine, prompt_id)
        manager._prompt_futures.pop(prompt_id, None)
        raise
    finally:
        if session is not None:
            try:
                session._leave_waiting()
            except Exception:
                logger.exception(
                    "failed to leave waiting state",
                    extra={"run_id": str(run_id), "prompt_id": prompt_id},
                )

    # Resolve-path bookkeeping: manager.resolve_prompt already set status=
    # answered and answered_at; we set consumed_at now to signal the agent
    # has read the answer (reopens after this point must return 409).
    await asyncio.to_thread(_mark_prompt_consumed_sync, manager.engine, prompt_id)
    manager._prompt_futures.pop(prompt_id, None)
    return answer


# ---------------------------------------------------------------------------
# Tool factories — each returns a freshly-decorated coroutine that closes
# over ``run_id`` + ``manager``. Called from AgentSession.__aenter__.
# ---------------------------------------------------------------------------


def build_ask_user_tools(
    *, run_id: UUID, manager: "AgentSessionManager"
) -> List[Any]:
    """Return the two SDK MCP tool objects for this run.

    The SDK's ``@tool`` decorator yields an ``SdkMcpTool`` instance that
    captures the coroutine, name, description, and input_schema.
    """

    @tool(
        "webui_ask_user",
        "Ask the user a structured question via the RAPID web UI. "
        "Use when the skill needs multi-choice selection, free-form input, "
        "or more than the 4 questions supported by the built-in "
        "AskUserQuestion tool.",
        {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "options": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                    "default": None,
                },
                "allow_free_text": {"type": "boolean", "default": True},
                "n_of_m": {
                    "type": ["array", "null"],
                    "items": {"type": "integer"},
                    "minItems": 2,
                    "maxItems": 2,
                    "default": None,
                },
            },
            "required": ["question"],
        },
    )
    async def webui_ask_user(args: dict[str, Any]) -> dict[str, Any]:
        question = str(args.get("question") or "")
        options = args.get("options")
        if options is not None and not isinstance(options, list):
            options = list(options)
        allow_free_text = bool(args.get("allow_free_text", True))
        n_of_m_raw = args.get("n_of_m")
        n_of_m: tuple[int, int] | None = None
        if n_of_m_raw is not None:
            try:
                n_of_m = (int(n_of_m_raw[0]), int(n_of_m_raw[1]))
            except Exception:
                n_of_m = None

        answer = await emit_and_await_prompt(
            run_id=run_id,
            manager=manager,
            question=question,
            options=options,
            allow_free_text=allow_free_text,
            n_of_m=n_of_m,
        )
        return {
            "content": [{"type": "text", "text": answer}],
            "is_error": False,
        }

    @tool(
        "ask_free_text",
        "Ask the user a free-form text question via the RAPID web UI. "
        "Thin specialisation of webui_ask_user with no options and free "
        "text input forced on.",
        {
            "type": "object",
            "properties": {"question": {"type": "string"}},
            "required": ["question"],
        },
    )
    async def ask_free_text(args: dict[str, Any]) -> dict[str, Any]:
        question = str(args.get("question") or "")
        answer = await emit_and_await_prompt(
            run_id=run_id,
            manager=manager,
            question=question,
            options=None,
            allow_free_text=True,
        )
        return {
            "content": [{"type": "text", "text": answer}],
            "is_error": False,
        }

    return [webui_ask_user, ask_free_text]


__all__ = [
    "build_ask_user_tools",
    "emit_and_await_prompt",
]
