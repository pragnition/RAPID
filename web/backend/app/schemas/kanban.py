"""Pydantic request/response schemas for kanban endpoints."""

from pydantic import BaseModel, ConfigDict


class KanbanColumnCreate(BaseModel):
    """Request body for creating a kanban column."""

    title: str
    default_agent_type: str = "quick"


class KanbanColumnUpdate(BaseModel):
    """Request body for updating a kanban column."""

    title: str | None = None
    position: int | None = None
    is_autopilot: bool | None = None
    default_agent_type: str | None = None


class KanbanCardCreate(BaseModel):
    """Request body for creating a kanban card."""

    title: str
    description: str = ""
    autopilot_ignore: bool = False
    agent_type: str = "quick"


class KanbanCardUpdate(BaseModel):
    """Request body for updating a kanban card."""

    title: str | None = None
    description: str | None = None
    column_id: str | None = None
    position: int | None = None
    autopilot_ignore: bool | None = None
    agent_type: str | None = None


class KanbanCardMove(BaseModel):
    """Request body for moving a card to a different column/position."""

    column_id: str
    position: int


class KanbanCardMoveWithRev(BaseModel):
    """Request body for moving a card with optional optimistic concurrency rev."""

    column_id: str
    position: int
    rev: int | None = None


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
    rev: int
    created_by: str
    agent_status: str
    locked_by_run_id: str | None = None
    completed_by_run_id: str | None = None
    agent_run_id: str | None = None
    retry_count: int
    autopilot_ignore: bool
    agent_type: str


class KanbanColumnResponse(BaseModel):
    """Response schema for a kanban column with nested cards."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    title: str
    position: int
    created_at: str
    is_autopilot: bool
    default_agent_type: str
    cards: list[KanbanCardResponse]


class KanbanBoardResponse(BaseModel):
    """Response schema for a full kanban board."""

    project_id: str
    columns: list[KanbanColumnResponse]
