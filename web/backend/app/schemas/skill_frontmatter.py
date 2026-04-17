"""Pydantic v2 models for SKILL.md YAML frontmatter."""

from enum import Enum
from typing import List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SkillArgType(str, Enum):
    """Supported argument types for skill invocation."""

    STRING = "string"
    CHOICE = "choice"
    BOOL = "bool"
    MULTI_LINE = "multi-line"
    SET_REF = "set-ref"


class SkillCategory(str, Enum):
    """Classification of skill interaction model."""

    AUTONOMOUS = "autonomous"
    INTERACTIVE = "interactive"
    HUMAN_IN_LOOP = "human-in-loop"


class SkillArg(BaseModel):
    """A single argument accepted by a skill."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    name: str = Field(min_length=1, max_length=64)
    type: SkillArgType
    description: str = Field(min_length=1, max_length=500)
    required: bool = True
    default: Optional[Union[str, bool]] = None
    choices: Optional[List[str]] = None
    max_length: Optional[int] = Field(default=None, gt=0, le=65536, alias="maxLength")

    @model_validator(mode="after")
    def _choice_needs_choices(self) -> "SkillArg":
        if self.type == SkillArgType.CHOICE:
            if not self.choices:
                raise ValueError("args with type 'choice' must provide a non-empty 'choices' list")
        return self


class SkillFrontmatter(BaseModel):
    """Parsed and validated SKILL.md frontmatter block."""

    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=64)
    description: str = Field(min_length=1, max_length=500)
    allowed_tools: str = Field(default="", alias="allowed-tools")
    args: List[SkillArg] = Field(default_factory=list, max_length=10)
    categories: List[SkillCategory] = Field(min_length=1)

    @field_validator("allowed_tools", mode="before")
    @classmethod
    def _coerce_allowed_tools(cls, v: object) -> str:
        if isinstance(v, list):
            return ",".join(str(i) for i in v)
        return v
