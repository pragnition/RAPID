"""Pydantic v2 response/request models for the skills API."""

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class SkillArgOut(BaseModel):
    """Public representation of a single skill argument."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    name: str
    type: str
    description: str
    required: bool = True
    default: Optional[str | bool] = None
    choices: Optional[list[str]] = None
    max_length: Optional[int] = Field(default=None, alias="maxLength")


class SkillMetaOut(BaseModel):
    """Public representation of a skill's metadata."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    name: str
    description: str
    args: list[SkillArgOut]
    categories: list[str]
    allowed_tools: str = Field(alias="allowedTools")
    source_path: str = Field(alias="sourcePath")


class PreconditionBlocker(BaseModel):
    """A single reason why a skill cannot be launched."""

    code: str
    message: str
    arg: Optional[str] = None


class PreconditionCheckRequest(BaseModel):
    """Request body for POST /api/skills/{name}/check-preconditions."""

    model_config = ConfigDict(populate_by_name=True)

    project_id: str = Field(alias="projectId")
    skill_args: dict[str, Any] = Field(default_factory=dict, alias="skillArgs")
    set_id: Optional[str] = Field(default=None, alias="setId")


class PreconditionCheckResponse(BaseModel):
    """Response for the precondition check endpoint."""

    ok: bool
    blockers: list[PreconditionBlocker]
