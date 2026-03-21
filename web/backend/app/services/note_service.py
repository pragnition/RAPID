"""Notes service layer — CRUD with .rapid-web/notes/*.md sync."""

import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlmodel import Session, select, func

from app.database import Note, Project

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _slugify(title: str) -> str:
    """Convert a title to a filesystem-safe slug."""
    slug = title.lower().replace(" ", "-")
    slug = re.sub(r"[^a-z0-9-]", "", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug[:50]


def _get_project_path(session: Session, project_id: UUID) -> Path:
    """Resolve project filesystem path from project_id."""
    project = session.get(Project, project_id)
    if project is None:
        raise ValueError(f"Project {project_id} not found")
    return Path(project.path)


def _sync_note(session: Session, note: Note, project_id: UUID) -> None:
    """Write a note to .rapid-web/notes/{slug}.md with YAML frontmatter."""
    try:
        project_path = _get_project_path(session, project_id)
        notes_dir = project_path / ".rapid-web" / "notes"
        notes_dir.mkdir(parents=True, exist_ok=True)

        slug = _slugify(note.title)
        if not slug:
            slug = str(note.id)

        content = f"""---
title: {note.title}
id: {note.id}
created_at: {note.created_at.isoformat()}
updated_at: {note.updated_at.isoformat()}
---
{note.content}"""

        filepath = notes_dir / f"{slug}.md"
        filepath.write_text(content, encoding="utf-8")
        logger.debug("Synced note %s to %s", note.id, filepath)
    except Exception:
        logger.warning("Failed to sync note %s", note.id, exc_info=True)


def _delete_note_sync(session: Session, note_title: str, note_id: UUID, project_id: UUID) -> None:
    """Remove a note's .md file from .rapid-web/notes/."""
    try:
        project_path = _get_project_path(session, project_id)
        notes_dir = project_path / ".rapid-web" / "notes"

        slug = _slugify(note_title)
        if not slug:
            slug = str(note_id)

        filepath = notes_dir / f"{slug}.md"
        if filepath.exists():
            filepath.unlink()
            logger.debug("Deleted note file %s", filepath)
    except Exception:
        logger.warning("Failed to delete note sync for %s", note_id, exc_info=True)


def list_notes(session: Session, project_id: UUID) -> tuple[list[Note], int]:
    """List all notes for a project ordered by updated_at descending."""
    total = session.exec(
        select(func.count(Note.id)).where(Note.project_id == project_id)
    ).one()

    stmt = (
        select(Note)
        .where(Note.project_id == project_id)
        .order_by(Note.updated_at.desc())  # type: ignore[union-attr]
    )
    items = list(session.exec(stmt).all())
    return items, total


def get_note(session: Session, note_id: UUID) -> Note | None:
    """Get a single note by ID."""
    return session.get(Note, note_id)


def create_note(
    session: Session, project_id: UUID, title: str, content: str = ""
) -> Note:
    """Create a new note."""
    note = Note(
        project_id=project_id,
        title=title,
        content=content,
    )
    session.add(note)
    session.commit()
    session.refresh(note)
    _sync_note(session, note, project_id)
    return note


def update_note(
    session: Session, note_id: UUID, title: str | None = None, content: str | None = None
) -> Note | None:
    """Update note fields. Returns None if not found."""
    note = session.get(Note, note_id)
    if note is None:
        return None

    # If title is changing, delete the old slug file first
    old_title = note.title

    if title is not None:
        note.title = title
    if content is not None:
        note.content = content

    note.updated_at = _utcnow()
    session.add(note)
    session.commit()
    session.refresh(note)

    # If title changed, clean up old slug file
    if title is not None and title != old_title:
        _delete_note_sync(session, old_title, note.id, note.project_id)

    _sync_note(session, note, note.project_id)
    return note


def delete_note(session: Session, note_id: UUID) -> bool:
    """Delete a note. Returns True if deleted, False if not found."""
    note = session.get(Note, note_id)
    if note is None:
        return False

    project_id = note.project_id
    note_title = note.title

    session.delete(note)
    session.commit()

    _delete_note_sync(session, note_title, note_id, project_id)
    return True
