"""Kanban service layer — CRUD with position reordering and disk sync."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlmodel import Session, select, func

from app.database import KanbanColumn, KanbanCard, Project
from app.sync_engine import SyncEngine

logger = logging.getLogger(__name__)

_DEFAULT_COLUMNS = ["Backlog", "In Progress", "Done"]


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
            "cards": [
                {
                    "id": str(card.id),
                    "column_id": str(card.column_id),
                    "title": card.title,
                    "description": card.description,
                    "position": card.position,
                    "created_at": card.created_at.isoformat(),
                    "updated_at": card.updated_at.isoformat(),
                }
                for card in cards
            ],
        })

    return {
        "project_id": str(project_id),
        "columns": result_columns,
    }


def create_column(session: Session, project_id: UUID, title: str) -> KanbanColumn:
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
    )
    session.add(column)
    session.commit()
    session.refresh(column)
    _sync_board(session, project_id)
    return column


def update_column(
    session: Session, column_id: UUID, title: str | None = None, position: int | None = None
) -> KanbanColumn:
    """Update column title and/or reorder position."""
    column = session.get(KanbanColumn, column_id)
    if column is None:
        raise ValueError(f"Column {column_id} not found")

    if title is not None:
        column.title = title

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
    session: Session, column_id: UUID, title: str, description: str = ""
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
) -> KanbanCard:
    """Update card title and/or description."""
    card = session.get(KanbanCard, card_id)
    if card is None:
        raise ValueError(f"Card {card_id} not found")

    if title is not None:
        card.title = title
    if description is not None:
        card.description = description

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
    session: Session, card_id: UUID, target_column_id: UUID, target_position: int
) -> KanbanCard:
    """Move a card to a target column and position, updating positions in both columns."""
    card = session.get(KanbanCard, card_id)
    if card is None:
        raise ValueError(f"Card {card_id} not found")

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
