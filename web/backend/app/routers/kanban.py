"""FastAPI router for kanban board CRUD endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel import Session

from app.schemas.kanban import (
    KanbanBoardResponse,
    KanbanCardCreate,
    KanbanCardMoveWithRev,
    KanbanCardResponse,
    KanbanCardUpdate,
    KanbanColumnCreate,
    KanbanColumnResponse,
    KanbanColumnUpdate,
)
from app.services import kanban_service
from app.services.kanban_service import StaleRevisionError
from app.services.project_service import get_project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["kanban"])


def get_db(request: Request):
    """Yield a request-scoped SQLModel session from app.state.engine."""
    engine = request.app.state.engine
    with Session(engine) as session:
        yield session


def _require_project(session: Session, project_id: UUID) -> None:
    """Raise 404 if project does not exist."""
    project = get_project(session, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")


# ---------------------------------------------------------------------------
# Board
# ---------------------------------------------------------------------------


@router.get("/{project_id}/kanban", response_model=KanbanBoardResponse)
def get_board(project_id: UUID, session: Session = Depends(get_db)):
    """Return the full kanban board with columns and cards."""
    _require_project(session, project_id)
    board = kanban_service.get_board(session, project_id)
    return KanbanBoardResponse(**board)


# ---------------------------------------------------------------------------
# Columns
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/kanban/columns",
    response_model=KanbanColumnResponse,
    status_code=201,
)
def create_column(
    project_id: UUID, body: KanbanColumnCreate, session: Session = Depends(get_db)
):
    """Create a new kanban column."""
    _require_project(session, project_id)
    column = kanban_service.create_column(session, project_id, body.title)
    # Build response with empty cards list
    return KanbanColumnResponse(
        id=str(column.id),
        project_id=str(column.project_id),
        title=column.title,
        position=column.position,
        created_at=column.created_at.isoformat(),
        is_autopilot=column.is_autopilot,
        cards=[],
    )


@router.put(
    "/{project_id}/kanban/columns/{column_id}",
    response_model=KanbanColumnResponse,
)
def update_column(
    project_id: UUID,
    column_id: UUID,
    body: KanbanColumnUpdate,
    session: Session = Depends(get_db),
):
    """Update a kanban column's title or position."""
    _require_project(session, project_id)
    try:
        column = kanban_service.update_column(
            session, column_id, title=body.title, position=body.position
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Column not found")

    # Handle autopilot toggle if provided
    if body.is_autopilot is not None:
        column = kanban_service.update_column_autopilot(
            session, column_id, body.is_autopilot
        )

    # Load cards for response
    from sqlmodel import select
    from app.database import KanbanCard

    cards_stmt = (
        select(KanbanCard)
        .where(KanbanCard.column_id == column.id)
        .order_by(KanbanCard.position)
    )
    cards = list(session.exec(cards_stmt).all())

    return KanbanColumnResponse(
        id=str(column.id),
        project_id=str(column.project_id),
        title=column.title,
        position=column.position,
        created_at=column.created_at.isoformat(),
        is_autopilot=column.is_autopilot,
        cards=[
            KanbanCardResponse(
                id=str(c.id),
                column_id=str(c.column_id),
                title=c.title,
                description=c.description,
                position=c.position,
                created_at=c.created_at.isoformat(),
                updated_at=c.updated_at.isoformat(),
                rev=c.rev,
                created_by=c.created_by,
                agent_status=c.agent_status,
                locked_by_run_id=str(c.locked_by_run_id) if c.locked_by_run_id else None,
                completed_by_run_id=str(c.completed_by_run_id) if c.completed_by_run_id else None,
                agent_run_id=str(c.agent_run_id) if c.agent_run_id else None,
                retry_count=c.retry_count,
            )
            for c in cards
        ],
    )


@router.put("/{project_id}/kanban/columns/{column_id}/autopilot")
def toggle_column_autopilot(
    project_id: UUID,
    column_id: UUID,
    body: dict,
    session: Session = Depends(get_db),
):
    """Toggle autopilot mode on a kanban column."""
    _require_project(session, project_id)
    is_autopilot = body.get("is_autopilot", False)
    try:
        column = kanban_service.update_column_autopilot(
            session, column_id, bool(is_autopilot)
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Column not found")

    return {"id": str(column.id), "is_autopilot": column.is_autopilot}


@router.delete("/{project_id}/kanban/columns/{column_id}", status_code=204)
def delete_column(
    project_id: UUID, column_id: UUID, session: Session = Depends(get_db)
):
    """Delete a kanban column and all its cards."""
    _require_project(session, project_id)
    try:
        kanban_service.delete_column(session, column_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Column not found")
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Cards
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/kanban/columns/{column_id}/cards",
    response_model=KanbanCardResponse,
    status_code=201,
)
def create_card(
    project_id: UUID,
    column_id: UUID,
    body: KanbanCardCreate,
    session: Session = Depends(get_db),
):
    """Create a new kanban card in a column."""
    _require_project(session, project_id)
    try:
        card = kanban_service.create_card(
            session, column_id, body.title, body.description
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Column not found")

    return KanbanCardResponse(
        id=str(card.id),
        column_id=str(card.column_id),
        title=card.title,
        description=card.description,
        position=card.position,
        created_at=card.created_at.isoformat(),
        updated_at=card.updated_at.isoformat(),
        rev=card.rev,
        created_by=card.created_by,
        agent_status=card.agent_status,
        locked_by_run_id=str(card.locked_by_run_id) if card.locked_by_run_id else None,
        completed_by_run_id=str(card.completed_by_run_id) if card.completed_by_run_id else None,
        agent_run_id=str(card.agent_run_id) if card.agent_run_id else None,
        retry_count=card.retry_count,
    )


@router.put(
    "/{project_id}/kanban/cards/{card_id}",
    response_model=KanbanCardResponse,
)
def update_card(
    project_id: UUID,
    card_id: UUID,
    body: KanbanCardUpdate,
    session: Session = Depends(get_db),
):
    """Update a kanban card's title or description."""
    _require_project(session, project_id)
    try:
        card = kanban_service.update_card(
            session, card_id, title=body.title, description=body.description
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Card not found")

    return KanbanCardResponse(
        id=str(card.id),
        column_id=str(card.column_id),
        title=card.title,
        description=card.description,
        position=card.position,
        created_at=card.created_at.isoformat(),
        updated_at=card.updated_at.isoformat(),
        rev=card.rev,
        created_by=card.created_by,
        agent_status=card.agent_status,
        locked_by_run_id=str(card.locked_by_run_id) if card.locked_by_run_id else None,
        completed_by_run_id=str(card.completed_by_run_id) if card.completed_by_run_id else None,
        agent_run_id=str(card.agent_run_id) if card.agent_run_id else None,
        retry_count=card.retry_count,
    )


@router.put(
    "/{project_id}/kanban/cards/{card_id}/move",
    response_model=KanbanCardResponse,
)
def move_card(
    project_id: UUID,
    card_id: UUID,
    body: KanbanCardMoveWithRev,
    session: Session = Depends(get_db),
):
    """Move a card to a different column and/or position."""
    _require_project(session, project_id)
    try:
        card = kanban_service.move_card(
            session, card_id, UUID(body.column_id), body.position, rev=body.rev
        )
    except StaleRevisionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return KanbanCardResponse(
        id=str(card.id),
        column_id=str(card.column_id),
        title=card.title,
        description=card.description,
        position=card.position,
        created_at=card.created_at.isoformat(),
        updated_at=card.updated_at.isoformat(),
        rev=card.rev,
        created_by=card.created_by,
        agent_status=card.agent_status,
        locked_by_run_id=str(card.locked_by_run_id) if card.locked_by_run_id else None,
        completed_by_run_id=str(card.completed_by_run_id) if card.completed_by_run_id else None,
        agent_run_id=str(card.agent_run_id) if card.agent_run_id else None,
        retry_count=card.retry_count,
    )


@router.delete("/{project_id}/kanban/cards/{card_id}", status_code=204)
def delete_card(
    project_id: UUID, card_id: UUID, session: Session = Depends(get_db)
):
    """Delete a kanban card."""
    _require_project(session, project_id)
    try:
        kanban_service.delete_card(session, card_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Card not found")
    return Response(status_code=204)
