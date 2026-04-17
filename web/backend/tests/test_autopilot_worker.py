"""Tests for AutopilotWorker — start/stop, dispatch, and edge cases."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlmodel import Session

from app.agents.autopilot_worker import AutopilotWorker
from app.database import KanbanCard, KanbanColumn, Project
from app.models.agent_run import AgentRun
from app.services import kanban_service


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def project(session: Session) -> Project:
    proj = Project(name="autopilot-test", path=f"/tmp/autopilot-{uuid4().hex[:8]}")
    session.add(proj)
    session.commit()
    session.refresh(proj)
    return proj


@pytest.fixture()
def column(session: Session, project: Project) -> KanbanColumn:
    """Non-autopilot column."""
    col = KanbanColumn(
        project_id=project.id, title="Backlog", position=0, is_autopilot=False
    )
    session.add(col)
    session.commit()
    session.refresh(col)
    return col


@pytest.fixture()
def autopilot_column(session: Session, project: Project) -> KanbanColumn:
    """Autopilot-enabled column."""
    col = KanbanColumn(
        project_id=project.id, title="Auto", position=1, is_autopilot=True
    )
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


@pytest.fixture()
def mock_session_manager():
    """Mock AgentSessionManager with async start_run."""
    manager = MagicMock()
    run = MagicMock()
    run.id = uuid4()
    manager.start_run = AsyncMock(return_value=run)
    return manager


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio(loop_scope="function")
async def test_worker_starts_and_stops(engine, tables):
    """Start worker, verify task is created, stop, verify task is cancelled."""
    manager = MagicMock()
    worker = AutopilotWorker(engine, manager, interval_s=1.0)

    await worker.start()
    assert worker._task is not None
    assert not worker._task.done()

    await worker.stop()
    assert worker._task.done()


@pytest.mark.asyncio(loop_scope="function")
async def test_worker_skips_non_autopilot_columns(
    engine,
    tables,
    session: Session,
    column: KanbanColumn,
    mock_session_manager,
):
    """Column with is_autopilot=False should not dispatch."""
    kanban_service.create_card(session, column.id, "Ignored Card")

    worker = AutopilotWorker(engine, mock_session_manager)
    dispatched = await worker._poll_once()

    assert dispatched == 0
    mock_session_manager.start_run.assert_not_called()


@pytest.mark.asyncio(loop_scope="function")
async def test_worker_dispatches_for_autopilot_column(
    engine,
    tables,
    session: Session,
    autopilot_column: KanbanColumn,
    project: Project,
    agent_run: AgentRun,
):
    """Autopilot column with idle card should dispatch a run."""
    kanban_service.create_card(session, autopilot_column.id, "Dispatchable")

    # Use a real agent_run.id so the FK constraint is satisfied when locking
    manager = MagicMock()
    run_mock = MagicMock()
    run_mock.id = agent_run.id
    manager.start_run = AsyncMock(return_value=run_mock)

    worker = AutopilotWorker(engine, manager)
    dispatched = await worker._poll_once()

    assert dispatched == 1
    manager.start_run.assert_called_once()
    call_args = manager.start_run.call_args
    assert call_args[0][0] == project.id  # project_id


@pytest.mark.asyncio(loop_scope="function")
async def test_worker_skips_locked_cards(
    engine,
    tables,
    session: Session,
    autopilot_column: KanbanColumn,
    agent_run: AgentRun,
    mock_session_manager,
):
    """Already-locked card should not be dispatched."""
    card = kanban_service.create_card(session, autopilot_column.id, "Locked")
    kanban_service.lock_card(session, card.id, agent_run.id)

    worker = AutopilotWorker(engine, mock_session_manager)
    dispatched = await worker._poll_once()

    assert dispatched == 0
    mock_session_manager.start_run.assert_not_called()


@pytest.mark.asyncio(loop_scope="function")
async def test_worker_skips_cards_at_retry_limit(
    engine,
    tables,
    session: Session,
    autopilot_column: KanbanColumn,
    mock_session_manager,
):
    """Card with retry_count >= 3 should be skipped."""
    card = kanban_service.create_card(session, autopilot_column.id, "Retried Out")
    card.retry_count = 3
    session.add(card)
    session.commit()

    worker = AutopilotWorker(engine, mock_session_manager)
    dispatched = await worker._poll_once()

    assert dispatched == 0
    mock_session_manager.start_run.assert_not_called()


@pytest.mark.asyncio(loop_scope="function")
async def test_worker_catches_dispatch_errors(
    engine,
    tables,
    session: Session,
    autopilot_column: KanbanColumn,
    project: Project,
):
    """start_run raising should not crash the worker."""
    kanban_service.create_card(session, autopilot_column.id, "Card A")
    kanban_service.create_card(session, autopilot_column.id, "Card B")

    manager = MagicMock()
    manager.start_run = AsyncMock(side_effect=RuntimeError("boom"))

    worker = AutopilotWorker(engine, manager)
    # Should not raise — errors are caught per card
    dispatched = await worker._poll_once()

    assert dispatched == 0
    # start_run was called for both cards (errors caught, continued)
    assert manager.start_run.call_count == 2


@pytest.mark.asyncio(loop_scope="function")
async def test_find_candidates_skips_ignored_cards(
    engine,
    tables,
    session: Session,
    autopilot_column: KanbanColumn,
    mock_session_manager,
):
    """Cards with autopilot_ignore=True are not returned as candidates."""
    normal_card = KanbanCard(
        column_id=autopilot_column.id,
        title="Normal",
        position=0,
        agent_status="idle",
        autopilot_ignore=False,
    )
    ignored_card = KanbanCard(
        column_id=autopilot_column.id,
        title="Ignored",
        position=1,
        agent_status="idle",
        autopilot_ignore=True,
    )
    session.add_all([normal_card, ignored_card])
    session.commit()

    worker = AutopilotWorker(engine, mock_session_manager, interval_s=999)
    candidates = worker._find_candidates()

    card_ids = [c[1] for c in candidates]
    assert normal_card.id in card_ids
    assert ignored_card.id not in card_ids
