"""FastAPI router for notes CRUD endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel import Session

from app.schemas.notes import (
    NoteCreate,
    NoteListResponse,
    NoteResponse,
    NoteUpdate,
)
from app.services import note_service
from app.services.project_service import get_project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["notes"])


def get_db(request: Request):
    """Yield a request-scoped SQLModel session from app.state.engine."""
    engine = request.app.state.engine
    with Session(engine) as session:
        yield session


def _require_project(session: Session, project_id: UUID) -> None:
    """Raise 404 if project does not exist."""
    project = get_project(session, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")


def _note_to_response(note) -> NoteResponse:
    """Convert a Note model instance to NoteResponse."""
    return NoteResponse(
        id=str(note.id),
        project_id=str(note.project_id),
        title=note.title,
        content=note.content,
        created_at=note.created_at.isoformat(),
        updated_at=note.updated_at.isoformat(),
    )


@router.get("/{project_id}/notes", response_model=NoteListResponse)
def list_notes(project_id: UUID, session: Session = Depends(get_db)):
    """List all notes for a project."""
    _require_project(session, project_id)
    items, total = note_service.list_notes(session, project_id)
    return NoteListResponse(
        items=[_note_to_response(n) for n in items],
        total=total,
    )


@router.get("/{project_id}/notes/{note_id}", response_model=NoteResponse)
def get_note(project_id: UUID, note_id: UUID, session: Session = Depends(get_db)):
    """Get a single note by ID."""
    _require_project(session, project_id)
    note = note_service.get_note(session, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return _note_to_response(note)


@router.post("/{project_id}/notes", response_model=NoteResponse, status_code=201)
def create_note(
    project_id: UUID, body: NoteCreate, session: Session = Depends(get_db)
):
    """Create a new note."""
    _require_project(session, project_id)
    note = note_service.create_note(session, project_id, body.title, body.content)
    return _note_to_response(note)


@router.put("/{project_id}/notes/{note_id}", response_model=NoteResponse)
def update_note(
    project_id: UUID,
    note_id: UUID,
    body: NoteUpdate,
    session: Session = Depends(get_db),
):
    """Update a note's title or content."""
    _require_project(session, project_id)
    note = note_service.update_note(
        session, note_id, title=body.title, content=body.content
    )
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return _note_to_response(note)


@router.delete("/{project_id}/notes/{note_id}", status_code=204)
def delete_note(
    project_id: UUID, note_id: UUID, session: Session = Depends(get_db)
):
    """Delete a note."""
    _require_project(session, project_id)
    deleted = note_service.delete_note(session, note_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Note not found")
    return Response(status_code=204)
