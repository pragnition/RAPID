"""FastAPI router for read-only view endpoints."""

import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session

from app.database import Project
from app.schemas.views import (
    CodebaseTree,
    CodeGraph,
    DagGraph,
    FileContent,
    ProjectState,
    WorktreeRegistry,
)
from app.services.state_service import get_project_state
from app.services.worktree_service import get_worktree_registry
from app.services.dag_service import get_dag_graph
from app.services.codebase_service import get_codebase_tree, get_codebase_graph

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["views"])


def get_db(request: Request):
    """Yield a request-scoped SQLModel session from app.state.engine."""
    engine = request.app.state.engine
    with Session(engine) as session:
        yield session


def _get_project(project_id: UUID, session: Session) -> Project:
    """Look up project by UUID or raise 404."""
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/state", response_model=ProjectState)
def get_state_view(project_id: UUID, session: Session = Depends(get_db)):
    """Return parsed STATE.json for a project."""
    project = _get_project(project_id, session)
    result = get_project_state(Path(project.path))
    if result is None:
        raise HTTPException(status_code=404, detail="STATE.json not found")
    return ProjectState(**result)


@router.get("/{project_id}/worktrees", response_model=WorktreeRegistry)
def get_worktrees_view(project_id: UUID, session: Session = Depends(get_db)):
    """Return worktree registry for a project."""
    project = _get_project(project_id, session)
    result = get_worktree_registry(Path(project.path))
    if result is None:
        raise HTTPException(status_code=404, detail="REGISTRY.json not found")
    return WorktreeRegistry(**result)


@router.get("/{project_id}/dag", response_model=DagGraph)
def get_dag_view(project_id: UUID, session: Session = Depends(get_db)):
    """Return DAG graph for a project."""
    project = _get_project(project_id, session)
    result = get_dag_graph(Path(project.path))
    if result is None:
        raise HTTPException(status_code=404, detail="DAG.json not found")
    return DagGraph(**result)


@router.get("/{project_id}/codebase", response_model=CodebaseTree)
def get_codebase_view(
    project_id: UUID, max_files: int = 500, session: Session = Depends(get_db)
):
    """Return tree-sitter codebase analysis for a project."""
    project = _get_project(project_id, session)
    result = get_codebase_tree(Path(project.path), max_files=max_files)
    return CodebaseTree(**result)


@router.get("/{project_id}/code-graph", response_model=CodeGraph)
def get_code_graph_view(
    project_id: UUID, max_files: int = 500, session: Session = Depends(get_db)
):
    """Return file dependency graph for a project."""
    project = _get_project(project_id, session)
    result = get_codebase_graph(Path(project.path), max_files=max_files)
    return CodeGraph(**result)
