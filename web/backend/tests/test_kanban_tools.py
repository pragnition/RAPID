"""Tests for kanban agent tools — build_kanban_tools factory and tool behavior."""

import asyncio
import json
from uuid import uuid4

import pytest
from sqlmodel import Session

from app.database import KanbanCard, KanbanColumn, Project
from app.models.agent_run import AgentRun
from app.services import kanban_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture()
def project(session: Session) -> Project:
    proj = Project(name="tools-test", path=f"/tmp/tools-test-{uuid4().hex[:8]}")
    session.add(proj)
    session.commit()
    session.refresh(proj)
    return proj


@pytest.fixture()
def column(session: Session, project: Project) -> KanbanColumn:
    col = KanbanColumn(project_id=project.id, title="Backlog", position=0)
    session.add(col)
    session.commit()
    session.refresh(col)
    return col


@pytest.fixture()
def done_column(session: Session, project: Project) -> KanbanColumn:
    col = KanbanColumn(project_id=project.id, title="Done", position=1)
    session.add(col)
    session.commit()
    session.refresh(col)
    return col


@pytest.fixture()
def agent_run(session: Session, project: Project) -> AgentRun:
    run = AgentRun(project_id=project.id, skill_name="test-skill")
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def _run_tool(engine, run_id, tool_name, args):
    """Build tools and call one by name, running the async body synchronously."""
    from unittest.mock import MagicMock

    from app.agents.tools.kanban_tools import build_kanban_tools

    manager = MagicMock()
    manager.engine = engine
    tools = build_kanban_tools(run_id=run_id, manager=manager)
    tool_map = {t.name: t for t in tools}
    assert tool_name in tool_map, f"Tool {tool_name} not found in {list(tool_map)}"
    handler = tool_map[tool_name].handler
    return asyncio.run(handler(args))


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_list_cards_returns_all(
    engine, session: Session, column: KanbanColumn, agent_run: AgentRun
):
    """Create cards, call list_cards, verify all returned."""
    kanban_service.create_card(session, column.id, "Card A")
    kanban_service.create_card(session, column.id, "Card B")

    result = _run_tool(engine, agent_run.id, "list_cards", {})
    assert result["is_error"] is False
    cards = json.loads(result["content"][0]["text"])
    assert len(cards) == 2
    titles = {c["title"] for c in cards}
    assert titles == {"Card A", "Card B"}


def test_list_cards_filter_by_column(
    engine,
    session: Session,
    column: KanbanColumn,
    done_column: KanbanColumn,
    agent_run: AgentRun,
):
    """Filter by column title."""
    kanban_service.create_card(session, column.id, "Backlog Card")
    kanban_service.create_card(session, done_column.id, "Done Card")

    result = _run_tool(engine, agent_run.id, "list_cards", {"column": "done"})
    assert result["is_error"] is False
    cards = json.loads(result["content"][0]["text"])
    assert len(cards) == 1
    assert cards[0]["title"] == "Done Card"


def test_get_card_wraps_description_untrusted(
    engine, session: Session, column: KanbanColumn, agent_run: AgentRun
):
    """Verify description is wrapped in <untrusted> tags."""
    card = kanban_service.create_card(session, column.id, "Test", "Secret instructions")

    result = _run_tool(engine, agent_run.id, "get_card", {"card_id": str(card.id)})
    assert result["is_error"] is False
    data = json.loads(result["content"][0]["text"])
    assert data["description"] == "<untrusted>Secret instructions</untrusted>"


def test_add_card_enforces_cap(
    engine, session: Session, column: KanbanColumn, agent_run: AgentRun
):
    """Create 5 cards as agent, attempt 6th, verify error."""
    for i in range(5):
        result = _run_tool(
            engine,
            agent_run.id,
            "add_card",
            {"column": "Backlog", "title": f"Card {i}"},
        )
        assert result["is_error"] is False, f"Card {i} creation failed"

    # 6th should fail
    result = _run_tool(
        engine,
        agent_run.id,
        "add_card",
        {"column": "Backlog", "title": "Card 6"},
    )
    assert result["is_error"] is True
    assert "limit" in result["content"][0]["text"].lower()


def test_move_card_requires_lock(
    engine,
    session: Session,
    column: KanbanColumn,
    done_column: KanbanColumn,
    agent_run: AgentRun,
):
    """Move a card without holding the lock. Verify error."""
    card = kanban_service.create_card(session, column.id, "Unlocked")

    result = _run_tool(
        engine,
        agent_run.id,
        "move_card",
        {"card_id": str(card.id), "to_column": "Done", "rev": 0},
    )
    assert result["is_error"] is True
    assert "not locked" in result["content"][0]["text"].lower()


def test_update_card_requires_lock(
    engine, session: Session, column: KanbanColumn, agent_run: AgentRun
):
    """Update a card without holding the lock. Verify error."""
    card = kanban_service.create_card(session, column.id, "Unlocked Update")

    result = _run_tool(
        engine,
        agent_run.id,
        "update_card",
        {"card_id": str(card.id), "title": "New Title", "rev": 0},
    )
    assert result["is_error"] is True
    assert "not locked" in result["content"][0]["text"].lower()


def test_comment_card_appends(
    engine, session: Session, column: KanbanColumn, agent_run: AgentRun
):
    """Add two comments, verify both in metadata_json."""
    card = kanban_service.create_card(session, column.id, "Commentable")

    _run_tool(
        engine,
        agent_run.id,
        "comment_card",
        {"card_id": str(card.id), "comment": "First comment"},
    )
    result = _run_tool(
        engine,
        agent_run.id,
        "comment_card",
        {"card_id": str(card.id), "comment": "Second comment"},
    )
    assert result["is_error"] is False

    session.expire(card)
    refreshed = session.get(KanbanCard, card.id)
    meta = json.loads(refreshed.metadata_json)
    assert meta["comments"] == ["First comment", "Second comment"]
