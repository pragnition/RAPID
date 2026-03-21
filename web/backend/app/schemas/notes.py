"""Pydantic request/response schemas for notes endpoints."""

from pydantic import BaseModel, ConfigDict


class NoteCreate(BaseModel):
    """Request body for creating a note."""

    title: str
    content: str = ""


class NoteUpdate(BaseModel):
    """Request body for updating a note."""

    title: str | None = None
    content: str | None = None


class NoteResponse(BaseModel):
    """Response schema for a single note."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    title: str
    content: str
    created_at: str
    updated_at: str


class NoteListResponse(BaseModel):
    """Response schema for a list of notes."""

    items: list[NoteResponse]
    total: int
