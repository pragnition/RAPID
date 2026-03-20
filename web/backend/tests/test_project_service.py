"""Unit tests for project_service.py — core business logic."""

import json
from pathlib import Path
from uuid import uuid4

import pytest

from app.database import Project
from app.services.project_service import (
    deregister_project,
    get_project,
    get_project_detail,
    list_projects,
    mark_active,
    mark_unreachable,
    parse_state_json,
    register_project,
)


STATE_JSON_CONTENT = {
    "projectName": "TestProject",
    "milestones": [
        {
            "id": "m1",
            "name": "MVP",
            "sets": [
                {"id": "s1", "status": "active"},
                {"id": "s2", "status": "complete"},
            ],
        }
    ],
}


@pytest.fixture()
def project_dir(tmp_path: Path) -> Path:
    """Create a temporary project directory with a valid STATE.json."""
    proj = tmp_path / "myproject"
    planning = proj / ".planning"
    planning.mkdir(parents=True)
    (planning / "STATE.json").write_text(json.dumps(STATE_JSON_CONTENT))
    return proj


# ---------------------------------------------------------------------------
# parse_state_json
# ---------------------------------------------------------------------------


def test_parse_state_json_valid(project_dir: Path):
    result = parse_state_json(project_dir)
    assert result is not None
    assert result["project_name"] == "TestProject"
    assert result["current_milestone"] == "m1"
    assert result["milestone_name"] == "MVP"
    assert result["total_sets"] == 2
    assert result["active_sets"] == 1


def test_parse_state_json_missing(tmp_path: Path):
    result = parse_state_json(tmp_path / "nonexistent")
    assert result is None


def test_parse_state_json_malformed(tmp_path: Path):
    proj = tmp_path / "badproject"
    planning = proj / ".planning"
    planning.mkdir(parents=True)
    (planning / "STATE.json").write_text("not valid json {{{")
    result = parse_state_json(proj)
    assert result is None


# ---------------------------------------------------------------------------
# register_project
# ---------------------------------------------------------------------------


def test_register_project_success(session, project_dir: Path):
    project = register_project(session, str(project_dir))
    assert project.id is not None
    assert project.name == "TestProject"
    assert project.path == str(project_dir)
    assert project.status == "active"
    assert project.last_seen_at is not None
    assert project.metadata_json != "{}"


def test_register_project_auto_name(session, project_dir: Path):
    """Name should be auto-detected from STATE.json projectName."""
    project = register_project(session, str(project_dir))
    assert project.name == "TestProject"


def test_register_project_name_override(session, project_dir: Path):
    """User-supplied name takes precedence."""
    project = register_project(session, str(project_dir), name="CustomName")
    assert project.name == "CustomName"


def test_register_project_no_state_json(session, tmp_path: Path):
    """Should raise ValueError when STATE.json is missing."""
    empty_dir = tmp_path / "empty"
    empty_dir.mkdir()
    with pytest.raises(ValueError, match="No .planning/STATE.json found"):
        register_project(session, str(empty_dir))


def test_register_project_idempotent(session, project_dir: Path):
    """Registering the same path twice should update, not duplicate."""
    p1 = register_project(session, str(project_dir))
    p2 = register_project(session, str(project_dir), name="UpdatedName")
    assert p1.id == p2.id
    assert p2.name == "UpdatedName"
    # Only one project should exist
    items, total = list_projects(session)
    assert total == 1


# ---------------------------------------------------------------------------
# list_projects
# ---------------------------------------------------------------------------


def test_list_projects_pagination(session, tmp_path: Path):
    """Create 5 projects and verify pagination."""
    for i in range(5):
        proj = tmp_path / f"proj{i}"
        planning = proj / ".planning"
        planning.mkdir(parents=True)
        (planning / "STATE.json").write_text(
            json.dumps({"projectName": f"Project{i}", "milestones": []})
        )
        register_project(session, str(proj))

    items, total = list_projects(session, page=1, per_page=2)
    assert len(items) == 2
    assert total == 5

    items2, total2 = list_projects(session, page=3, per_page=2)
    assert len(items2) == 1
    assert total2 == 5


def test_list_projects_empty(session):
    items, total = list_projects(session)
    assert items == []
    assert total == 0


# ---------------------------------------------------------------------------
# get_project
# ---------------------------------------------------------------------------


def test_get_project_found(session, project_dir: Path):
    project = register_project(session, str(project_dir))
    found = get_project(session, project.id)
    assert found is not None
    assert found.id == project.id


def test_get_project_not_found(session):
    found = get_project(session, uuid4())
    assert found is None


# ---------------------------------------------------------------------------
# get_project_detail
# ---------------------------------------------------------------------------


def test_get_project_detail(session, project_dir: Path):
    project = register_project(session, str(project_dir))
    detail = get_project_detail(session, project.id)
    assert detail is not None
    assert detail["milestones"] == STATE_JSON_CONTENT["milestones"]
    assert detail["name"] == "TestProject"


def test_get_project_detail_not_found(session):
    detail = get_project_detail(session, uuid4())
    assert detail is None


# ---------------------------------------------------------------------------
# deregister_project
# ---------------------------------------------------------------------------


def test_deregister_project(session, project_dir: Path):
    project = register_project(session, str(project_dir))
    deleted = deregister_project(session, project.id)
    assert deleted is not None
    assert deleted.id == project.id
    # Should be gone now
    assert get_project(session, project.id) is None


def test_deregister_project_not_found(session):
    result = deregister_project(session, uuid4())
    assert result is None


# ---------------------------------------------------------------------------
# mark_unreachable / mark_active
# ---------------------------------------------------------------------------


def test_mark_unreachable(session, project_dir: Path):
    project = register_project(session, str(project_dir))
    mark_unreachable(session, project.id)
    session.refresh(project)
    assert project.status == "unreachable"


def test_mark_active(session, project_dir: Path):
    project = register_project(session, str(project_dir))
    mark_unreachable(session, project.id)
    session.refresh(project)
    assert project.status == "unreachable"

    mark_active(session, project.id)
    session.refresh(project)
    assert project.status == "active"
    assert project.last_seen_at is not None
