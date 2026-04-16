"""Tests for the shallow precondition registry."""

import json
from pathlib import Path

import pytest

from app.schemas.skills import PreconditionBlocker
from app.services.skill_preconditions import PreconditionContext, run_checks


@pytest.fixture
def project_root(tmp_path: Path) -> Path:
    """Build a minimal project directory with STATE.json and a set with CONTEXT.md."""
    planning = tmp_path / ".planning"
    planning.mkdir()

    state = {
        "projectName": "test-project",
        "milestones": [
            {
                "id": "v1",
                "name": "Version 1",
                "sets": [
                    {"id": "foo", "status": "active"},
                ],
            }
        ],
    }
    (planning / "STATE.json").write_text(json.dumps(state), encoding="utf-8")

    set_dir = planning / "sets" / "foo"
    set_dir.mkdir(parents=True)
    (set_dir / "CONTEXT.md").write_text("# Context\n", encoding="utf-8")
    (set_dir / "wave-1-PLAN.md").write_text("# Plan\n", encoding="utf-8")

    return tmp_path


def _ctx(project_root: Path, set_id: str | None = "foo", **kwargs) -> PreconditionContext:
    return PreconditionContext(
        project_id="fake-uuid",
        project_root=project_root,
        set_id=set_id,
        skill_args=kwargs.get("skill_args", {}),
    )


class TestPlanSetChecks:
    def test_plan_set_blocks_without_context_md(self, project_root: Path):
        # Remove CONTEXT.md
        (project_root / ".planning" / "sets" / "foo" / "CONTEXT.md").unlink()
        ctx = _ctx(project_root)
        blockers = run_checks("plan-set", ctx)
        codes = [b.code for b in blockers]
        assert "NO_CONTEXT_MD" in codes

    def test_plan_set_passes_with_context_md(self, project_root: Path):
        ctx = _ctx(project_root)
        blockers = run_checks("plan-set", ctx)
        assert len(blockers) == 0


class TestExecuteSetChecks:
    def test_execute_set_blocks_without_plan_md(self, project_root: Path):
        # Remove wave-1-PLAN.md
        (project_root / ".planning" / "sets" / "foo" / "wave-1-PLAN.md").unlink()
        ctx = _ctx(project_root)
        blockers = run_checks("execute-set", ctx)
        codes = [b.code for b in blockers]
        assert "NO_PLAN_MD" in codes

    def test_execute_set_passes_with_plan_md(self, project_root: Path):
        ctx = _ctx(project_root)
        blockers = run_checks("execute-set", ctx)
        assert len(blockers) == 0


class TestDiscussSetChecks:
    def test_discuss_set_blocks_without_set_id(self, project_root: Path):
        ctx = _ctx(project_root, set_id=None)
        blockers = run_checks("discuss-set", ctx)
        codes = [b.code for b in blockers]
        assert "SET_ID_REQUIRED" in codes

    def test_discuss_set_blocks_missing_set_dir(self, project_root: Path):
        ctx = _ctx(project_root, set_id="nonexistent-set")
        blockers = run_checks("discuss-set", ctx)
        codes = [b.code for b in blockers]
        assert "SET_DIR_MISSING" in codes


class TestMergeChecks:
    def test_merge_blocks_without_review_scope(self, project_root: Path):
        ctx = _ctx(project_root)
        blockers = run_checks("merge", ctx)
        codes = [b.code for b in blockers]
        assert "NO_REVIEW_SCOPE" in codes

    def test_merge_passes_with_review_scope(self, project_root: Path):
        (project_root / ".planning" / "sets" / "foo" / "REVIEW-SCOPE.md").write_text("# Review\n")
        ctx = _ctx(project_root)
        blockers = run_checks("merge", ctx)
        assert len(blockers) == 0


class TestUnknownSkill:
    def test_unknown_skill_passes_with_empty_blockers(self, project_root: Path):
        ctx = _ctx(project_root)
        blockers = run_checks("find-skills", ctx)
        assert blockers == []

    def test_another_unknown_skill(self, project_root: Path):
        ctx = _ctx(project_root)
        blockers = run_checks("backlog", ctx)
        assert blockers == []
