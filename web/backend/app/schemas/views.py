"""Pydantic response schemas for read-only view endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# State View
# ---------------------------------------------------------------------------


class SetState(BaseModel):
    id: str
    status: str
    waves: list[dict]


class MilestoneState(BaseModel):
    id: str
    name: str
    sets: list[SetState]


class ProjectState(BaseModel):
    version: int
    project_name: str
    current_milestone: str | None
    milestones: list[MilestoneState]


# ---------------------------------------------------------------------------
# Worktree View
# ---------------------------------------------------------------------------


class WorktreeInfo(BaseModel):
    set_name: str
    branch: str
    path: str
    phase: str
    status: str
    wave: int | None = None
    created_at: str | None = None
    solo: bool = False
    merge_status: str | None = None
    merged_at: str | None = None
    merge_commit: str | None = None


class WorktreeRegistry(BaseModel):
    version: int
    worktrees: list[WorktreeInfo]


# ---------------------------------------------------------------------------
# DAG View
# ---------------------------------------------------------------------------


class DagNode(BaseModel):
    model_config = {"extra": "ignore"}

    id: str
    wave: int
    status: str


class DagEdge(BaseModel):
    source: str = Field(alias="source")
    target: str = Field(alias="target")

    model_config = {"populate_by_name": True}


class DagWave(BaseModel):
    sets: list[str]
    checkpoint: dict = {}


class DagGraph(BaseModel):
    nodes: list[DagNode]
    edges: list[DagEdge]
    waves: dict[str, DagWave]
    metadata: dict = {}


# ---------------------------------------------------------------------------
# Codebase View
# ---------------------------------------------------------------------------


class CodeSymbol(BaseModel):
    name: str
    kind: str
    start_line: int
    end_line: int
    children: list[CodeSymbol] = []


class CodeFile(BaseModel):
    path: str
    language: str
    symbols: list[CodeSymbol]


class CodebaseTree(BaseModel):
    files: list[CodeFile]
    languages: list[str]
    total_files: int
    parse_errors: list[str] = []


# ---------------------------------------------------------------------------
# Code Graph View
# ---------------------------------------------------------------------------


class GraphNode(BaseModel):
    id: str
    path: str
    language: str
    size: int


class GraphEdge(BaseModel):
    source: str
    target: str


class CodeGraph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    total_files: int
    total_edges: int
    scanned_files: int
    truncated: bool
    parse_errors: list[str] = []
    unresolved_imports: list[str] = []


# ---------------------------------------------------------------------------
# File Content View
# ---------------------------------------------------------------------------


class FileContent(BaseModel):
    path: str
    content: str
    language: str | None = None
    size: int
