"""Tests for kanban_service — agent-aware CRUD, OCC, and locking."""

from uuid import uuid4

import pytest
from sqlmodel import Session

from app.database import KanbanCard, KanbanColumn, Project
from app.models.agent_run import AgentRun
from app.services.kanban_service import (
    StaleRevisionError,
    create_card,
    create_column,
    get_board,
    lock_card,
    move_card,
    set_card_agent_status,
    unlock_card,
    update_card,
    update_column_autopilot,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture()
def project(session: Session) -> Project:
    """Create and return a test project."""
    proj = Project(name="test-proj", path=f"/tmp/test-kanban-{uuid4().hex[:8]}")
    session.add(proj)
    session.commit()
    session.refresh(proj)
    return proj


@pytest.fixture()
def column(session: Session, project: Project) -> KanbanColumn:
    """Create and return a test kanban column."""
    col = KanbanColumn(project_id=project.id, title="Backlog", position=0)
    session.add(col)
    session.commit()
    session.refresh(col)
    return col


@pytest.fixture()
def second_column(session: Session, project: Project) -> KanbanColumn:
    """Create and return a second test kanban column."""
    col = KanbanColumn(project_id=project.id, title="In Progress", position=1)
    session.add(col)
    session.commit()
    session.refresh(col)
    return col


@pytest.fixture()
def agent_run(session: Session, project: Project) -> AgentRun:
    """Create and return an AgentRun row (FK target for lock fields)."""
    run = AgentRun(
        project_id=project.id,
        skill_name="test-skill",
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


@pytest.fixture()
def agent_run_b(session: Session, project: Project) -> AgentRun:
    """Create a second AgentRun for contention tests."""
    run = AgentRun(
        project_id=project.id,
        skill_name="test-skill-b",
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


# ---------------------------------------------------------------------------
# Task 1 / 3g: create_card defaults & created_by
# ---------------------------------------------------------------------------


def test_create_card_default_fields(session: Session, column: KanbanColumn):
    card = create_card(session, column.id, "My Card")
    assert card.rev == 0
    assert card.agent_status == "idle"
    assert card.created_by == "human"
    assert card.locked_by_run_id is None
    assert card.completed_by_run_id is None
    assert card.agent_run_id is None
    assert card.retry_count == 0
    assert card.metadata_json == "{}"


def test_create_card_agent_created(session: Session, column: KanbanColumn):
    card = create_card(session, column.id, "Agent Card", created_by="agent:run-123")
    assert card.created_by == "agent:run-123"


# ---------------------------------------------------------------------------
# Task 3b/3c: lock_card / unlock_card
# ---------------------------------------------------------------------------


def test_lock_card_success(
    session: Session, column: KanbanColumn, agent_run: AgentRun
):
    card = create_card(session, column.id, "Lockable")
    result = lock_card(session, card.id, agent_run.id)
    assert result is True

    # Re-read to verify
    session.expire(card)
    refreshed = session.get(KanbanCard, card.id)
    assert refreshed is not None
    assert refreshed.locked_by_run_id == agent_run.id
    assert refreshed.agent_status == "claimed"


def test_lock_card_already_locked(
    session: Session,
    column: KanbanColumn,
    agent_run: AgentRun,
    agent_run_b: AgentRun,
):
    card = create_card(session, column.id, "Contested")
    assert lock_card(session, card.id, agent_run.id) is True
    # Second lock attempt with different run_id fails
    assert lock_card(session, card.id, agent_run_b.id) is False


def test_unlock_card_success(
    session: Session, column: KanbanColumn, agent_run: AgentRun
):
    card = create_card(session, column.id, "Lock-then-Unlock")
    assert card.rev == 0
    lock_card(session, card.id, agent_run.id)

    unlock_card(session, card.id, agent_run.id)

    session.expire(card)
    refreshed = session.get(KanbanCard, card.id)
    assert refreshed is not None
    assert refreshed.locked_by_run_id is None
    assert refreshed.agent_status == "idle"
    assert refreshed.rev == 1  # bumped by unlock


def test_unlock_card_wrong_run(
    session: Session,
    column: KanbanColumn,
    agent_run: AgentRun,
    agent_run_b: AgentRun,
):
    card = create_card(session, column.id, "Wrong-Unlocker")
    lock_card(session, card.id, agent_run.id)

    # Unlock with wrong run_id is a no-op (WHERE clause doesn't match)
    unlock_card(session, card.id, agent_run_b.id)

    session.expire(card)
    refreshed = session.get(KanbanCard, card.id)
    assert refreshed is not None
    assert refreshed.locked_by_run_id == agent_run.id  # still locked
    assert refreshed.agent_status == "claimed"  # unchanged


# ---------------------------------------------------------------------------
# Task 3d: move_card with rev
# ---------------------------------------------------------------------------


def test_move_card_with_rev_success(
    session: Session, column: KanbanColumn, second_column: KanbanColumn
):
    card = create_card(session, column.id, "Mover")
    assert card.rev == 0
    moved = move_card(session, card.id, second_column.id, 0, rev=0)
    assert moved.rev == 1
    assert moved.column_id == second_column.id


def test_move_card_stale_rev(
    session: Session, column: KanbanColumn, second_column: KanbanColumn
):
    card = create_card(session, column.id, "Stale-Mover")
    # Move with correct rev first
    move_card(session, card.id, second_column.id, 0, rev=0)
    # Now try to move with stale rev=0 (should be 1)
    with pytest.raises(StaleRevisionError) as exc_info:
        move_card(session, card.id, column.id, 0, rev=0)
    assert exc_info.value.expected_rev == 0
    assert exc_info.value.actual_rev == 1


# ---------------------------------------------------------------------------
# Task 3e: update_card with rev
# ---------------------------------------------------------------------------


def test_update_card_with_rev_success(session: Session, column: KanbanColumn):
    card = create_card(session, column.id, "Updatable")
    updated = update_card(session, card.id, title="Updated Title", rev=0)
    assert updated.rev == 1
    assert updated.title == "Updated Title"


def test_update_card_stale_rev(session: Session, column: KanbanColumn):
    card = create_card(session, column.id, "Stale-Update")
    update_card(session, card.id, title="V1", rev=0)
    with pytest.raises(StaleRevisionError) as exc_info:
        update_card(session, card.id, title="V2", rev=0)
    assert exc_info.value.expected_rev == 0
    assert exc_info.value.actual_rev == 1


# ---------------------------------------------------------------------------
# Task 3h: get_board includes agent fields
# ---------------------------------------------------------------------------


def test_get_board_includes_agent_fields(
    session: Session, project: Project, column: KanbanColumn
):
    create_card(session, column.id, "Board Card")
    board = get_board(session, project.id)

    assert len(board["columns"]) >= 1
    col_data = board["columns"][0]
    assert "is_autopilot" in col_data
    assert col_data["is_autopilot"] is False

    assert len(col_data["cards"]) >= 1
    card_data = col_data["cards"][0]
    assert "rev" in card_data
    assert "agent_status" in card_data
    assert "created_by" in card_data
    assert "locked_by_run_id" in card_data
    assert "completed_by_run_id" in card_data
    assert "agent_run_id" in card_data
    assert "retry_count" in card_data
    assert card_data["rev"] == 0
    assert card_data["agent_status"] == "idle"
    assert card_data["created_by"] == "human"


# ---------------------------------------------------------------------------
# Task 3f: set_card_agent_status
# ---------------------------------------------------------------------------


def test_set_card_agent_status(
    session: Session, column: KanbanColumn, agent_run: AgentRun
):
    card = create_card(session, column.id, "Status Card")
    lock_card(session, card.id, agent_run.id)

    updated = set_card_agent_status(session, card.id, "running", agent_run.id)
    assert updated.agent_status == "running"
    assert updated.rev == 1  # bumped from 0


def test_set_card_agent_status_wrong_run(
    session: Session,
    column: KanbanColumn,
    agent_run: AgentRun,
    agent_run_b: AgentRun,
):
    card = create_card(session, column.id, "Guarded Status")
    lock_card(session, card.id, agent_run.id)

    with pytest.raises(ValueError, match="locked by run"):
        set_card_agent_status(session, card.id, "running", agent_run_b.id)


# ---------------------------------------------------------------------------
# Task 3i: update_column_autopilot
# ---------------------------------------------------------------------------


def test_update_column_autopilot(session: Session, column: KanbanColumn):
    assert column.is_autopilot is False
    updated = update_column_autopilot(session, column.id, True)
    assert updated.is_autopilot is True

    # Toggle back
    toggled = update_column_autopilot(session, column.id, False)
    assert toggled.is_autopilot is False


# ---------------------------------------------------------------------------
# Board JSON projection matches DB
# ---------------------------------------------------------------------------


def test_board_json_projection_matches_db(
    session: Session,
    project: Project,
    column: KanbanColumn,
    agent_run: AgentRun,
):
    """After mutations, verify the board projection reflects reality."""
    card = create_card(session, column.id, "Projection Card", created_by="agent:test")
    lock_card(session, card.id, agent_run.id)
    set_card_agent_status(session, card.id, "running", agent_run.id)

    board = get_board(session, project.id)
    card_data = board["columns"][0]["cards"][0]
    assert card_data["created_by"] == "agent:test"
    assert card_data["agent_status"] == "running"
    assert card_data["locked_by_run_id"] == str(agent_run.id)
    assert card_data["rev"] == 1  # bumped by set_card_agent_status


# ---------------------------------------------------------------------------
# autopilot_ignore field
# ---------------------------------------------------------------------------


def test_create_card_autopilot_ignore(session: Session, column: KanbanColumn):
    """Card created with autopilot_ignore=True persists the flag."""
    card = create_card(session, column.id, "Ignored task", autopilot_ignore=True)
    assert card.autopilot_ignore is True

    # Verify it round-trips through get_board
    board = get_board(session, column.project_id)
    card_data = board["columns"][0]["cards"][0]
    assert card_data["autopilot_ignore"] is True


def test_create_card_autopilot_ignore_defaults_false(
    session: Session, column: KanbanColumn
):
    """Cards default to autopilot_ignore=False."""
    card = create_card(session, column.id, "Normal task")
    assert card.autopilot_ignore is False


# ---------------------------------------------------------------------------
# agent_type field
# ---------------------------------------------------------------------------


def test_create_card_default_agent_type(session: Session, column: KanbanColumn):
    """Card created without specifying agent_type defaults to 'quick'."""
    card = create_card(session, column.id, "Default agent type card")
    assert card.agent_type == "quick"


def test_create_card_custom_agent_type(session: Session, column: KanbanColumn):
    """Card created with agent_type='bug-fix' persists the value."""
    card = create_card(session, column.id, "Bug fix card", agent_type="bug-fix")
    assert card.agent_type == "bug-fix"


def test_update_card_agent_type(session: Session, column: KanbanColumn):
    """Updating a card's agent_type from 'quick' to 'bug-fix' persists."""
    card = create_card(session, column.id, "Changeable agent type")
    assert card.agent_type == "quick"
    updated = update_card(session, card.id, agent_type="bug-fix")
    assert updated.agent_type == "bug-fix"


def test_column_default_agent_type(session: Session, project: Project):
    """Column created without specifying default_agent_type defaults to 'quick'."""
    col = create_column(session, project.id, "Test Column")
    assert col.default_agent_type == "quick"


def test_board_includes_agent_type_fields(
    session: Session, project: Project, column: KanbanColumn
):
    """get_board() includes agent_type on cards and default_agent_type on columns."""
    create_card(session, column.id, "Agent type board card", agent_type="bug-fix")
    board = get_board(session, project.id)

    col_data = board["columns"][0]
    assert "default_agent_type" in col_data
    assert col_data["default_agent_type"] == "quick"

    card_data = col_data["cards"][0]
    assert "agent_type" in card_data
    assert card_data["agent_type"] == "bug-fix"
