"""Shallow precondition registry for skill invocation.

Each registered skill maps to a list of checks that inspect the project's
filesystem (shallow state introspection -- no git operations, no heavy I/O).
Skills without an entry in CHECKS auto-pass with an empty blocker list.
"""

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional
from uuid import UUID

from sqlmodel import Session

from app.database import Project
from app.schemas.skills import PreconditionBlocker

logger = logging.getLogger(__name__)


@dataclass
class PreconditionContext:
    """Resolved context passed to each precondition check function."""

    project_id: str
    project_root: Path
    set_id: Optional[str]
    skill_args: dict[str, Any] = field(default_factory=dict)


def resolve_context(
    db: Session,
    project_id: str,
    set_id: Optional[str],
    skill_args: dict[str, Any],
) -> PreconditionContext:
    """Build a PreconditionContext by resolving *project_id* to a filesystem root.

    Uses the same Project table lookup pattern as project_service.get_project.
    """
    try:
        uid = UUID(project_id)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Invalid project_id: {project_id}") from exc

    project = db.get(Project, uid)
    if project is None:
        raise ValueError(f"Project not found: {project_id}")

    return PreconditionContext(
        project_id=project_id,
        project_root=Path(project.path),
        set_id=set_id,
        skill_args=skill_args,
    )


# ---------------------------------------------------------------------------
# Shallow helpers
# ---------------------------------------------------------------------------


def _state_json_exists(ctx: PreconditionContext) -> bool:
    return (ctx.project_root / ".planning" / "STATE.json").exists()


def _set_dir(ctx: PreconditionContext, set_id: str) -> Path:
    return ctx.project_root / ".planning" / "sets" / set_id


def _has_artifact(ctx: PreconditionContext, set_id: str, filename: str) -> bool:
    return _set_dir(ctx, set_id).joinpath(filename).exists()


def _set_status(ctx: PreconditionContext, set_id: str) -> Optional[str]:
    """Parse .planning/STATE.json and return the status of *set_id*, or None."""
    state_file = ctx.project_root / ".planning" / "STATE.json"
    try:
        data = json.loads(state_file.read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return None

    for ms in data.get("milestones", []):
        for s in ms.get("sets", []):
            if s.get("id") == set_id:
                return s.get("status")
    return None


# ---------------------------------------------------------------------------
# Per-skill check functions
# ---------------------------------------------------------------------------

CheckFn = Callable[[PreconditionContext], list[PreconditionBlocker]]


def _check_discuss_set(ctx: PreconditionContext) -> list[PreconditionBlocker]:
    blockers: list[PreconditionBlocker] = []
    if not ctx.set_id:
        blockers.append(PreconditionBlocker(
            code="SET_ID_REQUIRED",
            message="discuss-set requires a set_id argument",
            arg="setId",
        ))
        return blockers
    if not _state_json_exists(ctx):
        blockers.append(PreconditionBlocker(
            code="NO_STATE_JSON",
            message="Project has no .planning/STATE.json -- run /rapid:init first",
        ))
    if ctx.set_id and not _set_dir(ctx, ctx.set_id).exists():
        blockers.append(PreconditionBlocker(
            code="SET_DIR_MISSING",
            message=f"Set directory .planning/sets/{ctx.set_id}/ does not exist",
            arg="setId",
        ))
    return blockers


def _check_plan_set(ctx: PreconditionContext) -> list[PreconditionBlocker]:
    blockers = _check_discuss_set(ctx)
    if ctx.set_id and _set_dir(ctx, ctx.set_id).exists():
        if not _has_artifact(ctx, ctx.set_id, "CONTEXT.md"):
            blockers.append(PreconditionBlocker(
                code="NO_CONTEXT_MD",
                message=f"Set {ctx.set_id} has no CONTEXT.md -- run /rapid:discuss-set first",
            ))
    return blockers


def _check_execute_set(ctx: PreconditionContext) -> list[PreconditionBlocker]:
    blockers = _check_plan_set(ctx)
    if ctx.set_id and _set_dir(ctx, ctx.set_id).exists():
        plan_files = list(_set_dir(ctx, ctx.set_id).glob("wave-*-PLAN.md"))
        if not plan_files:
            blockers.append(PreconditionBlocker(
                code="NO_PLAN_MD",
                message=f"Set {ctx.set_id} has no wave-*-PLAN.md files -- run /rapid:plan-set first",
            ))
    return blockers


def _check_review(ctx: PreconditionContext) -> list[PreconditionBlocker]:
    blockers: list[PreconditionBlocker] = []
    if not ctx.set_id:
        blockers.append(PreconditionBlocker(
            code="SET_ID_REQUIRED",
            message="review requires a set_id argument",
            arg="setId",
        ))
        return blockers
    if not _set_dir(ctx, ctx.set_id).exists():
        blockers.append(PreconditionBlocker(
            code="SET_DIR_MISSING",
            message=f"Set directory .planning/sets/{ctx.set_id}/ does not exist",
            arg="setId",
        ))
        return blockers
    plan_files = list(_set_dir(ctx, ctx.set_id).glob("wave-*-PLAN.md"))
    if not plan_files:
        blockers.append(PreconditionBlocker(
            code="NO_PLAN_MD",
            message=f"Set {ctx.set_id} needs at least one wave PLAN.md to review",
        ))
    return blockers


def _check_merge(ctx: PreconditionContext) -> list[PreconditionBlocker]:
    blockers: list[PreconditionBlocker] = []
    if not ctx.set_id:
        blockers.append(PreconditionBlocker(
            code="SET_ID_REQUIRED",
            message="merge requires a set_id argument",
            arg="setId",
        ))
        return blockers
    if not _has_artifact(ctx, ctx.set_id, "REVIEW-SCOPE.md"):
        blockers.append(PreconditionBlocker(
            code="NO_REVIEW_SCOPE",
            message=f"Set {ctx.set_id} has no REVIEW-SCOPE.md -- run /rapid:review first",
        ))
    return blockers


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

CHECKS: dict[str, CheckFn] = {
    "discuss-set": _check_discuss_set,
    "plan-set": _check_plan_set,
    "execute-set": _check_execute_set,
    "review": _check_review,
    "merge": _check_merge,
}


def run_checks(
    skill_name: str,
    ctx: PreconditionContext,
) -> list[PreconditionBlocker]:
    """Run precondition checks for *skill_name*.

    Returns an empty list if the skill has no registered checks (auto-pass).
    """
    check_fn = CHECKS.get(skill_name)
    if check_fn is None:
        return []
    return check_fn(ctx)
