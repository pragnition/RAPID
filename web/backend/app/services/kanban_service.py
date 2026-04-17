"""Kanban service layer — CRUD with position reordering and disk sync."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import update
from sqlmodel import Session, select, func

from app.database import KanbanColumn, KanbanCard, Project
from app.sync_engine import SyncEngine

logger = logging.getLogger(__name__)

_DEFAULT_COLUMNS = ["Backlog", "In Progress", "Done"]


class StaleRevisionError(ValueError):
    """Raised when an update targets a stale rev."""

    def __init__(self, card_id, expected_rev, actual_rev):
        self.card_id = card_id
        self.expected_rev = expected_rev
        self.actual_rev = actual_rev
        super().__init__(
            f"Card {card_id}: expected rev {expected_rev}, found {actual_rev}"
        )


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_project_path(session: Session, project_id: UUID) -> Path:
    """Resolve project filesystem path from project_id."""
    project = session.get(Project, project_id)
    if project is None:
        raise ValueError(f"Project {project_id} not found")
    return Path(project.path)


def _sync_board(session: Session, project_id: UUID) -> None:
    """Write the full kanban board state to .rapid-web/kanban/board.json."""
    try:
        project_path = _get_project_path(session, project_id)
        board = get_board(session, project_id)
        sync = SyncEngine(project_path, session)
        sync.sync_to_disk("kanban_column", "board", board)
    except Exception:
        logger.warning("Failed to sync kanban board for project %s", project_id, exc_info=True)


def get_board(session: Session, project_id: UUID) -> dict:
    """Load the full kanban board: all columns with nested cards, ordered by position."""
    columns_stmt = (
        select(KanbanColumn)
        .where(KanbanColumn.project_id == project_id)
        .order_by(KanbanColumn.position)
    )
    columns = list(session.exec(columns_stmt).all())

    result_columns = []
    for col in columns:
        cards_stmt = (
            select(KanbanCard)
            .where(KanbanCard.column_id == col.id)
            .order_by(KanbanCard.position)
        )
        cards = list(session.exec(cards_stmt).all())

        result_columns.append({
            "id": str(col.id),
            "project_id": str(col.project_id),
            "title": col.title,
            "position": col.position,
            "created_at": col.created_at.isoformat(),
            "is_autopilot": col.is_autopilot,
            "default_agent_type": col.default_agent_type,
            "cards": [
                {
                    "id": str(card.id),
                    "column_id": str(card.column_id),
                    "title": card.title,
                    "description": card.description,
                    "position": card.position,
                    "created_at": card.created_at.isoformat(),
                    "updated_at": card.updated_at.isoformat(),
                    "rev": card.rev,
                    "created_by": card.created_by,
                    "agent_status": card.agent_status,
                    "locked_by_run_id": str(card.locked_by_run_id) if card.locked_by_run_id else None,
                    "completed_by_run_id": str(card.completed_by_run_id) if card.completed_by_run_id else None,
                    "agent_run_id": str(card.agent_run_id) if card.agent_run_id else None,
                    "retry_count": card.retry_count,
                    "autopilot_ignore": card.autopilot_ignore,
                    "agent_type": card.agent_type,
                }
                for card in cards
            ],
        })

    return {
        "project_id": str(project_id),
        "columns": result_columns,
    }


def create_column(session: Session, project_id: UUID, title: str, default_agent_type: str = "quick") -> KanbanColumn:
    """Create a new column. On first creation, seed default columns instead."""
    existing_count = session.exec(
        select(func.count(KanbanColumn.id)).where(KanbanColumn.project_id == project_id)
    ).one()

    if existing_count == 0:
        # Seed default columns
        columns = []
        for i, col_title in enumerate(_DEFAULT_COLUMNS):
            col = KanbanColumn(
                project_id=project_id,
                title=col_title,
                position=i,
            )
            session.add(col)
            columns.append(col)
        session.commit()
        for col in columns:
            session.refresh(col)
        _sync_board(session, project_id)
        # Return the column matching the requested title, or the first one
        for col in columns:
            if col.title == title:
                return col
        return columns[0]

    # Normal creation: append at the end
    max_pos = session.exec(
        select(func.max(KanbanColumn.position)).where(KanbanColumn.project_id == project_id)
    ).one()
    new_position = (max_pos or 0) + 1

    column = KanbanColumn(
        project_id=project_id,
        title=title,
        position=new_position,
        default_agent_type=default_agent_type,
    )
    session.add(column)
    session.commit()
    session.refresh(column)
    _sync_board(session, project_id)
    return column


def update_column(
    session: Session, column_id: UUID, title: str | None = None, position: int | None = None,
    default_agent_type: str | None = None,
) -> KanbanColumn:
    """Update column title and/or reorder position."""
    column = session.get(KanbanColumn, column_id)
    if column is None:
        raise ValueError(f"Column {column_id} not found")

    if title is not None:
        column.title = title

    if default_agent_type is not None:
        column.default_agent_type = default_agent_type

    if position is not None and position != column.position:
        old_pos = column.position
        new_pos = position

        # Shift other columns to make room
        if new_pos < old_pos:
            # Moving left: shift columns in [new_pos, old_pos) right by 1
            cols_to_shift = session.exec(
                select(KanbanColumn)
                .where(KanbanColumn.project_id == column.project_id)
                .where(KanbanColumn.position >= new_pos)
                .where(KanbanColumn.position < old_pos)
                .where(KanbanColumn.id != column_id)
            ).all()
            for c in cols_to_shift:
                c.position += 1
                session.add(c)
        else:
            # Moving right: shift columns in (old_pos, new_pos] left by 1
            cols_to_shift = session.exec(
                select(KanbanColumn)
                .where(KanbanColumn.project_id == column.project_id)
                .where(KanbanColumn.position > old_pos)
                .where(KanbanColumn.position <= new_pos)
                .where(KanbanColumn.id != column_id)
            ).all()
            for c in cols_to_shift:
                c.position -= 1
                session.add(c)

        column.position = new_pos

    session.add(column)
    session.commit()
    session.refresh(column)
    _sync_board(session, column.project_id)
    return column


def delete_column(session: Session, column_id: UUID) -> None:
    """Delete a column and all its cards. Reorder remaining columns."""
    column = session.get(KanbanColumn, column_id)
    if column is None:
        raise ValueError(f"Column {column_id} not found")

    project_id = column.project_id
    deleted_pos = column.position

    # Delete all cards in this column
    cards = session.exec(
        select(KanbanCard).where(KanbanCard.column_id == column_id)
    ).all()
    for card in cards:
        session.delete(card)

    session.delete(column)

    # Shift remaining columns down to fill the gap
    remaining = session.exec(
        select(KanbanColumn)
        .where(KanbanColumn.project_id == project_id)
        .where(KanbanColumn.position > deleted_pos)
    ).all()
    for col in remaining:
        col.position -= 1
        session.add(col)

    session.commit()
    _sync_board(session, project_id)


def create_card(
    session: Session,
    column_id: UUID,
    title: str,
    description: str = "",
    created_by: str = "human",
    autopilot_ignore: bool = False,
    agent_type: str = "quick",
) -> KanbanCard:
    """Create a card at the bottom of the specified column."""
    # Verify column exists
    column = session.get(KanbanColumn, column_id)
    if column is None:
        raise ValueError(f"Column {column_id} not found")

    max_pos = session.exec(
        select(func.max(KanbanCard.position)).where(KanbanCard.column_id == column_id)
    ).one()
    new_position = (max_pos or -1) + 1

    card = KanbanCard(
        column_id=column_id,
        title=title,
        description=description,
        position=new_position,
        created_by=created_by,
        autopilot_ignore=autopilot_ignore,
        agent_type=agent_type,
    )
    session.add(card)
    session.commit()
    session.refresh(card)
    _sync_board(session, column.project_id)
    return card


def update_card(
    session: Session,
    card_id: UUID,
    title: str | None = None,
    description: str | None = None,
    rev: int | None = None,
    autopilot_ignore: bool | None = None,
    agent_type: str | None = None,
) -> KanbanCard:
    """Update card title and/or description.

    When *rev* is provided, optimistic concurrency control is enforced:
    the card's current rev must match, otherwise ``StaleRevisionError`` is raised.
    On success the rev is bumped by 1.
    """
    card = session.get(KanbanCard, card_id)
    if card is None:
        raise ValueError(f"Card {card_id} not found")

    if rev is not None:
        if card.rev != rev:
            raise StaleRevisionError(card_id, rev, card.rev)
        card.rev += 1

    if title is not None:
        card.title = title
    if description is not None:
        card.description = description
    if autopilot_ignore is not None:
        card.autopilot_ignore = autopilot_ignore
    if agent_type is not None:
        card.agent_type = agent_type

    card.updated_at = _utcnow()
    session.add(card)
    session.commit()
    session.refresh(card)

    # Get project_id via column
    column = session.get(KanbanColumn, card.column_id)
    if column:
        _sync_board(session, column.project_id)
    return card


def move_card(
    session: Session,
    card_id: UUID,
    target_column_id: UUID,
    target_position: int,
    rev: int | None = None,
) -> KanbanCard:
    """Move a card to a target column and position, updating positions in both columns.

    When *rev* is provided, optimistic concurrency control is enforced.
    """
    card = session.get(KanbanCard, card_id)
    if card is None:
        raise ValueError(f"Card {card_id} not found")

    if rev is not None:
        if card.rev != rev:
            raise StaleRevisionError(card_id, rev, card.rev)

    target_column = session.get(KanbanColumn, target_column_id)
    if target_column is None:
        raise ValueError(f"Target column {target_column_id} not found")

    source_column_id = card.column_id
    source_position = card.position

    # Remove gap in source column
    if source_column_id == target_column_id:
        # Same column move
        if target_position == source_position:
            return card

        if target_position < source_position:
            cards_to_shift = session.exec(
                select(KanbanCard)
                .where(KanbanCard.column_id == source_column_id)
                .where(KanbanCard.position >= target_position)
                .where(KanbanCard.position < source_position)
                .where(KanbanCard.id != card_id)
            ).all()
            for c in cards_to_shift:
                c.position += 1
                session.add(c)
        else:
            cards_to_shift = session.exec(
                select(KanbanCard)
                .where(KanbanCard.column_id == source_column_id)
                .where(KanbanCard.position > source_position)
                .where(KanbanCard.position <= target_position)
                .where(KanbanCard.id != card_id)
            ).all()
            for c in cards_to_shift:
                c.position -= 1
                session.add(c)
    else:
        # Cross-column move: close gap in source, make room in target
        source_cards = session.exec(
            select(KanbanCard)
            .where(KanbanCard.column_id == source_column_id)
            .where(KanbanCard.position > source_position)
        ).all()
        for c in source_cards:
            c.position -= 1
            session.add(c)

        target_cards = session.exec(
            select(KanbanCard)
            .where(KanbanCard.column_id == target_column_id)
            .where(KanbanCard.position >= target_position)
        ).all()
        for c in target_cards:
            c.position += 1
            session.add(c)

    card.column_id = target_column_id
    card.position = target_position
    card.updated_at = _utcnow()
    if rev is not None:
        card.rev += 1
    session.add(card)
    session.commit()
    session.refresh(card)

    _sync_board(session, target_column.project_id)
    return card


def delete_card(session: Session, card_id: UUID) -> None:
    """Delete a card and reorder remaining cards in the column."""
    card = session.get(KanbanCard, card_id)
    if card is None:
        raise ValueError(f"Card {card_id} not found")

    column_id = card.column_id
    deleted_pos = card.position

    # Get project_id before deletion
    column = session.get(KanbanColumn, column_id)
    project_id = column.project_id if column else None

    session.delete(card)

    # Reorder remaining cards
    remaining = session.exec(
        select(KanbanCard)
        .where(KanbanCard.column_id == column_id)
        .where(KanbanCard.position > deleted_pos)
    ).all()
    for c in remaining:
        c.position -= 1
        session.add(c)

    session.commit()

    if project_id:
        _sync_board(session, project_id)


# ---------------------------------------------------------------------------
# Agent-aware operations
# ---------------------------------------------------------------------------


def lock_card(session: Session, card_id: UUID, run_id: UUID) -> bool:
    """Atomically lock a card for an agent run.

    Uses a raw UPDATE ... WHERE locked_by_run_id IS NULL for atomicity.
    Returns True if the lock was acquired, False if already locked.
    """
    result = session.execute(
        update(KanbanCard)
        .where(KanbanCard.id == card_id)
        .where(KanbanCard.locked_by_run_id.is_(None))  # type: ignore[union-attr]
        .values(
            locked_by_run_id=run_id,
            agent_status="claimed",
            updated_at=_utcnow(),
        )
    )
    session.commit()

    if result.rowcount > 0:  # type: ignore[union-attr]
        # Sync board after successful lock
        card = session.get(KanbanCard, card_id)
        if card:
            column = session.get(KanbanColumn, card.column_id)
            if column:
                _sync_board(session, column.project_id)
        return True
    return False


def unlock_card(session: Session, card_id: UUID, run_id: UUID) -> None:
    """Atomically unlock a card, verifying the caller holds the lock.

    Only clears the lock if ``locked_by_run_id == run_id``.  Bumps ``rev``
    and resets ``agent_status`` to ``idle``.
    """
    result = session.execute(
        update(KanbanCard)
        .where(KanbanCard.id == card_id)
        .where(KanbanCard.locked_by_run_id == run_id)
        .values(
            locked_by_run_id=None,
            agent_status="idle",
            rev=KanbanCard.rev + 1,
            updated_at=_utcnow(),
        )
    )
    session.commit()

    if result.rowcount > 0:  # type: ignore[union-attr]
        card = session.get(KanbanCard, card_id)
        if card:
            column = session.get(KanbanColumn, card.column_id)
            if column:
                _sync_board(session, column.project_id)


def set_card_agent_status(
    session: Session, card_id: UUID, status: str, run_id: UUID
) -> KanbanCard:
    """Change a card's agent_status and bump rev.

    If the card is locked, verifies ``locked_by_run_id == run_id``.
    """
    card = session.get(KanbanCard, card_id)
    if card is None:
        raise ValueError(f"Card {card_id} not found")

    if card.locked_by_run_id is not None and card.locked_by_run_id != run_id:
        raise ValueError(
            f"Card {card_id} is locked by run {card.locked_by_run_id}, "
            f"not {run_id}"
        )

    card.agent_status = status
    card.rev += 1
    card.updated_at = _utcnow()
    session.add(card)
    session.commit()
    session.refresh(card)

    column = session.get(KanbanColumn, card.column_id)
    if column:
        _sync_board(session, column.project_id)
    return card


def update_column_autopilot(
    session: Session, column_id: UUID, is_autopilot: bool
) -> KanbanColumn:
    """Toggle the autopilot flag on a column."""
    column = session.get(KanbanColumn, column_id)
    if column is None:
        raise ValueError(f"Column {column_id} not found")

    column.is_autopilot = is_autopilot
    session.add(column)
    session.commit()
    session.refresh(column)
    _sync_board(session, column.project_id)
    return column
