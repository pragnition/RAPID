"""Pydantic request/response schemas for kanban endpoints."""

from pydantic import BaseModel, ConfigDict


class KanbanColumnCreate(BaseModel):
    """Request body for creating a kanban column."""

    title: str


class KanbanColumnUpdate(BaseModel):
    """Request body for updating a kanban column."""

    title: str | None = None
    position: int | None = None


class KanbanCardCreate(BaseModel):
    """Request body for creating a kanban card."""

    title: str
    description: str = ""


class KanbanCardUpdate(BaseModel):
    """Request body for updating a kanban card."""

    title: str | None = None
    description: str | None = None
    column_id: str | None = None
    position: int | None = None


class KanbanCardMove(BaseModel):
    """Request body for moving a card to a different column/position."""

    column_id: str
    position: int


class KanbanCardResponse(BaseModel):
    """Response schema for a single kanban card."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    column_id: str
    title: str
    description: str
    position: int
    created_at: str
    updated_at: str


class KanbanColumnResponse(BaseModel):
    """Response schema for a kanban column with nested cards."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    title: str
    position: int
    created_at: str
    cards: list[KanbanCardResponse]


class KanbanBoardResponse(BaseModel):
    """Response schema for a full kanban board."""

    project_id: str
    columns: list[KanbanColumnResponse]
