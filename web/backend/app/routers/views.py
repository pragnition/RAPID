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


@router.get("/{project_id}/file", response_model=FileContent)
def get_file_content_view(
    project_id: UUID,
    path: str,
    session: Session = Depends(get_db),
):
    """Return file content with path traversal protection."""
    project = _get_project(project_id, session)
    project_path = Path(project.path)

    # Reject paths containing '..'
    if ".." in path.split("/") or ".." in path.split("\\"):
        raise HTTPException(status_code=400, detail="Invalid path: contains '..'")

    # Construct absolute path
    abs_path = (project_path / path).resolve()

    # Validate resolved path is within project
    if not abs_path.is_relative_to(project_path.resolve()):
        raise HTTPException(status_code=403, detail="Path traversal denied")

    # Reject symlinks
    if abs_path.is_symlink() or (project_path / path).is_symlink():
        raise HTTPException(status_code=403, detail="Symlinks not allowed")

    # Check existence
    if not abs_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # Check size (1MB limit)
    file_size = abs_path.stat().st_size
    if file_size > 1_048_576:
        raise HTTPException(status_code=400, detail="File too large (>1MB)")

    # Read and check for binary content (null bytes in first 8KB)
    try:
        raw = abs_path.read_bytes()
    except OSError:
        raise HTTPException(status_code=500, detail="Cannot read file")

    if b"\x00" in raw[:8192]:
        raise HTTPException(status_code=400, detail="Binary file not supported")

    content = raw.decode("utf-8", errors="replace")

    # Determine language
    from app.services.codebase_service import _EXT_TO_LANG

    ext = abs_path.suffix
    language = _EXT_TO_LANG.get(ext)

    return FileContent(
        path=path,
        content=content,
        language=language,
        size=file_size,
    )
