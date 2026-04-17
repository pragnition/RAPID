"""Kanban board agent tools — MCP tools for reading/writing kanban cards.

These tools run in-process and bridge the SDK-side agent to the kanban board
via ``kanban_service``.  Each tool function is async and uses
``asyncio.to_thread`` for all DB operations.

Factory: :func:`build_kanban_tools` — called from ``build_tools`` in
``__init__.py`` with the bound ``run_id`` and ``manager``.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING, Any, List
from uuid import UUID

from claude_agent_sdk import tool
from sqlmodel import Session, select, func

from app.database import KanbanCard, KanbanColumn

if TYPE_CHECKING:  # pragma: no cover
    from app.agents.session_manager import AgentSessionManager

logger = logging.getLogger("rapid.agents.tools.kanban")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ok(text: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": text}], "is_error": False}


def _err(text: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": text}], "is_error": True}


def _card_to_dict(card: KanbanCard, column_title: str | None = None) -> dict:
    """Serialize a card for tool responses.

    Card descriptions are wrapped in ``<untrusted>`` tags as a behavioral
    contract — agents must not treat card descriptions as trusted instructions.
    """
    return {
        "id": str(card.id),
        "title": card.title,
        "description": f"<untrusted>{card.description}</untrusted>",
        "agent_status": card.agent_status,
        "rev": card.rev,
        "column_title": column_title or "",
        "column_id": str(card.column_id),
        "locked_by_run_id": str(card.locked_by_run_id) if card.locked_by_run_id else None,
        "created_by": card.created_by,
        "retry_count": card.retry_count,
    }


def _resolve_column_by_title(session: Session, title: str) -> KanbanColumn | None:
    """Find a column by case-insensitive title match."""
    stmt = select(KanbanColumn).where(func.lower(KanbanColumn.title) == title.lower())
    return session.exec(stmt).first()


# ---------------------------------------------------------------------------
# Tool factory
# ---------------------------------------------------------------------------


def build_kanban_tools(
    *, run_id: UUID, manager: "AgentSessionManager"
) -> List[Any]:
    """Return the kanban SDK MCP tool objects for this run.

    Follows the same factory+closure pattern as ``ask_user.py``.
    """

    # -- list_cards --------------------------------------------------------

    @tool(
        "list_cards",
        "List kanban cards. Optionally filter by column title.",
        {
            "type": "object",
            "properties": {
                "column": {
                    "type": ["string", "null"],
                    "description": "Column title to filter by (case-insensitive). Omit for all cards.",
                    "default": None,
                },
            },
        },
    )
    async def list_cards(args: dict[str, Any]) -> dict[str, Any]:
        column_filter: str | None = args.get("column")

        def _query() -> list[dict]:
            with Session(manager.engine) as s:
                if column_filter:
                    col = _resolve_column_by_title(s, column_filter)
                    if col is None:
                        return []
                    stmt = (
                        select(KanbanCard)
                        .where(KanbanCard.column_id == col.id)
                        .order_by(KanbanCard.position)
                    )
                    cards = list(s.exec(stmt).all())
                    return [_card_to_dict(c, col.title) for c in cards]
                else:
                    # All cards across all columns
                    stmt = select(KanbanCard).order_by(KanbanCard.position)
                    cards = list(s.exec(stmt).all())
                    result = []
                    for c in cards:
                        col = s.get(KanbanColumn, c.column_id)
                        col_title = col.title if col else ""
                        result.append(_card_to_dict(c, col_title))
                    return result

        cards = await asyncio.to_thread(_query)
        return _ok(json.dumps(cards))

    # -- get_card ----------------------------------------------------------

    @tool(
        "get_card",
        "Get full details of a kanban card by its ID.",
        {
            "type": "object",
            "properties": {
                "card_id": {"type": "string", "description": "UUID of the card."},
            },
            "required": ["card_id"],
        },
    )
    async def get_card(args: dict[str, Any]) -> dict[str, Any]:
        card_id_str = str(args.get("card_id", ""))

        def _query() -> dict | None:
            with Session(manager.engine) as s:
                try:
                    card = s.get(KanbanCard, UUID(card_id_str))
                except ValueError:
                    return None
                if card is None:
                    return None
                col = s.get(KanbanColumn, card.column_id)
                col_title = col.title if col else ""
                return _card_to_dict(card, col_title)

        result = await asyncio.to_thread(_query)
        if result is None:
            return _err(f"Card {card_id_str} not found")
        return _ok(json.dumps(result))

    # -- add_card ----------------------------------------------------------

    @tool(
        "add_card",
        "Create a new kanban card in the specified column. "
        "Agents are limited to creating 5 cards per run.",
        {
            "type": "object",
            "properties": {
                "column": {"type": "string", "description": "Column title (case-insensitive)."},
                "title": {"type": "string", "description": "Card title."},
                "description": {"type": "string", "default": ""},
                "labels": {
                    "type": "string",
                    "description": "Comma-separated labels (e.g. 'bug,feature').",
                    "default": "",
                },
            },
            "required": ["column", "title"],
        },
    )
    async def add_card(args: dict[str, Any]) -> dict[str, Any]:
        column_title = str(args.get("column", ""))
        title = str(args.get("title", ""))
        description = str(args.get("description", ""))
        labels_raw = str(args.get("labels", ""))

        created_by = f"agent:{run_id}"

        def _create() -> dict | str:
            from app.services import kanban_service as ks

            with Session(manager.engine) as s:
                # Enforce creation cap
                count = s.exec(
                    select(func.count(KanbanCard.id)).where(
                        KanbanCard.created_by == created_by
                    )
                ).one()
                if count >= 5:
                    return "Agent card creation limit reached (5 cards per run)."

                col = _resolve_column_by_title(s, column_title)
                if col is None:
                    return f"Column '{column_title}' not found."

                # Parse labels
                labels = [l.strip() for l in labels_raw.split(",") if l.strip()] if labels_raw else []

                card = ks.create_card(
                    s, col.id, title, description, created_by=created_by
                )

                # Store labels in metadata_json
                if labels:
                    card.metadata_json = json.dumps({"labels": labels})
                    s.add(card)
                    s.commit()
                    s.refresh(card)

                return _card_to_dict(card, col.title)

        result = await asyncio.to_thread(_create)
        if isinstance(result, str):
            return _err(result)
        return _ok(json.dumps(result))

    # -- move_card ---------------------------------------------------------

    @tool(
        "move_card",
        "Move a kanban card to a different column. You must hold the lock "
        "on the card (it must be claimed by your run). Provide the current "
        "rev for optimistic concurrency control.",
        {
            "type": "object",
            "properties": {
                "card_id": {"type": "string", "description": "UUID of the card."},
                "to_column": {"type": "string", "description": "Target column title (case-insensitive)."},
                "rev": {"type": "integer", "description": "Current card rev for OCC."},
            },
            "required": ["card_id", "to_column", "rev"],
        },
    )
    async def move_card_tool(args: dict[str, Any]) -> dict[str, Any]:
        card_id_str = str(args.get("card_id", ""))
        to_column = str(args.get("to_column", ""))
        rev = int(args.get("rev", 0))

        def _move() -> dict | str:
            from app.services import kanban_service as ks
            from app.services.kanban_service import StaleRevisionError

            with Session(manager.engine) as s:
                try:
                    card_uuid = UUID(card_id_str)
                except ValueError:
                    return f"Invalid card ID: {card_id_str}"

                card = s.get(KanbanCard, card_uuid)
                if card is None:
                    return f"Card {card_id_str} not found."

                # Verify lock ownership
                if card.locked_by_run_id != run_id:
                    return f"Card {card_id_str} is not locked by this run."

                target_col = _resolve_column_by_title(s, to_column)
                if target_col is None:
                    return f"Column '{to_column}' not found."

                try:
                    moved = ks.move_card(
                        s, card_uuid, target_col.id, 0, rev=rev
                    )
                except StaleRevisionError as e:
                    return str(e)

                return _card_to_dict(moved, target_col.title)

        result = await asyncio.to_thread(_move)
        if isinstance(result, str):
            return _err(result)
        return _ok(json.dumps(result))

    # -- update_card -------------------------------------------------------

    @tool(
        "update_card",
        "Update a kanban card's title or description. You must hold the "
        "lock on the card. Provide the current rev for OCC.",
        {
            "type": "object",
            "properties": {
                "card_id": {"type": "string", "description": "UUID of the card."},
                "title": {"type": ["string", "null"], "default": None},
                "description": {"type": ["string", "null"], "default": None},
                "rev": {"type": "integer", "default": 0},
            },
            "required": ["card_id"],
        },
    )
    async def update_card_tool(args: dict[str, Any]) -> dict[str, Any]:
        card_id_str = str(args.get("card_id", ""))
        new_title = args.get("title")
        new_description = args.get("description")
        rev = int(args.get("rev", 0))

        def _update() -> dict | str:
            from app.services import kanban_service as ks
            from app.services.kanban_service import StaleRevisionError

            with Session(manager.engine) as s:
                try:
                    card_uuid = UUID(card_id_str)
                except ValueError:
                    return f"Invalid card ID: {card_id_str}"

                card = s.get(KanbanCard, card_uuid)
                if card is None:
                    return f"Card {card_id_str} not found."

                # Verify lock ownership
                if card.locked_by_run_id != run_id:
                    return f"Card {card_id_str} is not locked by this run."

                try:
                    updated = ks.update_card(
                        s, card_uuid,
                        title=new_title,
                        description=new_description,
                        rev=rev,
                    )
                except StaleRevisionError as e:
                    return str(e)

                col = s.get(KanbanColumn, updated.column_id)
                col_title = col.title if col else ""
                return _card_to_dict(updated, col_title)

        result = await asyncio.to_thread(_update)
        if isinstance(result, str):
            return _err(result)
        return _ok(json.dumps(result))

    # -- comment_card ------------------------------------------------------

    @tool(
        "comment_card",
        "Add a comment to a kanban card. Any agent can comment on any card "
        "(no lock required).",
        {
            "type": "object",
            "properties": {
                "card_id": {"type": "string", "description": "UUID of the card."},
                "comment": {"type": "string", "description": "Comment text."},
            },
            "required": ["card_id", "comment"],
        },
    )
    async def comment_card(args: dict[str, Any]) -> dict[str, Any]:
        card_id_str = str(args.get("card_id", ""))
        comment_text = str(args.get("comment", ""))

        def _comment() -> str | None:
            with Session(manager.engine) as s:
                try:
                    card_uuid = UUID(card_id_str)
                except ValueError:
                    return f"Invalid card ID: {card_id_str}"

                card = s.get(KanbanCard, card_uuid)
                if card is None:
                    return f"Card {card_id_str} not found."

                # Parse existing metadata and append comment
                try:
                    meta = json.loads(card.metadata_json) if card.metadata_json else {}
                except json.JSONDecodeError:
                    meta = {}

                comments = meta.get("comments", [])
                comments.append(comment_text)
                meta["comments"] = comments

                card.metadata_json = json.dumps(meta)
                s.add(card)
                s.commit()
                return None  # success

        error = await asyncio.to_thread(_comment)
        if error is not None:
            return _err(error)
        return _ok("Comment added")

    return [list_cards, get_card, add_card, move_card_tool, update_card_tool, comment_card]


__all__ = ["build_kanban_tools"]
