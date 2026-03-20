"""Project service layer — core business logic for project registration and management."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlmodel import Session, select, func

from app.database import Project

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_state_json(project_path: Path) -> dict | None:
    """Read and parse .planning/STATE.json from a project path.

    Returns a summary dict or None if the file is missing or malformed.
    """
    state_file = project_path / ".planning" / "STATE.json"
    try:
        raw = state_file.read_text(encoding="utf-8")
        data = json.loads(raw)
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return None

    project_name = data.get("projectName", project_path.name)
    milestones = data.get("milestones", [])

    current_milestone = None
    milestone_name = None
    total_sets = 0
    active_sets = 0

    for ms in milestones:
        sets = ms.get("sets", [])
        total_sets += len(sets)
        ms_active = sum(1 for s in sets if s.get("status") == "active")
        active_sets += ms_active
        # The first milestone with active sets is the current one
        if ms_active > 0 and current_milestone is None:
            current_milestone = ms.get("id")
            milestone_name = ms.get("name")

    return {
        "project_name": project_name,
        "current_milestone": current_milestone,
        "milestone_name": milestone_name,
        "total_sets": total_sets,
        "active_sets": active_sets,
    }


def register_project(session: Session, path: str, name: str | None = None) -> Project:
    """Register a project by its filesystem path.

    Validates that .planning/STATE.json exists, parses metadata,
    and creates or updates the project record.

    Raises ValueError if STATE.json is not found.
    """
    project_path = Path(path)
    state_file = project_path / ".planning" / "STATE.json"
    if not state_file.exists():
        raise ValueError(f"No .planning/STATE.json found at {path}")

    parsed = parse_state_json(project_path)

    # Determine project name: user override > STATE.json > directory basename
    if name is not None:
        resolved_name = name
    elif parsed and parsed.get("project_name"):
        resolved_name = parsed["project_name"]
    else:
        resolved_name = project_path.name

    metadata = json.dumps(parsed) if parsed else "{}"

    # Check for existing project with this path (idempotent registration)
    statement = select(Project).where(Project.path == path)
    existing = session.exec(statement).first()

    if existing is not None:
        existing.metadata_json = metadata
        existing.last_seen_at = _utcnow()
        existing.name = resolved_name
        existing.status = "active"
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    project = Project(
        name=resolved_name,
        path=path,
        status="active",
        metadata_json=metadata,
        last_seen_at=_utcnow(),
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def list_projects(
    session: Session, page: int = 1, per_page: int = 20
) -> tuple[list[Project], int]:
    """Return a paginated list of projects ordered by registered_at descending."""
    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 1
    if per_page > 100:
        per_page = 100

    total = session.exec(select(func.count(Project.id))).one()
    offset = (page - 1) * per_page
    statement = (
        select(Project)
        .order_by(Project.registered_at.desc())  # type: ignore[union-attr]
        .offset(offset)
        .limit(per_page)
    )
    items = list(session.exec(statement).all())
    return items, total


def get_project(session: Session, project_id: UUID) -> Project | None:
    """Return a single project by UUID or None."""
    return session.get(Project, project_id)


def get_project_detail(session: Session, project_id: UUID) -> dict | None:
    """Return project with fresh STATE.json data parsed from disk."""
    project = session.get(Project, project_id)
    if project is None:
        return None

    # Read STATE.json fresh from disk
    state_file = Path(project.path) / ".planning" / "STATE.json"
    milestones: list[dict] = []
    try:
        raw = state_file.read_text(encoding="utf-8")
        data = json.loads(raw)
        milestones = data.get("milestones", [])
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        pass

    return {
        "id": project.id,
        "name": project.name,
        "path": project.path,
        "status": project.status,
        "registered_at": project.registered_at,
        "last_seen_at": project.last_seen_at,
        "metadata_json": project.metadata_json or "{}",
        "milestones": milestones,
    }


def deregister_project(session: Session, project_id: UUID) -> Project | None:
    """Delete a project by UUID. Returns the deleted project or None."""
    project = session.get(Project, project_id)
    if project is None:
        return None
    session.delete(project)
    session.commit()
    return project


def mark_unreachable(session: Session, project_id: UUID) -> None:
    """Set project status to 'unreachable'."""
    project = session.get(Project, project_id)
    if project is not None:
        project.status = "unreachable"
        session.add(project)
        session.commit()


def mark_active(session: Session, project_id: UUID) -> None:
    """Set project status to 'active' and update last_seen_at."""
    project = session.get(Project, project_id)
    if project is not None:
        project.status = "active"
        project.last_seen_at = _utcnow()
        session.add(project)
        session.commit()
