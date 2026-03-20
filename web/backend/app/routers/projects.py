"""FastAPI router for project CRUD endpoints."""

import json
import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlmodel import Session

from app.database import Project
from app.schemas.project import (
    ProjectCreate,
    ProjectDetail,
    ProjectListResponse,
    ProjectStatusResponse,
    ProjectSummary,
)
from app.services import project_service
from app.sync_engine import SyncEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def get_db(request: Request):
    """Yield a request-scoped SQLModel session from app.state.engine."""
    engine = request.app.state.engine
    with Session(engine) as session:
        yield session


def _project_to_summary(project: Project) -> ProjectSummary:
    """Parse project.metadata_json to extract current_milestone and set_count."""
    current_milestone = None
    set_count = 0
    try:
        meta = json.loads(project.metadata_json or "{}")
        current_milestone = meta.get("current_milestone")
        set_count = meta.get("total_sets", 0)
    except (json.JSONDecodeError, TypeError):
        pass

    return ProjectSummary(
        id=project.id,
        name=project.name,
        path=project.path,
        status=project.status,
        current_milestone=current_milestone,
        set_count=set_count,
        registered_at=project.registered_at,
        last_seen_at=project.last_seen_at,
    )


@router.post("", status_code=201, response_model=ProjectStatusResponse)
def register_project(body: ProjectCreate, session: Session = Depends(get_db)):
    """Register a project by its filesystem path."""
    try:
        project = project_service.register_project(session, body.path, body.name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Sync to disk
    try:
        sync = SyncEngine(Path(project.path), session)
        sync.sync_to_disk("project", str(project.id), project.model_dump(mode="json"))
        sync.update_sync_state(str(project.id))
    except Exception:
        logger.warning("SyncEngine write failed for project %s", project.id, exc_info=True)

    return ProjectStatusResponse(
        id=project.id, status=project.status, message="registered"
    )


@router.get("", response_model=ProjectListResponse)
def list_projects(
    page: int = 1, per_page: int = 20, session: Session = Depends(get_db)
):
    """List projects with pagination."""
    items, total = project_service.list_projects(session, page, per_page)
    summaries = [_project_to_summary(p) for p in items]
    return ProjectListResponse(
        items=summaries, total=total, page=page, per_page=per_page
    )


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project_detail(project_id: UUID, session: Session = Depends(get_db)):
    """Get detailed project info with milestones parsed from disk."""
    detail = project_service.get_project_detail(session, project_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectDetail(**detail)


@router.delete("/{project_id}", response_model=ProjectStatusResponse)
def deregister_project(project_id: UUID, session: Session = Depends(get_db)):
    """Deregister (delete) a project."""
    project = project_service.get_project(session, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    project_path = project.path
    project_id_str = str(project.id)

    project_service.deregister_project(session, project_id)

    # Delete from disk
    try:
        sync = SyncEngine(Path(project_path), session)
        sync.delete_from_disk("project", project_id_str)
    except Exception:
        logger.warning("SyncEngine delete failed for project %s", project_id_str, exc_info=True)

    return ProjectStatusResponse(
        id=project_id, status="deregistered", message="deregistered"
    )
