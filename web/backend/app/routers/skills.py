"""FastAPI router for skill catalog, precondition checks, and health."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session

from app.schemas.skills import (
    PreconditionBlocker,
    PreconditionCheckRequest,
    PreconditionCheckResponse,
    SkillArgOut,
    SkillMetaOut,
)
from app.services.skill_args_sanitizer import SanitizerError, sanitize_skill_args
from app.services.skill_preconditions import resolve_context, run_checks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/skills", tags=["skills"])


def get_db(request: Request):
    """Yield a request-scoped SQLModel session from app.state.engine."""
    engine = request.app.state.engine
    with Session(engine) as session:
        yield session


def _get_catalog(request: Request):
    """Return the current SkillCatalog from app state."""
    return request.app.state.skill_catalog_service.current


def _meta_to_out(meta) -> SkillMetaOut:
    """Project an internal SkillMeta to the public SkillMetaOut schema."""
    return SkillMetaOut.model_validate(
        {
            "name": meta.name,
            "description": meta.description,
            "args": [
                {
                    "name": a.name,
                    "type": a.type.value if hasattr(a.type, "value") else str(a.type),
                    "description": a.description,
                    "required": a.required,
                    "default": a.default,
                    "choices": a.choices,
                    "maxLength": a.max_length,
                }
                for a in meta.args
            ],
            "categories": [
                c.value if hasattr(c, "value") else str(c)
                for c in meta.categories
            ],
            "allowedTools": meta.allowed_tools,
            "sourcePath": str(meta.source_path),
        }
    )


@router.get("", response_model=list[SkillMetaOut])
def list_skills(request: Request):
    """Return all skills sorted alphabetically by name."""
    catalog = _get_catalog(request)
    return [_meta_to_out(meta) for meta in catalog.list_all()]


@router.get("/_health")
def skills_health(request: Request):
    """Health check for the skill catalog subsystem."""
    catalog = _get_catalog(request)
    return {
        "skills": len(catalog.skills),
        "parse_errors": [
            {"path": str(path), "reason": reason}
            for path, reason in catalog.parse_errors
        ],
    }


@router.get("/{name}", response_model=SkillMetaOut)
def get_skill(name: str, request: Request):
    """Return metadata for a single skill by name."""
    catalog = _get_catalog(request)
    meta = catalog.get(name)
    if meta is None:
        raise HTTPException(status_code=404, detail=f"Skill not found: {name}")
    return _meta_to_out(meta)


@router.post("/{name}/check-preconditions", response_model=PreconditionCheckResponse)
def check_preconditions(
    name: str,
    body: PreconditionCheckRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Check whether a skill can be launched given current project state.

    Always returns 200 with ``{ok, blockers}``.  Arg sanitization errors
    are folded into the blockers list rather than raising 400.
    """
    catalog = _get_catalog(request)
    meta = catalog.get(name)
    if meta is None:
        raise HTTPException(status_code=404, detail=f"Skill not found: {name}")

    blockers: list[PreconditionBlocker] = []

    # 1. Structural precondition checks
    try:
        ctx = resolve_context(db, body.project_id, body.set_id, body.skill_args)
        blockers.extend(run_checks(name, ctx))
    except ValueError as exc:
        blockers.append(PreconditionBlocker(
            code="RESOLVE_ERROR",
            message=str(exc),
        ))

    # 2. Arg sanitization validation
    try:
        sanitize_skill_args(meta, body.skill_args)
    except SanitizerError as exc:
        blockers.append(PreconditionBlocker(
            code=exc.code,
            message=exc.reason,
            arg=exc.arg_name,
        ))

    return PreconditionCheckResponse(ok=len(blockers) == 0, blockers=blockers)
