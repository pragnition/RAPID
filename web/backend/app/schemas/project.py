"""Pydantic request/response schemas for project endpoints."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class ProjectCreate(BaseModel):
    """Request body for POST /api/projects."""

    path: str
    name: str | None = None

    @field_validator("path")
    @classmethod
    def path_must_be_absolute(cls, v: str) -> str:
        if not v.startswith("/"):
            raise ValueError("path must be an absolute path (starts with '/')")
        return v


class ProjectSummary(BaseModel):
    """Response item for project list endpoint."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    path: str
    status: str
    current_milestone: str | None = None
    set_count: int = 0
    registered_at: datetime
    last_seen_at: datetime | None = None


class ProjectDetail(ProjectSummary):
    """Response for single project detail endpoint."""

    milestones: list[dict] = []
    metadata_json: str = "{}"


class ProjectListResponse(BaseModel):
    """Paginated list response."""

    items: list[ProjectSummary]
    total: int
    page: int
    per_page: int


class ProjectStatusResponse(BaseModel):
    """Simple status response for POST/DELETE operations."""

    id: UUID
    status: str
    message: str | None = None
